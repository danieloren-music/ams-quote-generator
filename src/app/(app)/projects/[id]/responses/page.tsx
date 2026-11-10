import { createClient } from '@/lib/supabase/server';
import ResponsesClient, { type RespRow, type RfqOpt, type ItemOpt } from './ResponsesClient';

export default async function ResponsesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: project }, { data: rfqs }, { data: ri }, { data: resp }] = await Promise.all([
    supabase.from('projects').select('tiers').eq('id', id).single(),
    supabase.from('rfqs').select('id,ref_code,status,suppliers(name)').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('rfq_items').select('rfq_id,bom_items(id,item,description)').eq('project_id', id),
    supabase.from('supplier_responses').select('id,rfq_id,file_name,source,status,summary,parsed,created_at').eq('project_id', id).order('created_at', { ascending: false }),
  ]);
  const rfqOpts: RfqOpt[] = (rfqs ?? []).map((r) => ({ id: r.id, ref_code: r.ref_code, status: r.status, supplier: (r as unknown as { suppliers: { name: string } | null }).suppliers?.name ?? '—' }));
  const itemMap: Record<string, ItemOpt[]> = {};
  (ri ?? []).forEach((x) => { const b = (x as unknown as { rfq_id: string; bom_items: ItemOpt }); (itemMap[b.rfq_id] ??= []).push(b.bom_items); });
  return <ResponsesClient projectId={id} tiers={project?.tiers ?? []} rfqs={rfqOpts} itemMap={itemMap} responses={(resp ?? []) as unknown as RespRow[]} />;
}
