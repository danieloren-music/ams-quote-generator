import { createClient } from '@/lib/supabase/server';
import type { BomItem, Category, ExtraCost, Project, Quote } from '@/lib/types';
import QuoteClient from './QuoteClient';

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: project }, { data: items }, { data: cats }, { data: quotes }, { data: sups }, { data: extras }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase.from('bom_items').select('*').eq('project_id', id).order('row_index'),
    supabase.from('categories').select('id,name,color,burden_group,requires_rfq,sort').order('sort').order('name'),
    supabase.from('quotes').select('*').eq('project_id', id),
    supabase.from('suppliers').select('id,name'),
    supabase.from('extra_costs').select('id,name,currency,amounts,burden').eq('project_id', id).order('created_at'),
  ]);
  return <QuoteClient project={project as unknown as Project} items={(items ?? []) as BomItem[]} categories={(cats ?? []) as Category[]}
    quotes={(quotes ?? []) as Quote[]} suppliers={sups ?? []} extras={(extras ?? []) as ExtraCost[]} />;
}
