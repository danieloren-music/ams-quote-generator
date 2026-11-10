'use server';

import { z } from 'zod';
import { action, must, UserError } from '@/lib/action';

const cat = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'חסר שם').max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  burden_group: z.string().trim().max(80).nullable().optional(),
  requires_rfq: z.boolean(),
});

export async function saveCategory(input: z.infer<typeof cat>) {
  return action(async ({ supabase }) => {
    const v = cat.parse(input);
    const row = { name: v.name, color: v.color, burden_group: v.burden_group || null, requires_rfq: v.requires_rfq };
    if (v.id) must(await supabase.from('categories').update(row).eq('id', v.id));
    else must(await supabase.from('categories').insert({ ...row, sort: 500 }));
  });
}

export async function deleteCategory(id: string, confirm: string) {
  return action(async ({ supabase }) => {
    z.string().uuid().parse(id);
    const c = must(await supabase.from('categories').select('name').eq('id', id).single());
    if (c.name.trim() !== confirm.trim()) throw new UserError('טקסט האישור שגוי');
    must(await supabase.from('categories').delete().eq('id', id));
  });
}

const supplier = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'חסר שם ספק').max(120),
  phone: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  category_ids: z.array(z.string().uuid()).max(60),
  contacts: z.array(z.object({ email: z.string().trim().toLowerCase().email('כתובת מייל לא תקינה').max(200), name: z.string().trim().max(120).optional().nullable() })).max(30),
});

export async function saveSupplier(input: z.infer<typeof supplier>) {
  return action(async ({ supabase }) => {
    const v = supplier.parse(input);
    const base = { name: v.name, phone: v.phone || null, notes: v.notes || null };
    let id = v.id;
    if (id) must(await supabase.from('suppliers').update(base).eq('id', id));
    else id = must(await supabase.from('suppliers').insert(base).select('id').single()).id as string;

    // קטגוריות: מוחקים מה שהוסר ומוסיפים חדשות
    const curCats = must(await supabase.from('supplier_categories').select('category_id').eq('supplier_id', id)) ?? [];
    const curSet = new Set(curCats.map((r: { category_id: string }) => r.category_id));
    const remove = [...curSet].filter((c) => !v.category_ids.includes(c));
    if (remove.length) must(await supabase.from('supplier_categories').delete().eq('supplier_id', id).in('category_id', remove));
    const add = v.category_ids.filter((c) => !curSet.has(c)).map((category_id) => ({ supplier_id: id, category_id }));
    if (add.length) must(await supabase.from('supplier_categories').insert(add));

    // כתובות מייל
    const emails = new Map(v.contacts.map((c) => [c.email, c.name || null]));
    const curC = must(await supabase.from('supplier_contacts').select('id,email').eq('supplier_id', id)) ?? [];
    const del = curC.filter((c: { email: string }) => !emails.has(c.email)).map((c: { id: string }) => c.id);
    if (del.length) must(await supabase.from('supplier_contacts').delete().in('id', del));
    if (emails.size)
      must(await supabase.from('supplier_contacts').upsert(
        [...emails.entries()].map(([email, name]) => ({ supplier_id: id, email, name })),
        { onConflict: 'supplier_id,email' }
      ));
    return id;
  });
}

export async function deleteSupplier(id: string, confirm: string) {
  return action(async ({ supabase }) => {
    z.string().uuid().parse(id);
    const s = must(await supabase.from('suppliers').select('name').eq('id', id).single());
    if (s.name.trim() !== confirm.trim()) throw new UserError('טקסט האישור שגוי');
    must(await supabase.from('suppliers').delete().eq('id', id));
  });
}
