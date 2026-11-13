'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { action, must, UserError, type Ctx } from '@/lib/action';

const id = z.string().uuid();
const tiers = z.array(z.number().int().min(1).max(100000)).min(1).max(8);

const info = z.object({
  name: z.string().trim().min(1, 'חסר שם פרויקט').max(160),
  customer_id: id.nullable().optional(),
  customer_name: z.string().trim().max(120).optional().nullable(),
  description: z.string().trim().max(4000).nullable().optional(),
  status: z.enum(['active', 'quoted', 'won', 'lost', 'archived']).optional(),
  tiers: tiers.optional(),
});

/** שם הלקוח נשמר גם בפרויקט (לתצוגה, לחיפוש ולייצוא), והקישור נבדק מול הלקוחות של המשתמש */
async function customerName(supabase: Ctx['supabase'], customerId: string | null | undefined): Promise<string | null> {
  if (!customerId) return null;
  const c = must(await supabase.from('customers').select('name').eq('id', customerId).single());
  return c.name as string;
}

export async function createProject(input: z.infer<typeof info>) {
  const res = await action(async ({ supabase }) => {
    const v = info.parse(input);
    let customerId = v.customer_id || null;
    let createdCustomerId: string | null = null;
    if (v.customer_name?.trim()) {
      // Reuse an existing customer with the same name (case-insensitive); otherwise create one.
      const { data: existing, error: lookupError } = await supabase.from('customers')
        .select('id,name').ilike('name', v.customer_name.trim()).limit(1).maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) customerId = existing.id as string;
      else {
        const created = must(await supabase.from('customers').insert({ name: v.customer_name.trim() }).select('id').single());
        customerId = created.id as string;
        createdCustomerId = customerId;
      }
    }
    const customer = await customerName(supabase, customerId);
    const inserted = await supabase.from('projects').insert({
      name: v.name, customer_id: customerId, customer, description: v.description || null, ...(v.tiers ? { tiers: v.tiers } : {}),
    }).select('id').single();
    if (inserted.error) {
      if (createdCustomerId) await supabase.from('customers').delete().eq('id', createdCustomerId);
      must(inserted);
    }
    revalidatePath('/projects');
    revalidatePath('/customers');
    return inserted.data.id as string;
  });
  if (res.ok && res.data) redirect(`/projects/${res.data}`);
  return res;
}

export async function updateProject(projectId: string, input: z.infer<typeof info>) {
  return action(async ({ supabase }) => {
    id.parse(projectId);
    const v = info.parse(input);
    const sorted = v.tiers ? [...new Set(v.tiers)].sort((a, b) => a - b) : undefined;
    const customer = await customerName(supabase, v.customer_id);
    must(await supabase.from('projects').update({
      name: v.name, customer_id: v.customer_id || null, customer, description: v.description || null,
      ...(v.status ? { status: v.status } : {}), ...(sorted ? { tiers: sorted } : {}),
    }).eq('id', projectId));
    revalidatePath('/projects');
  });
}

export async function deleteProject(projectId: string, confirm: string) {
  const res = await action(async ({ supabase, user }) => {
    id.parse(projectId);
    const p = must(await supabase.from('projects').select('name').eq('id', projectId).single());
    if (p.name.trim() !== confirm.trim()) throw new UserError('טקסט האישור שגוי');
    // מוחק גם את הקבצים מה-Storage
    for (const bucket of ['bom-files', 'supplier-responses']) {
      const { data: files } = await supabase.storage.from(bucket).list(`${user.id}/${projectId}`);
      if (files?.length) await supabase.storage.from(bucket).remove(files.map((f) => `${user.id}/${projectId}/${f.name}`));
    }
    must(await supabase.from('projects').delete().eq('id', projectId));
  });
  if (res.ok) redirect('/projects');
  return res;
}

const params = z.object({
  fx_rate: z.number().positive().max(1000),
  eur_rate: z.number().positive().max(1000),
  labor_rate: z.number().min(0).max(100000),
  oh_pct: z.number().min(0).max(10),
  profit_pct: z.number().min(0).max(10),
  burden_low_limit: z.number().min(0),
  burden_high_limit: z.number().min(0),
  burden_low_rate: z.number().min(0).max(10),
  burden_mid_rate: z.number().min(0).max(10),
  burden_high_rate: z.number().min(0).max(10),
  labor_hours: z.record(z.string().regex(/^\d+$/), z.number().min(0).max(100000)),
  exclusions: z.string().max(3000),
});

export async function saveParams(projectId: string, input: z.infer<typeof params>) {
  return action(async ({ supabase }) => {
    id.parse(projectId);
    must(await supabase.from('projects').update(params.parse(input)).eq('id', projectId));
  });
}

const extra = z.object({
  id: id.optional(),
  name: z.string().trim().min(1).max(120),
  currency: z.enum(['USD', 'ILS', 'EUR']),
  amounts: z.record(z.string().regex(/^\d+$/), z.number().min(0).max(1e9)),
  burden: z.boolean(),
});

export async function saveExtra(projectId: string, input: z.infer<typeof extra>) {
  return action(async ({ supabase }) => {
    id.parse(projectId);
    const v = extra.parse(input);
    const row = { name: v.name, currency: v.currency, amounts: v.amounts, burden: v.burden };
    if (v.id) must(await supabase.from('extra_costs').update(row).eq('id', v.id).eq('project_id', projectId));
    else must(await supabase.from('extra_costs').insert({ ...row, project_id: projectId }));
  });
}

export async function deleteExtra(projectId: string, extraId: string) {
  return action(async ({ supabase }) => {
    id.parse(extraId);
    must(await supabase.from('extra_costs').delete().eq('id', extraId).eq('project_id', projectId));
  });
}
