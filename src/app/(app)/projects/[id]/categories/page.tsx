import { createClient } from '@/lib/supabase/server';
import type { BomItem, Category } from '@/lib/types';
import CategoriesClient from './CategoriesClient';

export default async function CategoriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: items }, { data: cats }] = await Promise.all([
    supabase.from('bom_items').select('*').eq('project_id', id).order('row_index'),
    supabase.from('categories').select('id,name,color,burden_group,requires_rfq,sort').order('sort').order('name'),
  ]);
  return <CategoriesClient projectId={id} items={(items ?? []) as BomItem[]} categories={(cats ?? []) as Category[]} />;
}
