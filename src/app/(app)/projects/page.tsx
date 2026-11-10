import { createClient } from '@/lib/supabase/server';
import type { Customer, Project } from '@/lib/types';
import ProjectsClient from './ProjectsClient';

export default async function ProjectsPage() {
  const supabase = await createClient();
  const [{ data }, { data: customers }] = await Promise.all([
    supabase.from('projects').select('id,name,customer_id,customer,description,status,created_at,bom_items(count)').order('created_at', { ascending: false }),
    supabase.from('customers').select('id,name').order('name'),
  ]);
  const projects = (data ?? []).map((p) => ({ ...p, items: (p.bom_items as unknown as { count: number }[])?.[0]?.count ?? 0 })) as unknown as (Project & { items: number })[];
  return <ProjectsClient projects={projects} customers={(customers ?? []) as Pick<Customer, 'id' | 'name'>[]} />;
}
