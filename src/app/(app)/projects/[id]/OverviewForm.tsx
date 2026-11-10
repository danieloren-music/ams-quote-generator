'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import ConfirmDelete from '@/components/ConfirmDelete';
import { useAction } from '@/components/useAction';
import { STATUS_LABELS, type Customer, type Project } from '@/lib/types';
import { deleteProject, updateProject } from '../actions';

export default function OverviewForm({ project, customers }: { project: Project; customers: Pick<Customer, 'id' | 'name'>[] }) {
  const [f, setF] = useState({ name: project.name, customer_id: project.customer_id ?? '', description: project.description ?? '', status: project.status, tiers: project.tiers.join(', ') });
  const [del, setDel] = useState(false);
  const { run, pending } = useAction();

  const parsedTiers = f.tiers.split(/[,\s]+/).filter(Boolean).map(Number);
  const tiersOk = parsedTiers.length > 0 && parsedTiers.length <= 8 && parsedTiers.every((n) => Number.isInteger(n) && n > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">פרטי הפרויקט</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="n">שם</label><input id="n" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div>
            <label className="label" htmlFor="c">לקוח</label>
            <select id="c" className="input" value={f.customer_id} onChange={(e) => setF({ ...f, customer_id: e.target.value })}>
              <option value="">ללא לקוח</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {!project.customer_id && project.customer && !f.customer_id && <p className="mt-1 text-xs text-amber-700">לקוח קודם (טקסט חופשי): {project.customer}. בחרו לקוח מהרשימה כדי לשייך.</p>}
          </div>
        </div>
        <div><label className="label" htmlFor="d">תיאור וייעוד</label><textarea id="d" className="input" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="s">סטטוס</label>
            <select id="s" className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Project['status'] })}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="t">מדרגות כמות (מספר מערכות)</label>
            <input id="t" className="input" dir="ltr" value={f.tiers} onChange={(e) => setF({ ...f, tiers: e.target.value })} />
            <p className="mt-1 text-xs text-ink/50">הספקים יתבקשו לתמחר לכל מדרגה. עד 8 מדרגות.</p>
          </div>
        </div>
        <button className="btn" disabled={pending || !f.name.trim() || !tiersOk}
          onClick={() => run(() => updateProject(project.id, { name: f.name, customer_id: f.customer_id || null, description: f.description || null, status: f.status, tiers: parsedTiers }), { ok: 'נשמר' })}>
          שמירת שינויים
        </button>
      </section>

      <aside className="card h-fit space-y-3 p-5">
        <h2 className="font-semibold text-red-700">אזור מסוכן</h2>
        <p className="text-sm text-ink/60">מחיקת הפרויקט תמחק את כל ה-BOM, בקשות המחיר, התשובות וההצעות שלו.</p>
        <button className="btn-danger" onClick={() => setDel(true)}><Trash2 size={15} /> מחיקת פרויקט</button>
      </aside>

      <ConfirmDelete open={del} onClose={() => setDel(false)} busy={pending} phrase={project.name} title="מחיקת פרויקט"
        description="כל הנתונים והקבצים של הפרויקט יימחקו לצמיתות."
        onConfirm={() => run(() => deleteProject(project.id, project.name), { refresh: false })} />
    </div>
  );
}
