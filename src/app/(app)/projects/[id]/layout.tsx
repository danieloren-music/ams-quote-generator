import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProjectTabs from '@/components/ProjectTabs';
import { Badge } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import { STATUS_LABELS, type Project } from '@/lib/types';

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: p } = await supabase.from('projects').select('name,customer,status').eq('id', id).single();
  if (!p) notFound();
  return (
    <>
      <p className="mb-2 text-sm text-ink/50"><Link href="/projects" className="hover:text-brand">פרויקטים</Link> / {p.name}</p>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{p.name}</h1>
        {p.customer && <Badge tone="brand">{p.customer}</Badge>}
        <Badge>{STATUS_LABELS[p.status as Project['status']]}</Badge>
      </div>
      <ProjectTabs projectId={id} />
      <div className="pt-6">{children}</div>
    </>
  );
}
