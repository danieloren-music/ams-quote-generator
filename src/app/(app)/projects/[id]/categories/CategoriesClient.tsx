'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Download, LayoutGrid, List, Plus, RefreshCw, Search, Sparkles } from 'lucide-react';
import Modal from '@/components/Modal';
import { Badge, Empty } from '@/components/ui';
import { useAction } from '@/components/useAction';
import { saveCategory } from '@/app/(app)/suppliers/actions';
import { downloadCsv } from '@/lib/csv';
import { cn, num } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { BomItem, Category } from '@/lib/types';
import { resetAiCategories, setItemsCategory } from '../bom-actions';

const LOW = 0.7;

export default function CategoriesClient({ projectId, items, categories }: { projectId: string; items: BomItem[]; categories: Category[] }) {
  const { run, pending, router } = useAction();
  const [view, setView] = useState<'board' | 'list'>('board');
  const [q, setQ] = useState('');
  const [onlyReview, setOnlyReview] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [newCat, setNewCat] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const uncategorized = items.filter((i) => !i.category_id);
  const pendingAi = items.filter((i) => !i.category_id && i.category_source === 'none').length;
  const needsReview = (i: BomItem) => !i.category_id || (i.category_source === 'ai' && (i.category_confidence ?? 1) < LOW);

  const visible = items.filter((i) =>
    (!q || `${i.item} ${i.description ?? ''}`.toLowerCase().includes(q.toLowerCase())) && (!onlyReview || needsReview(i)));

  async function runAi() {
    setProgress({ done: 0, total: pendingAi });
    try {
      let remaining = pendingAi;
      let guard = 0;
      while (remaining > 0 && guard++ < 100) {
        const res = await fetch(`/api/projects/${projectId}/categorize`, { method: 'POST' });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || 'הסיווג נכשל');
        remaining = j.remaining;
        setProgress({ done: pendingAi - remaining, total: pendingAi });
        if (!j.processed) break;
      }
      toast('הסיווג הושלם. כדאי לעבור על פריטים שסומנו לבדיקה');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setProgress(null);
      router.refresh();
    }
  }

  const assign = (ids: string[], categoryId: string | null) => run(() => setItemsCategory(projectId, ids, categoryId), { onDone: () => setSel(new Set()) });

  const exportCsv = () => {
    const cols = [{ id: null as string | null, name: 'ללא קטגוריה' }, ...categories.map((c) => ({ id: c.id, name: c.name }))]
      .map((c) => ({ ...c, rows: items.filter((i) => (i.category_id ?? null) === c.id) })).filter((c) => c.rows.length);
    const max = Math.max(0, ...cols.map((c) => c.rows.length));
    const rows: unknown[][] = [cols.map((c) => c.name)];
    for (let r = 0; r < max; r++) rows.push(cols.map((c) => (c.rows[r] ? `${c.rows[r].item} – ${c.rows[r].description ?? ''} (x${num(c.rows[r].total_qty)})` : '')));
    downloadCsv('categories.csv', rows);
  };

  if (!items.length) return <Empty title="אין פריטים לסיווג" hint="העלו קודם BOM בלשונית 'מפרט טכני'"><Link href={`/projects/${projectId}/spec`} className="btn">למפרט הטכני</Link></Empty>;

  const columns = [
    ...(uncategorized.length ? [{ id: null as string | null, name: 'ללא קטגוריה', color: '#94a3b8' }] : []),
    ...categories.filter((c) => showEmpty || items.some((i) => i.category_id === c.id)).map((c) => ({ id: c.id as string | null, name: c.name, color: c.color })),
  ];

  const Card = ({ i }: { i: BomItem }) => (
    <div draggable onDragStart={() => setDragId(i.id)} onDragEnd={() => setDragId(null)}
      className={cn('cursor-grab rounded-lg border border-line bg-white p-2.5 text-xs shadow-sm active:cursor-grabbing', dragId === i.id && 'opacity-40')}>
      <div className="flex items-start justify-between gap-1">
        <b dir="ltr">{i.item}</b>
        {needsReview(i) && i.category_id && <AlertTriangle size={13} className="shrink-0 text-amber-600" aria-label="לבדיקה" />}
      </div>
      <p className="mt-0.5 line-clamp-2 text-ink/60" dir="ltr">{i.description}</p>
      <p className="mt-1 text-ink/40">כמות: {num(i.total_qty)}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <button className="btn" disabled={!!progress || pendingAi === 0} onClick={runAi}>
          <Sparkles size={16} /> {progress ? `מסווג… ${progress.done}/${progress.total}` : pendingAi ? `סיווג אוטומטי (${pendingAi})` : 'הכל סווג'}
        </button>
        <button className="btn-ghost" disabled={pending || !!progress} onClick={() => run(() => resetAiCategories(projectId), { ok: 'סיווגי ה-AI אופסו (שיוכים ידניים נשמרו)' })} title="מאפס רק שיוכים של ה-AI"><RefreshCw size={15} /> סיווג מחדש</button>
        <div className="relative min-w-44 flex-1">
          <Search size={16} className="absolute start-3 top-2.5 text-ink/40" />
          <input className="input ps-9" placeholder="חיפוש…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={onlyReview} onChange={(e) => setOnlyReview(e.target.checked)} /> לבדיקה בלבד</label>
        <div className="flex overflow-hidden rounded-lg border border-line">
          <button className={cn('px-3 py-2', view === 'board' ? 'bg-brand text-white' : 'bg-white')} onClick={() => setView('board')} aria-label="תצוגת לוח"><LayoutGrid size={16} /></button>
          <button className={cn('px-3 py-2', view === 'list' ? 'bg-brand text-white' : 'bg-white')} onClick={() => setView('list')} aria-label="תצוגת רשימה"><List size={16} /></button>
        </div>
        <button className="btn-ghost" onClick={() => setNewCat(true)}><Plus size={15} /> קטגוריה</button>
        <button className="btn-ghost" onClick={exportCsv}><Download size={15} /> CSV</button>
      </div>

      {view === 'board' ? (
        <>
          <label className="flex items-center gap-1.5 text-xs text-ink/60"><input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} /> הצג גם קטגוריות ריקות (כדי לגרור אליהן)</label>
          <div className="flex gap-3 overflow-x-auto pb-3">
            {columns.map((col) => {
              const colItems = visible.filter((i) => (i.category_id ?? null) === col.id);
              return (
                <div key={col.id ?? 'none'} className="w-64 shrink-0 rounded-xl bg-paper p-2"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragId) { const it = items.find((x) => x.id === dragId); if (it && (it.category_id ?? null) !== col.id) assign([dragId], col.id); setDragId(null); } }}>
                  <div className="mb-2 flex items-center gap-2 px-1.5 text-sm font-semibold">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }} />
                    <span className="truncate">{col.name}</span>
                    <span className="ms-auto text-xs font-normal text-ink/50">{colItems.length}</span>
                  </div>
                  <div className="max-h-[60vh] space-y-2 overflow-y-auto pe-0.5">
                    {colItems.map((i) => <Card key={i.id} i={i} />)}
                    {!colItems.length && <p className="px-2 py-4 text-center text-xs text-ink/40">גררו לכאן פריטים</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="card overflow-x-auto">
          {sel.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-brand-soft px-3 py-2 text-sm">
              <b>{sel.size} נבחרו</b>
              <select className="input w-auto" defaultValue="" onChange={(e) => e.target.value && assign([...sel], e.target.value === '__none' ? null : e.target.value)} aria-label="שיוך קבוצתי">
                <option value="" disabled>שייך לקטגוריה…</option>
                <option value="__none">ללא קטגוריה</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button className="btn-ghost btn-sm" onClick={() => setSel(new Set())}>ניקוי בחירה</button>
            </div>
          )}
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-line bg-paper/60"><tr>
              <th className="th w-8"><input type="checkbox" aria-label="בחר הכל" checked={visible.length > 0 && visible.every((i) => sel.has(i.id))} onChange={(e) => setSel(e.target.checked ? new Set(visible.map((i) => i.id)) : new Set())} /></th>
              {['מק"ט', 'תיאור', 'כמות', 'קטגוריה', 'ביטחון'].map((h) => <th key={h} className="th">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-line">
              {visible.map((i) => (
                <tr key={i.id} className={cn(needsReview(i) && 'bg-amber-50/40')}>
                  <td className="td"><input type="checkbox" aria-label="בחירה" checked={sel.has(i.id)} onChange={(e) => { const n = new Set(sel); e.target.checked ? n.add(i.id) : n.delete(i.id); setSel(n); }} /></td>
                  <td className="td font-medium" dir="ltr">{i.item}</td>
                  <td className="td max-w-sm truncate" dir="ltr" title={i.description ?? ''}>{i.description}</td>
                  <td className="td">{num(i.total_qty)}</td>
                  <td className="td">
                    <select className="input py-1" value={i.category_id ?? ''} aria-label="קטגוריה"
                      onChange={(e) => assign([i.id], e.target.value || null)}>
                      <option value="">ללא קטגוריה</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td className="td">{i.category_source === 'manual' ? <Badge tone="green">ידני</Badge> : i.category_confidence != null && i.category_id ? <Badge tone={i.category_confidence < LOW ? 'amber' : 'brand'}>{Math.round(i.category_confidence * 100)}%</Badge> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-ink/50">שיוך ידני נשמר גם בסיווג מחדש. קטגוריות שמוגדרות כ"לא דורשות הצעת מחיר" (כמו מסמכים והרכבות) מסומנות אוטומטית כך ולא יישלחו לספקים.</p>
      {newCat && <NewCategory onClose={() => setNewCat(false)} />}
    </div>
  );
}

function NewCategory({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const { run, pending } = useAction();
  return (
    <Modal open onClose={onClose} title="קטגוריה חדשה" size="sm"
      footer={<><button className="btn-ghost" onClick={onClose}>ביטול</button>
        <button className="btn" disabled={pending || !name.trim()} onClick={() => run(() => saveCategory({ name, color: '#0f7a89', requires_rfq: true, burden_group: null }), { ok: 'הקטגוריה נוספה', onDone: onClose })}>הוספה</button></>}>
      <label className="label" htmlFor="nc">שם הקטגוריה</label>
      <input id="nc" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <p className="mt-2 text-xs text-ink/50">אפשר להגדיר צבע וקבוצת Burden בעמוד "ספקים וקטגוריות".</p>
    </Modal>
  );
}
