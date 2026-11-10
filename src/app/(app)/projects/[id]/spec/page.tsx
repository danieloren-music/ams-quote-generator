import { createClient } from '@/lib/supabase/server';
import type { BomItem, Category } from '@/lib/types';
import SpecClient from './SpecClient';

export default async function SpecPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: items }, { data: files }, { data: cats }] = await Promise.all([
    supabase.from('bom_items').select('*').eq('project_id', id).order('row_index'),
    supabase.from('bom_files').select('id,file_name,size_bytes,created_at').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('categories').select('id,name,color,burden_group,requires_rfq,sort').order('sort').order('name'),
  ]);
  return <SpecClient projectId={id} items={(items ?? []) as BomItem[]} files={files ?? []} categories={(cats ?? []) as Category[]} />;
}
