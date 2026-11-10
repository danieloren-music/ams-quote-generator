'use server';

import { z } from 'zod';
import { action, must } from '@/lib/action';

const id = z.string().uuid();

export async function selectQuote(projectId: string, itemId: string, quoteId: string | null) {
  return action(async ({ supabase }) => {
    id.parse(projectId); id.parse(itemId);
    if (quoteId) id.parse(quoteId);
    must(await supabase.from('quotes').update({ selected: false }).eq('project_id', projectId).eq('bom_item_id', itemId));
    if (quoteId) must(await supabase.from('quotes').update({ selected: true }).eq('id', quoteId).eq('project_id', projectId).eq('bom_item_id', itemId));
  });
}

const quote = z.object({
  id: id.optional(),
  bom_item_id: id,
  supplier_id: id.nullable(),
  prices: z.record(z.string().regex(/^\d+$/), z.number().min(0).max(1e9)),
  pack_size: z.number().positive().max(1e9).nullable(),
  moq: z.number().min(0).max(1e9).nullable(),
  lead_time_days: z.number().int().min(0).max(3650).nullable(),
  currency: z.enum(['USD', 'ILS', 'EUR']),
  notes: z.string().trim().max(1000).nullable(),
});

export async function saveQuote(projectId: string, input: z.infer<typeof quote>) {
  return action(async ({ supabase }) => {
    id.parse(projectId);
    const v = quote.parse(input);
    const row = { supplier_id: v.supplier_id, prices: v.prices, pack_size: v.pack_size, moq: v.moq, lead_time_days: v.lead_time_days, currency: v.currency, notes: v.notes || null };
    if (v.id) {
      must(await supabase.from('quotes').update(row).eq('id', v.id).eq('project_id', projectId));
      return;
    }
    const has = must(await supabase.from('quotes').select('id').eq('project_id', projectId).eq('bom_item_id', v.bom_item_id).eq('selected', true)) ?? [];
    must(await supabase.from('quotes').insert({ ...row, project_id: projectId, bom_item_id: v.bom_item_id, selected: has.length === 0 }));
  });
}

export async function deleteQuote(projectId: string, quoteId: string) {
  return action(async ({ supabase }) => {
    id.parse(projectId); id.parse(quoteId);
    must(await supabase.from('quotes').delete().eq('id', quoteId).eq('project_id', projectId));
  });
}
