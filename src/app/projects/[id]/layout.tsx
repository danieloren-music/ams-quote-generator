import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import ProjectTabs from '@/components/ProjectTabs';
import { createClient } from '@/lib/supabase/server';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: project } = await supabase.from('projects').select('name, customer').eq('id', id).single();
  if (!project) notFound();

  return (
    <>
      <Header email={user?.email} />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.customer && <p className="text-sm text-brand">{project.customer}</p>}
        </div>
        <ProjectTabs projectId={id} />
        <div className="pt-6">{children}</div>
      </main>
    </>
  );
}
