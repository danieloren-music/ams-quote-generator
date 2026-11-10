import { createClient } from '@/lib/supabase/server';
import type { Customer, Project } from '@/lib/types';
import ProjectsClient from './ProjectsClient';

export default async function ProjectsPage() {
  const supabase = await createClient();
  const [first, { data: customers }] = await Promise.all([
    supabase.from('projects').select('id,name,customer_id,customer,description,status,created_at,bom_items(count)').order('created_at', { ascending: false }),
    supabase.from('customers').select('id,name').order('name'),
  ]);
  let data = first.data;
  let warn: string | null = null;
  if (first.error) {
    // כנראה שמיגרציית הלקוחות עדיין לא הורצה. טוענים בלי עמודת הלקוח כדי שהפרויקטים לא ייעלמו
    console.error('projects list', first.error.code, first.error.message);
    warn = `חלק מהנתונים לא נטענו [${first.error.code ?? '?'}]. בדרך כלל זה אומר שהקובץ supabase/migrations/002_customers.sql עדיין לא הורץ ב-Supabase.`;
    const fb = await supabase.from('projects').select('id,name,customer,description,status,created_at,bom_items(count)').order('created_at', { ascending: false });
    data = fb.data as unknown as typeof data;
  }
  const projects = (data ?? []).map((p) => ({ ...p, items: (p.bom_items as unknown as { count: number }[])?.[0]?.count ?? 0 })) as unknown as (Project & { items: number })[];
  return (
    <>
      {warn && <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{warn}</p>}
      <ProjectsClient projects={projects} customers={(customers ?? []) as Pick<Customer, 'id' | 'name'>[]} />
    </>
  );
}
