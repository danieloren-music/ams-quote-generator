import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Badge, Empty, PageHeader, Stat } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import { dateHe } from '@/lib/format';
import { STATUS_LABELS, type Project } from '@/lib/types';

export default async function Dashboard() {
  const supabase = await createClient();
  const [{ data: projects }, { count: openRfqs }, { data: pendingItems }, { data: selectedQuotes }, { data: recentRfqs }] = await Promise.all([
    supabase.from('projects').select('id,name,customer,status,created_at').order('created_at', { ascending: false }),
    supabase.from('rfqs').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
    supabase.from('bom_items').select('id').eq('sourcing', 'rfq'),
    supabase.from('quotes').select('bom_item_id').eq('selected', true),
    supabase.from('rfqs').select('id,project_id,ref_code,status,sent_at,projects(name),suppliers(name)').eq('status', 'sent').order('sent_at', { ascending: true }).limit(6),
  ]);
  const priced = new Set((selectedQuotes ?? []).map((q) => q.bom_item_id));
  const awaiting = (pendingItems ?? []).filter((i) => !priced.has(i.id)).length;
  const active = (projects ?? []).filter((p) => p.status === 'active');

  return (
    <>
      <PageHeader title="לוח בקרה" subtitle="מבט מהיר על מה שממתין לטיפול" actions={<Link href="/projects" className="btn">לכל הפרויקטים</Link>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="פרויקטים פעילים" value={active.length} hint={`${projects?.length ?? 0} בסך הכל`} />
        <Stat label="בקשות מחיר שממתינות לתשובה" value={openRfqs ?? 0} />
        <Stat label="פריטים ללא מחיר" value={awaiting} hint="דורשים הצעת מחיר ועדיין אין מחיר נבחר" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-semibold">פרויקטים אחרונים</h2>
          {!projects?.length ? (
            <Empty title="עדיין אין פרויקטים" hint="צרו את הפרויקט הראשון והעלו BOM"><Link href="/projects" className="btn">פרויקט חדש</Link></Empty>
          ) : (
            <ul className="card divide-y divide-line">
              {projects.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link href={`/projects/${p.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-paper">
                    <div><p className="font-medium">{p.name}</p><p className="text-xs text-ink/50">{p.customer || '—'} · {dateHe(p.created_at)}</p></div>
                    <Badge tone={p.status === 'active' ? 'brand' : 'gray'}>{STATUS_LABELS[p.status as Project['status']]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="mb-3 font-semibold">ממתינים לתשובת ספק</h2>
          {!recentRfqs?.length ? (
            <Empty title="אין בקשות פתוחות" />
          ) : (
            <ul className="card divide-y divide-line">
              {recentRfqs.map((r) => {
                const rr = r as unknown as { id: string; project_id: string; ref_code: string; sent_at: string; projects: { name: string } | null; suppliers: { name: string } | null };
                return (
                  <li key={rr.id}>
                    <Link href={`/projects/${rr.project_id}/responses`} className="flex items-center justify-between px-4 py-3 hover:bg-paper">
                      <div><p className="font-medium">{rr.suppliers?.name ?? 'ספק'}</p><p className="text-xs text-ink/50">{rr.projects?.name} · {rr.ref_code} · נשלח {dateHe(rr.sent_at)}</p></div>
                      <ArrowLeft size={16} className="text-ink/40" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
