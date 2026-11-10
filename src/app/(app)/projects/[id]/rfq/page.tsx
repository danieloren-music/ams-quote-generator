import { createClient } from '@/lib/supabase/server';
import { resendConfigured } from '@/lib/email';
import type { BomItem, Category, Supplier } from '@/lib/types';
import RfqClient, { type RfqRow } from './RfqClient';

export default async function RfqPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: project }, { data: items }, { data: cats }, { data: sups }, { data: links }, { data: contacts }, { data: rfqs }, { data: settings }, { data: sel }] = await Promise.all([
    supabase.from('projects').select('name,tiers').eq('id', id).single(),
    supabase.from('bom_items').select('id,item,description,total_qty,category_id,sourcing').eq('project_id', id).order('row_index'),
    supabase.from('categories').select('id,name,color,burden_group,requires_rfq,sort').order('sort').order('name'),
    supabase.from('suppliers').select('id,name,phone,notes').order('name'),
    supabase.from('supplier_categories').select('supplier_id,category_id'),
    supabase.from('supplier_contacts').select('id,supplier_id,email,name'),
    supabase.from('rfqs').select('id,ref_code,subject,status,sent_via,sent_at,replied_at,created_at,category_id,to_emails,suppliers(name),rfq_items(count)').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('user_settings').select('email_subject_he,email_body_he,email_subject_en,email_body_en').maybeSingle(),
    supabase.from('quotes').select('bom_item_id').eq('project_id', id).eq('selected', true),
  ]);
  const suppliers: Supplier[] = (sups ?? []).map((s) => ({
    ...s, contacts: (contacts ?? []).filter((c) => c.supplier_id === s.id), category_ids: (links ?? []).filter((l) => l.supplier_id === s.id).map((l) => l.category_id),
  }));
  const rows = (rfqs ?? []).map((r) => {
    const x = r as unknown as RfqRow & { suppliers: { name: string } | null; rfq_items: { count: number }[] };
    return { ...x, supplier_name: x.suppliers?.name ?? '—', item_count: x.rfq_items?.[0]?.count ?? 0 };
  });
  return (
    <RfqClient projectId={id} tiers={project?.tiers ?? []} items={(items ?? []) as unknown as BomItem[]} categories={(cats ?? []) as Category[]} suppliers={suppliers}
      rfqs={rows} priced={(sel ?? []).map((s) => s.bom_item_id)} canSend={resendConfigured()}
      templates={{ he: { subject: settings?.email_subject_he ?? '', body: settings?.email_body_he ?? '' }, en: { subject: settings?.email_subject_en ?? '', body: settings?.email_body_en ?? '' } }} />
  );
}
