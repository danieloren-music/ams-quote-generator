import { createClient } from '@/lib/supabase/server';

export default async function ProjectOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase.from('projects').select('description, created_at').eq('id', id).single();
  return (
    <section className="max-w-2xl space-y-2 rounded-lg border border-line bg-white p-6">
      <h2 className="font-semibold">תיאור וייעוד הפרויקט</h2>
      <p className="whitespace-pre-wrap text-ink/80">{p?.description || 'לא הוזן תיאור.'}</p>
    </section>
  );
}
