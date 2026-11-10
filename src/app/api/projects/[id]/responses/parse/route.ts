import { NextResponse } from 'next/server';
import { simpleParser } from 'mailparser';
import { createClient } from '@/lib/supabase/server';
import { UserError } from '@/lib/action';
import { REF_REGEX } from '@/lib/email';
import { xlsxToText } from '@/lib/excel';
import { parseSupplierReply, type GeminiPart } from '@/lib/gemini';
import { breaksToTierPrices } from '@/lib/pricing';

export const runtime = 'nodejs';
export const maxDuration = 60;
const MAX = 4 * 1024 * 1024;
const normPart = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ReviewLine {
  bom_item_id: string | null; part_number: string; supplier_part: string | null;
  prices: Record<string, number>; pack_size: number | null; moq: number | null;
  lead_time_days: number | null; currency: 'USD' | 'ILS' | 'EUR'; notes: string | null; no_quote: boolean;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 });
  const { data: project } = await supabase.from('projects').select('id,tiers').eq('id', id).single();
  if (!project) return NextResponse.json({ error: 'פרויקט לא נמצא' }, { status: 404 });

  try {
    const form = await req.formData();
    const file = form.get('file');
    const pasted = String(form.get('text') ?? '').slice(0, 60_000);
    const rfqIdIn = String(form.get('rfq_id') ?? '');
    const content: GeminiPart[] = [];
    let plain = pasted;
    let fileName: string | null = null;
    let upload: { buf: Buffer; ext: string } | null = null;

    if (file instanceof File && file.size > 0) {
      if (file.size > MAX) throw new UserError('הקובץ גדול מדי (עד 4MB)');
      fileName = file.name.replace(/[^\w.\-א-ת ]/g, '_').slice(0, 120);
      const ext = (file.name.split('.').pop() ?? '').toLowerCase();
      const buf = Buffer.from(await file.arrayBuffer());
      upload = { buf, ext };
      if (ext === 'eml') {
        const m = await simpleParser(buf);
        const txt = `From: ${m.from?.text ?? ''}\nSubject: ${m.subject ?? ''}\n\n${m.text ?? (m.html ? String(m.html).replace(/<[^>]+>/g, ' ') : '')}`;
        plain += '\n' + txt;
        content.push({ text: txt.slice(0, 60_000) });
        for (const a of m.attachments.slice(0, 4)) {
          if (a.size > MAX) continue;
          const n = (a.filename ?? '').toLowerCase();
          if (a.contentType === 'application/pdf' || n.endsWith('.pdf')) content.push({ inlineData: { mimeType: 'application/pdf', data: a.content.toString('base64') } });
          else if (n.endsWith('.xlsx')) { const t = await xlsxToText(a.content); plain += '\n' + t; content.push({ text: `[attachment ${a.filename}]\n${t}` }); }
        }
      } else if (ext === 'pdf') {
        if (buf.subarray(0, 4).toString() !== '%PDF') throw new UserError('הקובץ אינו PDF תקין');
        content.push({ inlineData: { mimeType: 'application/pdf', data: buf.toString('base64') } });
      } else if (ext === 'xlsx') {
        if (buf.subarray(0, 2).toString('latin1') !== 'PK') throw new UserError('הקובץ אינו xlsx תקין');
        const t = await xlsxToText(buf); plain += '\n' + t; content.push({ text: t });
      } else if (ext === 'txt' || ext === 'csv') {
        const t = buf.toString('utf8').slice(0, 60_000); plain += '\n' + t; content.push({ text: t });
      } else throw new UserError('פורמט לא נתמך. השתמשו ב-EML, PDF, XLSX או הדביקו טקסט');
    }
    if (pasted.trim()) content.push({ text: pasted });
    if (!content.length) throw new UserError('לא נשלח תוכן. העלו קובץ או הדביקו את טקסט המייל');

    // זיהוי הבקשה: לפי הקוד בנושא/בגוף, אחרת לפי בחירה ידנית
    let rfqId = UUID.test(rfqIdIn) ? rfqIdIn : '';
    if (!rfqId) {
      const refs = [...new Set(plain.match(REF_REGEX) ?? [])];
      if (refs.length) {
        const { data: r } = await supabase.from('rfqs').select('id').eq('project_id', id).in('ref_code', refs).limit(1);
        if (r?.length) rfqId = r[0].id;
      }
    }
    if (!rfqId) return NextResponse.json({ error: 'לא זוהה קוד בקשה (RFQ-XXXXXX). בחרו ידנית לאיזו בקשה התשובה שייכת.', needsRfq: true }, { status: 422 });

    const { data: rfqItems } = await supabase.from('rfq_items').select('bom_items(id,item,description,total_qty)').eq('rfq_id', rfqId).eq('project_id', id);
    const items = (rfqItems ?? []).map((x) => (x as unknown as { bom_items: { id: string; item: string; description: string | null; total_qty: number } }).bom_items);
    if (!items.length) throw new UserError('לבקשה אין פריטים');

    const parsed = await parseSupplierReply({
      parts: items.map((i) => ({ part_number: i.item, description: i.description, qty_per_system: i.total_qty })),
      tiers: project.tiers, content,
    });

    const byNorm = new Map(items.map((i) => [normPart(i.item), i]));
    const lines: ReviewLine[] = parsed.lines.map((l) => {
      const it = l.matched_part_number ? byNorm.get(normPart(l.matched_part_number)) ?? null : null;
      const cur = (l.currency ?? 'USD').toUpperCase();
      return {
        bom_item_id: it?.id ?? null,
        part_number: it?.item ?? l.matched_part_number ?? l.supplier_part ?? '',
        supplier_part: l.supplier_part ?? null,
        prices: it ? breaksToTierPrices(l.breaks ?? [], it.total_qty, project.tiers) : {},
        pack_size: l.price_basis === 'per_pack' && l.pack_size ? l.pack_size : null,
        moq: l.moq ?? null,
        lead_time_days: l.lead_time_days != null ? Math.round(l.lead_time_days) : null,
        currency: cur === 'ILS' || cur === 'EUR' ? cur : 'USD',
        notes: l.notes ?? null, no_quote: !!l.no_quote,
      };
    });

    let storage_path: string | null = null;
    if (upload) {
      storage_path = `${user.id}/${id}/${crypto.randomUUID()}.${upload.ext.replace(/[^a-z0-9]/g, '')}`;
      const up = await supabase.storage.from('supplier-responses').upload(storage_path, upload.buf, { upsert: false });
      if (up.error) storage_path = null;
    }
    const { data: row, error } = await supabase.from('supplier_responses').insert({
      project_id: id, rfq_id: rfqId, source: upload ? 'upload' : 'paste', file_name: fileName, storage_path,
      parsed: lines, summary: parsed.summary ?? null, status: 'parsed',
    }).select('id').single();
    if (error || !row) throw new UserError('שמירת התשובה נכשלה');
    return NextResponse.json({ ok: true, response_id: row.id, rfq_id: rfqId, lines, summary: parsed.summary ?? null });
  } catch (e) {
    if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error('parse response', e);
    return NextResponse.json({ error: 'אירעה שגיאה בפענוח התשובה' }, { status: 500 });
  }
}
