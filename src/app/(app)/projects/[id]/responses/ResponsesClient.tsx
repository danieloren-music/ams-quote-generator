'use client';

import { useRef, useState } from 'react';
import { FileText, Sparkles, Trash2, UploadCloud } from 'lucide-react';
import ConfirmDelete from '@/components/ConfirmDelete';
import { Badge, Empty } from '@/components/ui';
import { useAction } from '@/components/useAction';
import { cn, dateHe } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { Currency } from '@/lib/types';
import { applyResponse, deleteResponse } from '../rfq-actions';

export interface RfqOpt { id: string; ref_code: string; status: string; supplier: string }
export interface ItemOpt { id: string; item: string; description: string | null }
interface Line { bom_item_id: string | null; part_number: string; supplier_part: string | null; prices: Record<string, number>; pack_size: number | null; moq: number | null; lead_time_days: number | null; currency: Currency; notes: string | null; no_quote: boolean }
export interface RespRow { id: string; rfq_id: string | null; file_name: string | null; source: string; status: 'parsed' | 'applied' | 'failed'; summary: string | null; parsed: Line[] | null; created_at: string }
type Review = { responseId: string; rfqId: string; lines: (Line & { include: boolean })[]; summary: string | null };

export default function ResponsesClient({ projectId, tiers, rfqs, itemMap, responses }: { projectId: string; tiers: number[]; rfqs: RfqOpt[]; itemMap: Record<string, ItemOpt[]>; responses: RespRow[] }) {
  const { run, pending, router } = useAction();
  const [rfqId, setRfqId] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [del, setDel] = useState<RespRow | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const rfqName = (id: string | null) => { const r = rfqs.find((x) => x.id === id); return r ? `${r.supplier} · ${r.ref_code}` : '—'; };

  const toReview = (responseId: string, rfqId: string, lines: Line[], summary: string | null): Review =>
    ({ responseId, rfqId, summary, lines: lines.map((l) => ({ ...l, include: !!l.bom_item_id && !l.no_quote && Object.keys(l.prices).length > 0 })) });

  async function parse() {
    setBusy(true);
    try {
      const fd = new FormData();
      if (file) fd.append('file', file);
      if (text.trim()) fd.append('text', text);
      if (rfqId) fd.append('rfq_id', rfqId);
      const res = await fetch(`/api/projects/${projectId}/responses/parse`, { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'הפענוח נכשל');
      setReview(toReview(j.response_id, j.rfq_id, j.lines, j.summary));
      setFile(null); setText('');
      router.refresh();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  if (!rfqs.length) return <Empty title="אין עדיין בקשות מחיר" hint="שלחו בקשה לספקים בלשונית 'שליחה לספקים', ואז העלו כאן את התשובות" />;

  return (
    <div className="space-y-8">
      <section className="card space-y-4 p-5">
        <div>
          <h2 className="font-semibold">הוספת תשובת ספק</h2>
          <p className="text-sm text-ink/60">העלו את המייל (EML), PDF או Excel שהספק שלח, או הדביקו את הטקסט. ה-AI יפענח את המחירים ואתם תאשרו לפני שהם נכנסים להצעה.</p>
        </div>
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); setFile(e.dataTransfer.files?.[0] ?? null); }}
          onClick={() => input.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}
          className={cn('flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed p-6 text-center', drag ? 'border-brand bg-brand-soft' : 'border-line hover:bg-paper')}>
          <UploadCloud size={28} className="text-brand" />
          <p className="mt-2 text-sm font-medium">{file ? file.name : 'גררו לכאן קובץ .eml / .pdf / .xlsx או לחצו לבחירה'}</p>
          <input ref={input} type="file" accept=".eml,.pdf,.xlsx,.txt,.csv" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div>
          <label className="label" htmlFor="paste">או הדביקו כאן את טקסט המייל</label>
          <textarea id="paste" className="input" rows={4} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-60 flex-1">
            <label className="label" htmlFor="rfqsel">שייך לבקשה (אופציונלי, זיהוי אוטומטי לפי הקוד בנושא)</label>
            <select id="rfqsel" className="input" value={rfqId} onChange={(e) => setRfqId(e.target.value)}>
              <option value="">זיהוי אוטומטי</option>
              {rfqs.map((r) => <option key={r.id} value={r.id}>{r.supplier} · {r.ref_code}</option>)}
            </select>
          </div>
          <button className="btn" disabled={busy || (!file && !text.trim())} onClick={parse}><Sparkles size={16} /> {busy ? 'מפענח…' : 'פענוח עם AI'}</button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">תשובות שהתקבלו <span className="text-sm font-normal text-ink/50">({responses.length})</span></h2>
        {!responses.length ? <Empty title="עדיין לא נקלטו תשובות" /> : (
          <ul className="card divide-y divide-line">
            {responses.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <FileText size={18} className="text-ink/40" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{rfqName(r.rfq_id)}</p>
                  <p className="truncate text-xs text-ink/50">{r.file_name ?? 'טקסט שהודבק'} · {dateHe(r.created_at)}</p>
                </div>
                <Badge tone={r.status === 'applied' ? 'green' : r.status === 'parsed' ? 'amber' : 'red'}>{r.status === 'applied' ? 'הוחלה' : r.status === 'parsed' ? 'ממתינה לאישור' : 'נכשלה'}</Badge>
                {r.status === 'parsed' && r.parsed && r.rfq_id && <button className="btn-ghost btn-sm" onClick={() => setReview(toReview(r.id, r.rfq_id!, r.parsed!, r.summary))}>בדיקה ואישור</button>}
                <button className="icon-btn hover:text-red-600" aria-label="מחיקה" onClick={() => setDel(r)}><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {review && (
        <ReviewPanel review={review} setReview={setReview} tiers={tiers} items={itemMap[review.rfqId] ?? []} pending={pending}
          onApply={() => run(() => applyResponse(projectId, review.responseId, review.lines.filter((l) => l.include && l.bom_item_id).map((l) => ({
            bom_item_id: l.bom_item_id!, prices: l.prices, pack_size: l.pack_size, moq: l.moq, lead_time_days: l.lead_time_days, currency: l.currency, notes: l.notes,
          }))), { ok: 'המחירים נקלטו בהצעה', onDone: () => setReview(null) })} />
      )}

      <ConfirmDelete open={!!del} onClose={() => setDel(null)} busy={pending} phrase="מחיקה" title="מחיקת תשובה"
        description="התשובה והקובץ המקורי יימחקו. הצעות מחיר שכבר נקלטו ממנה יישארו."
        onConfirm={() => run(() => deleteResponse(projectId, del!.id), { ok: 'נמחק', onDone: () => setDel(null) })} />
    </div>
  );
}

function ReviewPanel({ review, setReview, tiers, items, onApply, pending }: { review: Review; setReview: (r: Review | null) => void; tiers: number[]; items: ItemOpt[]; onApply: () => void; pending: boolean }) {
  const upd = (i: number, patch: Partial<Review['lines'][number]>) => setReview({ ...review, lines: review.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const setPrice = (i: number, t: number, v: string) => {
    const prices = { ...review.lines[i].prices };
    if (v === '' || Number.isNaN(Number(v))) delete prices[String(t)]; else prices[String(t)] = Number(v);
    upd(i, { prices });
  };
  const n = review.lines.filter((l) => l.include && l.bom_item_id).length;
  return (
    <section className="card border-brand/40 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">בדיקת הפענוח</h2>
        <div className="flex gap-2"><button className="btn-ghost" onClick={() => setReview(null)}>סגירה</button><button className="btn" disabled={pending || !n} onClick={onApply}>אישור והחלה ({n})</button></div>
      </div>
      {review.summary && <p className="mb-3 rounded-lg bg-paper p-3 text-sm text-ink/70">{review.summary}</p>}
      <p className="mb-3 text-xs text-ink/60">המחירים הם ליחידה (או לאריזה כשמוגדר גודל אריזה), לכל מדרגת מערכות. ודאו מול המקור לפני האישור.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="border-b border-line bg-paper/60"><tr>
            <th className="th w-8" />
            <th className="th">פריט</th>
            {tiers.map((t) => <th key={t} className="th">@{t}</th>)}
            <th className="th">אריזה</th><th className="th">אספקה (ימים)</th><th className="th">מטבע</th><th className="th">הערות</th>
          </tr></thead>
          <tbody className="divide-y divide-line">
            {review.lines.map((l, i) => (
              <tr key={i} className={cn(!l.bom_item_id && 'bg-red-50/50')}>
                <td className="td"><input type="checkbox" aria-label="הכללה" checked={l.include} disabled={!l.bom_item_id} onChange={(e) => upd(i, { include: e.target.checked })} /></td>
                <td className="td min-w-44">
                  <select className="input py-1" aria-label="התאמת פריט" value={l.bom_item_id ?? ''} onChange={(e) => upd(i, { bom_item_id: e.target.value || null, include: !!e.target.value })} dir="ltr">
                    <option value="">לא הותאם: {l.supplier_part || l.part_number}</option>
                    {items.map((it) => <option key={it.id} value={it.id}>{it.item}</option>)}
                  </select>
                  {l.no_quote && <span className="text-xs text-red-600">הספק לא הציע מחיר</span>}
                </td>
                {tiers.map((t) => <td key={t} className="td"><input className="input w-24 py-1" type="number" min={0} step="any" dir="ltr" aria-label={`מחיר @${t}`} value={l.prices[String(t)] ?? ''} onChange={(e) => setPrice(i, t, e.target.value)} /></td>)}
                <td className="td"><input className="input w-20 py-1" type="number" min={0} step="any" dir="ltr" aria-label="גודל אריזה" placeholder="—" value={l.pack_size ?? ''} onChange={(e) => upd(i, { pack_size: e.target.value ? Number(e.target.value) : null })} /></td>
                <td className="td"><input className="input w-20 py-1" type="number" min={0} dir="ltr" aria-label="ימי אספקה" value={l.lead_time_days ?? ''} onChange={(e) => upd(i, { lead_time_days: e.target.value ? Math.round(Number(e.target.value)) : null })} /></td>
                <td className="td"><select className="input w-20 py-1" value={l.currency} aria-label="מטבע" onChange={(e) => upd(i, { currency: e.target.value as Currency })}><option>USD</option><option>ILS</option><option>EUR</option></select></td>
                <td className="td"><input className="input min-w-32 py-1" aria-label="הערות" value={l.notes ?? ''} onChange={(e) => upd(i, { notes: e.target.value || null })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
