import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseBom } from '@/lib/excel';
import { UserError } from '@/lib/action';

export const runtime = 'nodejs';
export const maxDuration = 30;
const MAX = 4 * 1024 * 1024; // מגבלת הגוף של Vercel היא ~4.5MB

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 });
  const { data: project } = await supabase.from('projects').select('id').eq('id', id).single();
  if (!project) return NextResponse.json({ error: 'פרויקט לא נמצא' }, { status: 404 });

  try {
    const form = await req.formData();
    const file = form.get('file');
    const replace = form.get('replace') === '1';
    if (!(file instanceof File)) throw new UserError('לא נשלח קובץ');
    if (file.size > MAX) throw new UserError('הקובץ גדול מדי (עד 4MB)');
    if (!/\.xlsx$/i.test(file.name)) throw new UserError('יש להעלות קובץ Excel בפורמט .xlsx');
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.subarray(0, 2).toString('latin1') !== 'PK') throw new UserError('הקובץ אינו קובץ xlsx תקין');

    const { items, rows } = await parseBom(buf);

    // שמירת הקובץ המקורי ב-Storage (נתיב שמתחיל ב-user_id, מוגן ב-RLS)
    const safeName = file.name.replace(/[^\w.\-א-ת ]/g, '_').slice(0, 120);
    const path = `${user.id}/${id}/${crypto.randomUUID()}.xlsx`;
    const up = await supabase.storage.from('bom-files').upload(path, buf, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', upsert: false,
    });
    if (up.error) throw new UserError('שמירת הקובץ נכשלה');
    const { data: bf, error: bfErr } = await supabase.from('bom_files')
      .insert({ project_id: id, file_name: safeName, storage_path: path, size_bytes: file.size }).select('id').single();
    if (bfErr || !bf) throw new UserError('שמירת רשומת הקובץ נכשלה');

    if (replace) await supabase.from('bom_items').delete().eq('project_id', id);
    const { data: existing } = await supabase.from('bom_items').select('item').eq('project_id', id);
    const have = new Set((existing ?? []).map((e) => e.item.toUpperCase()));

    const base = (i: (typeof items)[number]) => ({
      project_id: id, bom_file_id: bf.id, row_index: i.row_index, item: i.item, revision: i.revision,
      description: i.description, uom: i.uom, mpn: i.mpn, manufacturer: i.manufacturer, level: i.level,
      total_qty: i.total_qty, occurrences: i.occurrences, is_assembly: i.is_assembly,
    });
    const fresh = items.filter((i) => !have.has(i.item.toUpperCase())).map((i) => ({ ...base(i), sourcing: i.is_assembly ? 'not_required' : 'rfq' }));
    const known = items.filter((i) => have.has(i.item.toUpperCase())).map(base);
    for (let k = 0; k < fresh.length; k += 200) {
      const { error } = await supabase.from('bom_items').insert(fresh.slice(k, k + 200));
      if (error) throw new UserError('שמירת הפריטים נכשלה');
    }
    for (let k = 0; k < known.length; k += 200) {
      const { error } = await supabase.from('bom_items').upsert(known.slice(k, k + 200), { onConflict: 'project_id,item' });
      if (error) throw new UserError('עדכון הפריטים נכשל');
    }
    return NextResponse.json({ ok: true, rows, added: fresh.length, updated: known.length });
  } catch (e) {
    if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error('bom upload', e);
    return NextResponse.json({ error: 'אירעה שגיאה בעיבוד הקובץ' }, { status: 500 });
  }
}
