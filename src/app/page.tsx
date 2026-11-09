import Link from 'next/link';
import Header from '@/components/Header';
import { createClient } from '@/lib/supabase/server';
import { createProject } from './actions';

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, customer, description, created_at')
    .order('created_at', { ascending: false });

  return (
    <>
      <Header email={user?.email} />
      <main className="mx-auto grid max-w-6xl gap-8 px-6 py-8 lg:grid-cols-[1fr_20rem]">
        <section>
          <h1 className="mb-4 text-2xl font-bold">הפרויקטים שלי</h1>
          {!projects?.length ? (
            <p className="rounded-lg border border-dashed border-line bg-white p-8 text-center text-ink/60">
              עדיין אין פרויקטים. פתחי את הראשון בטופס שבצד.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line bg-white">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/projects/${p.id}`} className="block px-5 py-4 hover:bg-brand-soft">
                    <div className="flex items-baseline justify-between">
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-xs text-ink/50">
                        {new Date(p.created_at).toLocaleDateString('he-IL')}
                      </span>
                    </div>
                    {p.customer && <div className="text-sm text-brand">{p.customer}</div>}
                    {p.description && <p className="mt-1 line-clamp-2 text-sm text-ink/70">{p.description}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside>
          <form action={createProject} className="space-y-3 rounded-lg border border-line bg-white p-5">
            <h2 className="font-semibold">פרויקט חדש</h2>
            <div>
              <label className="label" htmlFor="name">שם הפרויקט</label>
              <input id="name" name="name" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="customer">לקוח</label>
              <input id="customer" name="customer" className="input" placeholder="KLA / CAMTEK" />
            </div>
            <div>
              <label className="label" htmlFor="description">תיאור וייעוד</label>
              <textarea id="description" name="description" rows={3} className="input" />
            </div>
            <button className="btn w-full">יצירת פרויקט</button>
          </form>
        </aside>
      </main>
    </>
  );
}
