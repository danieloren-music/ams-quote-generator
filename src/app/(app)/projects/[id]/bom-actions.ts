'use server';

import { z } from 'zod';
import { action, must, UserError } from '@/lib/action';

const id = z.string().uuid();
const sourcing = z.enum(['rfq', 'stock', 'internal', 'not_required']);

const item = z.object({
  id: id.optional(),
  item: z.string().trim().min(1, 'חסר מק"ט').max(120),
  revision: z.string().trim().max(20).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  mpn: z.string().trim().max(120).nullable().optional(),
  manufacturer: z.string().trim().max(120).nullable().optional(),
  total_qty: z.number().min(0).max(1e9),
  category_id: id.nullable().optional(),
  sourcing,
  internal_unit_cost: z.number().min(0).max(1e9).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export async function saveItem(projectId: string, input: z.infer<typeof item>) {
  return action(async ({ supabase }) => {
    id.parse(projectId);
    const v = item.parse(input);
    const row = {
      item: v.item, revision: v.revision || null, description: v.description || null, mpn: v.mpn || null,
      manufacturer: v.manufacturer || null, total_qty: v.total_qty, sourcing: v.sourcing,
      internal_unit_cost: v.internal_unit_cost ?? null, notes: v.notes || null,
      category_id: v.category_id ?? null, category_source: v.category_id ? 'manual' : 'none',
    };
    if (v.id) must(await supabase.from('bom_items').update(row).eq('id', v.id).eq('project_id', projectId));
    else must(await supabase.from('bom_items').insert({ ...row, project_id: projectId }));
  });
}

export async function deleteItems(projectId: string, ids: string[]) {
  return action(async ({ supabase }) => {
    id.parse(projectId);
    z.array(id).min(1).max(2000).parse(ids);
    must(await supabase.from('bom_items').delete().eq('project_id', projectId).in('id', ids));
  });
}

/** שיוך קטגוריה לפריט אחד או יותר (ידני). קטגוריה שלא דורשת RFQ מעדכנת גם את מקור האספקה */
export async function setItemsCategory(projectId: string, ids: string[], categoryId: string | null) {
  return action(async ({ supabase }) => {
    id.parse(projectId);
    z.array(id).min(1).max(2000).parse(ids);
    const patch: Record<string, unknown> = categoryId
      ? { category_id: categoryId, category_source: 'manual', category_confidence: 1 }
      : { category_id: null, category_source: 'none', category_confidence: null };
    must(await supabase.from('bom_items').update(patch).eq('project_id', projectId).in('id', ids));
    if (categoryId) {
      const c = must(await supabase.from('categories').select('requires_rfq').eq('id', categoryId).single());
      if (!c.requires_rfq) must(await supabase.from('bom_items').update({ sourcing: 'not_required' }).eq('project_id', projectId).in('id', ids).eq('sourcing', 'rfq'));
    }
  });
}

export async function setItemsSourcing(projectId: string, ids: string[], s: z.infer<typeof sourcing>) {
  return action(async ({ supabase }) => {
    id.parse(projectId);
    z.array(id).min(1).max(2000).parse(ids);
    sourcing.parse(s);
    must(await supabase.from('bom_items').update({ sourcing: s }).eq('project_id', projectId).in('id', ids));
  });
}

export async function setInternalCost(projectId: string, itemId: string, cost: number | null) {
  return action(async ({ supabase }) => {
    id.parse(projectId); id.parse(itemId);
    z.number().min(0).max(1e9).nullable().parse(cost);
    must(await supabase.from('bom_items').update({ internal_unit_cost: cost }).eq('id', itemId).eq('project_id', projectId));
  });
}

export async function resetAiCategories(projectId: string) {
  return action(async ({ supabase }) => {
    id.parse(projectId);
    must(await supabase.from('bom_items').update({ category_id: null, category_source: 'none', category_confidence: null }).eq('project_id', projectId).eq('category_source', 'ai'));
  });
}

export async function deleteBomFile(projectId: string, fileId: string) {
  return action(async ({ supabase }) => {
    id.parse(projectId); id.parse(fileId);
    const f = must(await supabase.from('bom_files').select('storage_path').eq('id', fileId).eq('project_id', projectId).single());
    await supabase.storage.from('bom-files').remove([f.storage_path]);
    must(await supabase.from('bom_files').delete().eq('id', fileId));
  });
}

export async function getBomFileUrl(projectId: string, fileId: string) {
  return action(async ({ supabase }) => {
    id.parse(projectId); id.parse(fileId);
    const f = must(await supabase.from('bom_files').select('storage_path').eq('id', fileId).eq('project_id', projectId).single());
    const { data, error } = await supabase.storage.from('bom-files').createSignedUrl(f.storage_path, 60);
    if (error || !data) throw new UserError('לא ניתן ליצור קישור להורדה');
    return data.signedUrl;
  });
}
