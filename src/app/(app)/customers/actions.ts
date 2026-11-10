'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { action, must, UserError } from '@/lib/action';

const customer = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'חסר שם לקוח').max(120),
  contact_name: z.string().trim().max(120).nullable().optional(),
  email: z.string().trim().max(200).email('כתובת מייל לא תקינה').nullable().optional().or(z.literal('')),
  phone: z.string().trim().max(40).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export async function saveCustomer(input: z.infer<typeof customer>) {
  return action(async ({ supabase }) => {
    const v = customer.parse(input);
    const row = {
      name: v.name, contact_name: v.contact_name || null, email: v.email || null,
      phone: v.phone || null, notes: v.notes || null,
    };
    let id = v.id;
    if (id) {
      must(await supabase.from('customers').update(row).eq('id', id));
      // שם הלקוח נשמר גם בפרויקטים (לתצוגה וייצוא), לכן מסנכרנים אותו
      must(await supabase.from('projects').update({ customer: v.name }).eq('customer_id', id));
    } else {
      id = must(await supabase.from('customers').insert(row).select('id').single()).id as string;
    }
    revalidatePath('/projects');
    revalidatePath('/customers');
    return id;
  });
}

export async function deleteCustomer(id: string, confirm: string) {
  return action(async ({ supabase }) => {
    z.string().uuid().parse(id);
    const c = must(await supabase.from('customers').select('name').eq('id', id).single());
    if (c.name.trim() !== confirm.trim()) throw new UserError('טקסט האישור שגוי');
    // הפרויקטים נשארים עם שם הלקוח כטקסט, רק הקישור נותק
    must(await supabase.from('customers').delete().eq('id', id));
    revalidatePath('/projects');
  });
}
