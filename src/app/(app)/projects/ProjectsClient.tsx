'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import Modal from '@/components/Modal';
import { Badge, Empty, PageHeader } from '@/components/ui';
import { useAction } from '@/components/useAction';
import { dateHe } from '@/lib/format';
import { STATUS_LABELS, type Project } from '@/lib/types';
import { createProject } from './actions';

export default function ProjectsClient({ projects }: { projects: (Project & { items: number })[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [f, setF] = useState({ name: '', customer: '', description: '' });
  const { run, pending } = useAction();
  const customers = [...new Set(projects.map((p) => p.customer).filter(Boolean))] as string[];
  const list = projects.filter((p) => (status === 'all' || p.status === status) && (!q || (p.name + (p.customer ?? '')).toLowerCase().includes(q.toLowerCase())));

  return (
    <>
      <PageHeader title="פרויקטים" subtitle="כל הצעות המחיר שלך במקום אחד" actions={<button className="btn" onClick={() => setOpen(true)}><Plus size={16} /> פרויקט חדש</button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-52 flex-1">
          <Search size={16} className="absolute start-3 top-2.5 text-ink/40" />
          <input className="input ps-9" placeholder="חיפוש פרויקט או לקוח…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="סינון לפי סטטוס">
          <option value="all">כל הסטטוסים</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {!list.length ? (
        <Empty title={projects.length ? 'לא נמצאו פרויקטים' : 'עדיין אין פרויקטים'} hint="פרויקט חדש מתחיל בהעלאת BOM">
          {!projects.length && <button className="btn" onClick={() => setOpen(true)}><Plus size={16} /> פרויקט חדש</button>}
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="card block p-5 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{p.name}</h3>
                <Badge tone={p.status === 'active' ? 'brand' : 'gray'}>{STATUS_LABELS[p.status]}</Badge>
              </div>
              <p className="mt-1 text-sm text-brand">{p.customer || 'ללא לקוח'}</p>
              {p.description && <p className="mt-2 line-clamp-2 text-sm text-ink/60">{p.description}</p>}
              <p className="mt-4 text-xs text-ink/50">{p.items} פריטים · נוצר {dateHe(p.created_at)}</p>
            </Link>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="פרויקט חדש"
        footer={<><button className="btn-ghost" onClick={() => setOpen(false)}>ביטול</button>
          <button className="btn" disabled={pending || !f.name.trim()} onClick={() => run(() => createProject(f), { ok: 'הפרויקט נוצר' })}>יצירה</button></>}>
        <div className="space-y-4">
          <div><label className="label" htmlFor="pn">שם הפרויקט / מק"ט</label><input id="pn" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></div>
          <div>
            <label className="label" htmlFor="pc">לקוח</label>
            <input id="pc" className="input" list="customers" placeholder="KLA / CAMTEK" value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} />
            <datalist id="customers">{[...new Set(['KLA', 'CAMTEK', ...customers])].map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div><label className="label" htmlFor="pd">תיאור וייעוד הפרויקט</label><textarea id="pd" className="input" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        </div>
      </Modal>
    </>
  );
}
