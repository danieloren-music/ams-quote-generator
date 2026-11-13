'use server';

import { z } from 'zod';
import { action, must, UserError } from '@/lib/action';
import { buildRfqXlsx } from '@/lib/excel';
import { cleanHeader, fillTemplate, newRefCode, resendConfigured, sendWithResend } from '@/lib/email';

const id = z.string().uuid();

const createSchema = z.object({
  category_id: id,
  supplier_ids: z.array(id).min(1, 'יש לבחור לפחות ספק אחד').max(20),
  item_ids: z.array(id).min(1, 'יש לבחור לפחות פריט אחד').max(2000),
  emails: z.record(id, z.array(z.string().email()).max(10)),
  subject: z.string().trim().min(1).max(250),
  body: z.string().trim().min(1).max(5000),
});

export interface RfqResult { rfq_id: string; supplier: string; to: string[]; subject: string; body: string; sent: boolean; error?: string }

export async function createRfqs(projectId: string, input: z.infer<typeof createSchema>) {
  return action(async ({ supabase }): Promise<RfqResult[]> => {
    id.parse(projectId);
    const v = createSchema.parse(input);

    const project = must(await supabase.from('projects').select('name,tiers').eq('id', projectId).single());
    const category = must(await supabase.from('categories').select('name').eq('id', v.category_id).single());
    const settings = (await supabase.from('user_settings').select('email_signature').maybeSingle()).data;
    const suppliers = must(await supabase.from('suppliers').select('id,name,supplier_contacts(email),supplier_categories!inner(category_id)')
      .in('id', v.supplier_ids).eq('supplier_categories.category_id', v.category_id)) as unknown as { id: string; name: string; supplier_contacts: { email: string }[] }[];
    if (suppliers.length !== new Set(v.supplier_ids).size) throw new UserError('אחד הספקים שנבחרו אינו משויך לקטגוריה הזו');
    const items = must(await supabase.from('bom_items').select('id,item,revision,description,mpn,manufacturer,total_qty')
      .eq('project_id', projectId).eq('category_id', v.category_id).in('id', v.item_ids).eq('sourcing', 'rfq'));
    if (!items.length) throw new UserError('לא נמצאו פריטים שדורשים הצעת מחיר');

    const canSend = resendConfigured();
    const results: RfqResult[] = [];

    for (const s of suppliers) {
      // נמענים: רק כתובות ששמורות אצל הספק (מונע שימוש במערכת כממסר ספאם)
      const allowed = new Set(s.supplier_contacts.map((c) => c.email.toLowerCase()));
      const to = (v.emails[s.id] ?? []).filter((e) => allowed.has(e.toLowerCase()));
      if (!to.length) { results.push({ rfq_id: '', supplier: s.name, to: [], subject: '', body: '', sent: false, error: 'לספק אין כתובת מייל שנבחרה' }); continue; }

      let ref = newRefCode();
      const vars = { supplier: s.name, project: project.name, category: category.name, ref, tiers: (project.tiers as number[]).join(', ') };
      let subject = cleanHeader(fillTemplate(v.subject, vars));
      if (!subject.includes(ref)) subject = cleanHeader(`${subject} [${ref}]`);
      const body = fillTemplate(v.body, vars) + (settings?.email_signature ? `\n\n${settings.email_signature}` : '');

      let rfq: { id: string } | null = null;
      for (let attempt = 0; attempt < 3 && !rfq; attempt++) {
        const r = await supabase.from('rfqs').insert({ project_id: projectId, supplier_id: s.id, category_id: v.category_id, ref_code: ref, subject, body, to_emails: to, status: 'draft' }).select('id').single();
        if (r.error?.code === '23505') { ref = newRefCode(); continue; }
        rfq = must(r) as { id: string };
      }
      if (!rfq) throw new UserError('יצירת קוד בקשה נכשלה');
      must(await supabase.from('rfq_items').insert(items.map((i) => ({ rfq_id: rfq!.id, bom_item_id: i.id, project_id: projectId }))));

      let sent = false; let error: string | undefined;
      if (canSend) {
        try {
          const file = await buildRfqXlsx({ ref, project: project.name, supplier: s.name, category: category.name, tiers: project.tiers, items });
          await sendWithResend({ to, subject, text: body, attachment: { filename: `${ref}.xlsx`, content: file } });
          must(await supabase.from('rfqs').update({ status: 'sent', sent_via: 'resend', sent_at: new Date().toISOString() }).eq('id', rfq.id));
          sent = true;
        } catch (e) { error = e instanceof UserError ? e.message : 'השליחה נכשלה'; }
      }
      results.push({ rfq_id: rfq.id, supplier: s.name, to, subject, body, sent, error });
    }
    return results;
  });
}

export async function markRfqSent(projectId: string, rfqId: string) {
  return action(async ({ supabase }) => {
    id.parse(projectId); id.parse(rfqId);
    must(await supabase.from('rfqs').update({ status: 'sent', sent_via: 'manual', sent_at: new Date().toISOString() }).eq('id', rfqId).eq('project_id', projectId).eq('status', 'draft'));
  });
}

export async function deleteRfq(projectId: string, rfqId: string, confirm: string) {
  return action(async ({ supabase }) => {
    id.parse(projectId); id.parse(rfqId);
    const r = must(await supabase.from('rfqs').select('ref_code').eq('id', rfqId).eq('project_id', projectId).single());
    if (r.ref_code !== confirm.trim()) throw new UserError('טקסט האישור שגוי');
    must(await supabase.from('rfqs').delete().eq('id', rfqId));
  });
}

/* ---------- אישור תשובת ספק -> יצירת הצעות מחיר ---------- */
const line = z.object({
  bom_item_id: id,
  prices: z.record(z.string().regex(/^\d+$/), z.number().min(0).max(1e9)),
  pack_size: z.number().positive().max(1e9).nullable(),
  moq: z.number().min(0).max(1e9).nullable(),
  lead_time_days: z.number().int().min(0).max(3650).nullable(),
  currency: z.enum(['USD', 'ILS', 'EUR']),
  notes: z.string().max(1000).nullable(),
});

export async function applyResponse(projectId: string, responseId: string, lines: z.infer<typeof line>[]) {
  return action(async ({ supabase }) => {
    id.parse(projectId); id.parse(responseId);
    const ls = z.array(line).min(1, 'לא נבחרו שורות').max(2000).parse(lines);
    const resp = must(await supabase.from('supplier_responses').select('id,rfq_id,status').eq('id', responseId).eq('project_id', projectId).single());
    if (resp.status === 'applied') throw new UserError('התשובה כבר הוחלה');
    const rfq = resp.rfq_id ? must(await supabase.from('rfqs').select('supplier_id').eq('id', resp.rfq_id).single()) : null;

    const itemIds = [...new Set(ls.map((l) => l.bom_item_id))];
    const has = must(await supabase.from('quotes').select('bom_item_id').eq('project_id', projectId).eq('selected', true).in('bom_item_id', itemIds)) ?? [];
    const taken = new Set(has.map((q: { bom_item_id: string }) => q.bom_item_id));
    const rows = ls.map((l) => {
      const selected = !taken.has(l.bom_item_id);
      if (selected) taken.add(l.bom_item_id);
      return { project_id: projectId, bom_item_id: l.bom_item_id, supplier_id: rfq?.supplier_id ?? null, response_id: responseId, prices: l.prices, pack_size: l.pack_size, moq: l.moq, lead_time_days: l.lead_time_days, currency: l.currency, notes: l.notes, selected };
    });
    must(await supabase.from('quotes').insert(rows));
    must(await supabase.from('supplier_responses').update({ status: 'applied' }).eq('id', responseId));
    if (resp.rfq_id) must(await supabase.from('rfqs').update({ status: 'replied', replied_at: new Date().toISOString() }).eq('id', resp.rfq_id));
    return rows.length;
  });
}

export async function deleteResponse(projectId: string, responseId: string) {
  return action(async ({ supabase }) => {
    id.parse(projectId); id.parse(responseId);
    const r = must(await supabase.from('supplier_responses').select('storage_path').eq('id', responseId).eq('project_id', projectId).single());
    if (r.storage_path) await supabase.storage.from('supplier-responses').remove([r.storage_path]);
    must(await supabase.from('supplier_responses').delete().eq('id', responseId));
  });
}
