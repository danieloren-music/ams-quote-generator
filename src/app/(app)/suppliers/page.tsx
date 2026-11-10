import { PageHeader } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import type { Category, Supplier } from '@/lib/types';
import SuppliersManager from './SuppliersManager';

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const supabase = await createClient();
  const [{ data: cats }, { data: sups }, { data: links }, { data: contacts }] = await Promise.all([
    supabase.from('categories').select('id,name,color,burden_group,requires_rfq,sort').order('sort').order('name'),
    supabase.from('suppliers').select('id,name,phone,notes').order('name'),
    supabase.from('supplier_categories').select('supplier_id,category_id'),
    supabase.from('supplier_contacts').select('id,supplier_id,email,name').order('created_at'),
  ]);

  const suppliers: Supplier[] = (sups ?? []).map((s) => ({
    ...s,
    contacts: (contacts ?? []).filter((c) => c.supplier_id === s.id),
    category_ids: (links ?? []).filter((l) => l.supplier_id === s.id).map((l) => l.category_id),
  }));

  return (
    <>
      <PageHeader title="ספקים וקטגוריות" subtitle="ניהול קטגוריות, ספקים וכתובות המייל שאליהן נשלחות בקשות מחיר" />
      <SuppliersManager categories={(cats ?? []) as Category[]} suppliers={suppliers} initialCategory={category ?? null} />
    </>
  );
}
