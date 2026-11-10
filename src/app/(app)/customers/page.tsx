import { PageHeader } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import type { Customer } from '@/lib/types';
import CustomersManager from './CustomersManager';

export default async function CustomersPage() {
  const supabase = await createClient();
  const [{ data: customers }, { data: projects }] = await Promise.all([
    supabase.from('customers').select('id,name,contact_name,email,phone,notes').order('name'),
    supabase.from('projects').select('customer_id'),
  ]);
  const counts: Record<string, number> = {};
  (projects ?? []).forEach((p) => { if (p.customer_id) counts[p.customer_id] = (counts[p.customer_id] ?? 0) + 1; });
  return (
    <>
      <PageHeader title="לקוחות" subtitle="הלקוחות שלך. בפרויקט חדש תבחר אחד מהם מרשימה" />
      <CustomersManager customers={(customers ?? []) as Customer[]} counts={counts} />
    </>
  );
}
