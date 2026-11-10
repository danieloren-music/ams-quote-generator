'use client';

import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Pencil, Plus, Search, Trash2, UploadCloud } from 'lucide-react';
import ConfirmDelete from '@/components/ConfirmDelete';
import Modal from '@/components/Modal';
import { Badge, Empty } from '@/components/ui';
import { useAction } from '@/components/useAction';
import { toast } from '@/lib/toast';
import { cn, dateHe, num } from '@/lib/format';
import { SOURCING_LABELS, type BomItem, type Category, type Sourcing } from '@/lib/types';
import { deleteBomFile, deleteItems, getBomFileUrl, saveItem } from '../bom-actions';

type F = { id: string; file_name: string; size_bytes: number | null; created_at: string };

export default function SpecClient({ projectId, items, files, categories }: { projectId: string; items: BomItem[]; files: F[]; categories: Category[] }) {
  const { run, pending, router } = useAction();
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [replace, setReplace] = useState(false);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Partial<BomItem> | null>(null);
  const [del, setDel] = useState<BomItem | null>(null);
  const [delFile, setDelFile] = useState<F | null>(null);
  const [confirmReplace, setConfirmReplace] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const cat = (id: string | null) => categories.find((c) => c.id === id);

  async function upload(file: File, repl: boolean) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (repl) fd.append('replace', '1');
      const res = await fetch(`/api/projects/${projectId}/bom`, { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'ההעלאה נכשלה');
      toast(`נקלטו ${j.added} פריטים חדשים${j.updated ? `, עודכנו ${j.updated}` : ''}`);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
      setReplace(false);
    }
  }
  const onFile = (f?: File | null) => {
    if (!f) return;
    if (replace && items.length) setConfirmReplace(f);
    else upload(f, replace);
  };

  const list = items.filter((i) => !q || `${i.item} ${i.description ?? ''} ${i.mpn ?? ''} ${i.manufacturer ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files?.[0]); }}
          onClick={() => input.current?.click()}
          role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}
          className={cn('flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors', drag ? 'border-brand bg-brand-soft' : 'border-line hover:bg-paper')}>
          <UploadCloud size={36} className="text-brand" />
          <p className="mt-3 font-medium">{busy ? 'מעבד את הקובץ…' : 'גררו לכאן קובץ BOM (Excel) או לחצו לבחירה'}</p>
          <p className="mt-1 text-xs text-ink/50">.xlsx עד 4MB · הקובץ נשמר בענן והפריטים מפוענחים אוטומטית</p>
          <input ref={input} type="file" accept=".xlsx" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        {items.length > 0 && (
          <label className="mt-3 flex items-center gap-2 text-sm text-ink/70">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            החלפת כל הפריטים הקיימים בקובץ החדש (ברירת מחדל: מיזוג, שמירת קטגוריות ועלויות)
          </label>
        )}
        {files.length > 0 && (
          <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2"><FileSpreadsheet size={16} className="shrink-0 text-green-700" /><span className="truncate">{f.file_name}</span>
                  <span className="text-xs text-ink/50">{dateHe(f.created_at)}</span></span>
                <span className="flex">
                  <button className="icon-btn" aria-label="הורדה" onClick={() => run(() => getBomFileUrl(projectId, f.id), { refresh: false, onDone: (u) => u && window.open(u, '_blank', 'noopener') })}><Download size={15} /></button>
                  <button className="icon-btn hover:text-red-600" aria-label="מחיקה" onClick={() => setDelFile(f)}><Trash2 size={15} /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="me-auto font-semibold">פריטי ה-BOM <span className="text-sm font-normal text-ink/50">({items.length})</span></h2>
          <div className="relative min-w-52">
            <Search size={16} className="absolute start-3 top-2.5 text-ink/40" />
            <input className="input ps-9" placeholder="חיפוש…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className="btn" onClick={() => setEdit({ total_qty: 1, sourcing: 'rfq' })}><Plus size={16} /> פריט חדש</button>
        </div>
        {!items.length ? <Empty title="עדיין לא הועלה BOM" hint="גררו קובץ Excel למעלה, או הוסיפו פריטים ידנית" /> : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="border-b border-line bg-paper/60"><tr>
                {['מק"ט', 'Rev', 'תיאור', 'MPN / יצרן', 'כמות', 'רמה', 'קטגוריה', 'מקור', ''].map((h) => <th key={h} className="th">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-line">
                {list.map((i) => (
                  <tr key={i.id} className="hover:bg-paper/40">
                    <td className="td font-medium" dir="ltr">{i.item}{i.is_assembly && <Badge tone="blue"> הרכבה</Badge>}</td>
                    <td className="td text-ink/60" dir="ltr">{i.revision}</td>
                    <td className="td max-w-xs truncate" title={i.description ?? ''} dir="ltr">{i.description}</td>
                    <td className="td text-xs text-ink/60" dir="ltr">{[i.mpn, i.manufacturer].filter(Boolean).join(' · ')}</td>
                    <td className="td">{num(i.total_qty)}</td>
                    <td className="td text-ink/60">{i.level}</td>
                    <td className="td">{cat(i.category_id) ? <Badge color={cat(i.category_id)!.color}>{cat(i.category_id)!.name}</Badge> : <span className="text-xs text-ink/40">—</span>}</td>
                    <td className="td text-xs">{SOURCING_LABELS[i.sourcing]}</td>
                    <td className="td whitespace-nowrap">
                      <button className="icon-btn" aria-label="עריכה" onClick={() => setEdit(i)}><Pencil size={15} /></button>
                      <button className="icon-btn hover:text-red-600" aria-label="מחיקה" onClick={() => setDel(i)}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {edit && <ItemModal projectId={projectId} init={edit} categories={categories} onClose={() => setEdit(null)} />}
      <ConfirmDelete open={!!del} onClose={() => setDel(null)} busy={pending} phrase={del?.item ?? ''} title="מחיקת פריט"
        description="הפריט והצעות המחיר שלו יימחקו."
        onConfirm={() => run(() => deleteItems(projectId, [del!.id]), { ok: 'הפריט נמחק', onDone: () => setDel(null) })} />
      <ConfirmDelete open={!!delFile} onClose={() => setDelFile(null)} busy={pending} phrase={delFile?.file_name ?? ''} title="מחיקת קובץ"
        description="הקובץ יימחק מהאחסון. הפריטים שכבר נקלטו יישארו."
        onConfirm={() => run(() => deleteBomFile(projectId, delFile!.id), { ok: 'הקובץ נמחק', onDone: () => setDelFile(null) })} />
      <ConfirmDelete open={!!confirmReplace} onClose={() => setConfirmReplace(null)} phrase="החלפה" title="החלפת כל הפריטים"
        description="כל הפריטים הקיימים, כולל קטגוריות, עלויות והצעות מחיר, יימחקו ויוחלפו בתוכן הקובץ החדש."
        onConfirm={() => { const f = confirmReplace!; setConfirmReplace(null); upload(f, true); }} />
    </div>
  );
}

function ItemModal({ projectId, init, categories, onClose }: { projectId: string; init: Partial<BomItem>; categories: Category[]; onClose: () => void }) {
  const [f, setF] = useState({
    item: init.item ?? '', revision: init.revision ?? '', description: init.description ?? '', mpn: init.mpn ?? '', manufacturer: init.manufacturer ?? '',
    total_qty: String(init.total_qty ?? 1), category_id: init.category_id ?? '', sourcing: (init.sourcing ?? 'rfq') as Sourcing,
    internal_unit_cost: init.internal_unit_cost == null ? '' : String(init.internal_unit_cost), notes: init.notes ?? '',
  });
  const { run, pending } = useAction();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const qty = Number(f.total_qty);
  const ok = f.item.trim() && Number.isFinite(qty) && qty >= 0;
  return (
    <Modal open onClose={onClose} title={init.id ? 'עריכת פריט' : 'פריט חדש'} size="lg"
      footer={<><button className="btn-ghost" onClick={onClose}>ביטול</button>
        <button className="btn" disabled={pending || !ok} onClick={() => run(() => saveItem(projectId, {
          id: init.id, item: f.item, revision: f.revision || null, description: f.description || null, mpn: f.mpn || null, manufacturer: f.manufacturer || null,
          total_qty: qty, category_id: f.category_id || null, sourcing: f.sourcing,
          internal_unit_cost: f.internal_unit_cost === '' ? null : Number(f.internal_unit_cost), notes: f.notes || null,
        }), { ok: 'נשמר', onDone: onClose })}>שמירה</button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="i1">מק"ט</label><input id="i1" className="input" dir="ltr" value={f.item} onChange={set('item')} autoFocus /></div>
        <div><label className="label" htmlFor="i2">Rev</label><input id="i2" className="input" dir="ltr" value={f.revision} onChange={set('revision')} /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="i3">תיאור</label><input id="i3" className="input" dir="ltr" value={f.description} onChange={set('description')} /></div>
        <div><label className="label" htmlFor="i4">MPN</label><input id="i4" className="input" dir="ltr" value={f.mpn} onChange={set('mpn')} /></div>
        <div><label className="label" htmlFor="i5">יצרן</label><input id="i5" className="input" dir="ltr" value={f.manufacturer} onChange={set('manufacturer')} /></div>
        <div><label className="label" htmlFor="i6">כמות למערכת</label><input id="i6" type="number" min={0} step="any" className="input" dir="ltr" value={f.total_qty} onChange={set('total_qty')} /></div>
        <div>
          <label className="label" htmlFor="i7">קטגוריה</label>
          <select id="i7" className="input" value={f.category_id} onChange={set('category_id')}>
            <option value="">ללא קטגוריה</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="i8">מקור אספקה</label>
          <select id="i8" className="input" value={f.sourcing} onChange={set('sourcing')}>
            {Object.entries(SOURCING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {(f.sourcing === 'stock' || f.sourcing === 'internal') && (
          <div><label className="label" htmlFor="i9">עלות פנימית ליחידה ($)</label><input id="i9" type="number" min={0} step="any" className="input" dir="ltr" value={f.internal_unit_cost} onChange={set('internal_unit_cost')} /></div>
        )}
        <div className="sm:col-span-2"><label className="label" htmlFor="i10">הערות</label><textarea id="i10" rows={2} className="input" value={f.notes} onChange={set('notes')} /></div>
      </div>
    </Modal>
  );
}
