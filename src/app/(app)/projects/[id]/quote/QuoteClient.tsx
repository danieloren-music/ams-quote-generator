'use client';

import { useMemo, useState } from 'react';
import { Download, Pencil, Plus, Save, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import ConfirmDelete from '@/components/ConfirmDelete';
import Modal from '@/components/Modal';
import { Badge, Empty } from '@/components/ui';
import { useAction } from '@/components/useAction';
import { cn, money, num } from '@/lib/format';
import { computeSummary, priceForTier, type LineState } from '@/lib/pricing';
import { SOURCING_LABELS, type BomItem, type Category, type Currency, type ExtraCost, type Project, type Quote } from '@/lib/types';
import { deleteExtra, saveExtra, saveParams } from '../../actions';
import { setInternalCost } from '../bom-actions';
import { deleteQuote, saveQuote, selectQuote } from '../quote-actions';

const STATE_LABEL: Record<LineState, { t: string; tone: 'green' | 'amber' | 'red' | 'gray' }> = {
  ok: { t: 'מחיר מלא', tone: 'green' }, estimated: { t: 'הערכה', tone: 'amber' }, missing: { t: 'חסר מחיר', tone: 'red' }, skipped: { t: 'לא נדרש', tone: 'gray' },
};

export default function QuoteClient({ project, items, categories, quotes, suppliers, extras }: {
  project: Project; items: BomItem[]; categories: Category[]; quotes: Quote[]; suppliers: { id: string; name: string }[]; extras: ExtraCost[];
}) {
  const { run, pending } = useAction();
  const [p, setP] = useState({
    fx_rate: project.fx_rate, eur_rate: project.eur_rate, labor_rate: project.labor_rate, oh_pct: project.oh_pct, profit_pct: project.profit_pct,
    burden_low_limit: project.burden_low_limit, burden_high_limit: project.burden_high_limit, burden_low_rate: project.burden_low_rate,
    burden_mid_rate: project.burden_mid_rate, burden_high_rate: project.burden_high_rate, labor_hours: project.labor_hours, exclusions: project.exclusions,
  });
  const [dirty, setDirty] = useState(false);
  const [showParams, setShowParams] = useState(false);
  const [tierIdx, setTierIdx] = useState(0);
  const [q, setQ] = useState('');
  const [fCat, setFCat] = useState('');
  const [fSup, setFSup] = useState('');
  const [fState, setFState] = useState('');
  const [manual, setManual] = useState<{ item: BomItem; quote?: Quote } | null>(null);
  const [extra, setExtra] = useState<Partial<ExtraCost> | null>(null);
  const [delExtra, setDelExtra] = useState<ExtraCost | null>(null);
  const [delQuote, setDelQuote] = useState<Quote | null>(null);

  const full = { ...project, ...p };
  const supName = (id: string | null) => suppliers.find((s) => s.id === id)?.name ?? 'ללא ספק';
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const selected = useMemo(() => new Map(quotes.filter((x) => x.selected).map((x) => [x.bom_item_id, x])), [quotes]);
  const S = useMemo(() => computeSummary(full, items, selected, categories, extras), [full, items, selected, categories, extras]); // eslint-disable-line react-hooks/exhaustive-deps
  const tiers = project.tiers;
  const tier = tiers[tierIdx] ?? tiers[0];

  const rows = items.filter((i) => {
    const l = S.lines.get(i.id)?.[tierIdx];
    const sq = selected.get(i.id);
    return (!q || `${i.item} ${i.description ?? ''}`.toLowerCase().includes(q.toLowerCase()))
      && (!fCat || (fCat === '__none' ? !i.category_id : i.category_id === fCat))
      && (!fSup || sq?.supplier_id === fSup)
      && (!fState || l?.state === fState);
  });

  const set = <K extends keyof typeof p>(k: K, v: (typeof p)[K]) => { setP({ ...p, [k]: v }); setDirty(true); };
  const numIn = (k: keyof typeof p, pct = false) => (
    <input type="number" step="any" min={0} className="input" dir="ltr" value={pct ? +((p[k] as number) * 100).toFixed(4) : (p[k] as number)}
      onChange={(e) => set(k, (pct ? Number(e.target.value) / 100 : Number(e.target.value)) as never)} />
  );

  if (!items.length) return <Empty title="אין נתונים לחישוב" hint="העלו BOM וקלטו מחירי ספקים" />;

  const SumRow = ({ label, vals, bold, sub, money: m = true }: { label: string; vals: number[]; bold?: boolean; sub?: boolean; money?: boolean }) => (
    <tr className={cn(bold && 'bg-paper/70 font-semibold')}>
      <td className={cn('td', sub && 'ps-8 text-ink/60')}>{label}</td>
      {vals.map((v, i) => <td key={i} className={cn('td text-end tabular-nums', i === tierIdx && 'bg-brand-soft/50')} dir="ltr">{m ? money(v) : num(v)}</td>)}
    </tr>
  );

  return (
    <div className="space-y-8">
      {/* כרטיסי מדרגות */}
      <section>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tiers.map((t, i) => (
            <button key={t} onClick={() => setTierIdx(i)} className={cn('card p-4 text-start transition-shadow', i === tierIdx ? 'ring-2 ring-brand' : 'hover:shadow-md')}>
              <p className="text-xs text-ink/50">{t} מערכות</p>
              <p className="mt-1 text-2xl font-bold tabular-nums" dir="ltr">{money(S.total[i], 0)}</p>
              <p className="text-xs text-ink/50">ליחידה · סה"כ הזמנה <span dir="ltr">{money(S.total[i] * t, 0)}</span></p>
            </button>
          ))}
        </div>
        {(S.missing > 0 || S.estimated > 0) && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            {S.missing > 0 && <>חסר מחיר ל-<b>{S.missing}</b> פריטים (נספרים כאפס). </>}
            {S.estimated > 0 && <>ל-<b>{S.estimated}</b> פריטים יש מחיר רק למדרגה סמוכה (הערכה). </>}
            הסכום הסופי אינו שלם עד להשלמתם.
          </p>
        )}
      </section>

      {/* סיכום */}
      <section className="card overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="font-semibold">סיכום הצעת המחיר (ליחידה)</h2>
          <div className="flex gap-2">
            <button className="btn-ghost btn-sm" onClick={() => setShowParams(!showParams)}><SlidersHorizontal size={14} /> פרמטרים</button>
            <a className={cn('btn btn-sm', dirty && 'pointer-events-none opacity-50')} href={`/api/projects/${project.id}/quote/export`}><Download size={14} /> ייצוא Excel</a>
          </div>
        </div>
        <table className="w-full min-w-[640px]">
          <thead className="border-b border-line bg-paper/60"><tr><th className="th" />{tiers.map((t) => <th key={t} className="th text-end">{t} מערכות</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            {S.groups.map((g) => <SumRow key={g.name} label={g.name} vals={g.totals} />)}
            {extras.map((e, i) => (
              <tr key={e.id}>
                <td className="td">{e.name} <button className="icon-btn inline-flex h-6 w-6" aria-label="עריכה" onClick={() => setExtra(e)}><Pencil size={12} /></button>
                  <button className="icon-btn inline-flex h-6 w-6 hover:text-red-600" aria-label="מחיקה" onClick={() => setDelExtra(e)}><Trash2 size={12} /></button></td>
                {S.extras[i].totals.map((v, k) => <td key={k} className={cn('td text-end tabular-nums', k === tierIdx && 'bg-brand-soft/50')} dir="ltr">{money(v)}</td>)}
              </tr>
            ))}
            <tr><td className="td" colSpan={tiers.length + 1}><button className="text-sm text-brand hover:underline" onClick={() => setExtra({ currency: 'USD', burden: true, amounts: {} })}>+ הוספת עלות נוספת (למשל צביעה)</button></td></tr>
            <SumRow label="Total BOM" vals={S.bomTotal} bold />
            <SumRow label="Burden" vals={S.burdenTotal} sub />
            <SumRow label="BOM + Burden" vals={S.materials} bold />
            <SumRow label="שעות עבודה" vals={S.laborHours} sub money={false} />
            <SumRow label="Labor" vals={S.labor} />
            <SumRow label="OH" vals={S.oh} />
            <SumRow label="Sub total" vals={S.subtotal} bold />
            <SumRow label="Profit" vals={S.profit} />
            <SumRow label="TOTAL / מערכת" vals={S.total} bold />
          </tbody>
        </table>
      </section>

      {showParams && (
        <section className="card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">פרמטרי חישוב <span className="text-xs font-normal text-ink/50">(שינוי מתעדכן מיידית בחישוב, ונשמר בלחיצה)</span></h2>
            <button className="btn" disabled={!dirty || pending} onClick={() => run(() => saveParams(project.id, p), { ok: 'הפרמטרים נשמרו', onDone: () => setDirty(false) })}><Save size={15} /> שמירה</button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <div><label className="label">שער ₪ לדולר</label>{numIn('fx_rate')}</div>
            <div><label className="label">שער $ ליורו</label>{numIn('eur_rate')}</div>
            <div><label className="label">עלות שעת עבודה ($)</label>{numIn('labor_rate')}</div>
            <div><label className="label">OH (% מ-Labor)</label>{numIn('oh_pct', true)}</div>
            <div><label className="label">Profit (%)</label>{numIn('profit_pct', true)}</div>
            <div><label className="label">Burden: סף תחתון ($)</label>{numIn('burden_low_limit')}</div>
            <div><label className="label">Burden: סף עליון ($)</label>{numIn('burden_high_limit')}</div>
            <div><label className="label">שיעור מתחת לסף (%)</label>{numIn('burden_low_rate', true)}</div>
            <div><label className="label">שיעור בין הספים (%)</label>{numIn('burden_mid_rate', true)}</div>
            <div><label className="label">שיעור מעל הסף (%)</label>{numIn('burden_high_rate', true)}</div>
          </div>
          <div>
            <span className="label">שעות עבודה לפי מדרגה</span>
            <div className="grid gap-3 sm:grid-cols-5">
              {tiers.map((t) => (
                <div key={t}><label className="text-xs text-ink/60">{t} מערכות</label>
                  <input type="number" min={0} step="any" className="input" dir="ltr" value={p.labor_hours[String(t)] ?? ''} onChange={(e) => set('labor_hours', { ...p.labor_hours, [String(t)]: Number(e.target.value) })} /></div>
              ))}
            </div>
          </div>
          <div><label className="label" htmlFor="excl">הערות / "המחיר אינו כולל"</label><textarea id="excl" rows={4} className="input" value={p.exclusions} onChange={(e) => set('exclusions', e.target.value)} dir="ltr" /></div>
        </section>
      )}

      {/* פירוט פריטים */}
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="me-auto font-semibold">פירוט פריטים · מדרגה: {tier} מערכות</h2>
          <div className="relative min-w-44"><Search size={16} className="absolute start-3 top-2.5 text-ink/40" /><input className="input ps-9" placeholder="חיפוש…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="input w-auto" aria-label="סינון קטגוריה" value={fCat} onChange={(e) => setFCat(e.target.value)}><option value="">כל הקטגוריות</option><option value="__none">ללא קטגוריה</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select className="input w-auto" aria-label="סינון ספק" value={fSup} onChange={(e) => setFSup(e.target.value)}><option value="">כל הספקים</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select className="input w-auto" aria-label="סינון סטטוס" value={fState} onChange={(e) => setFState(e.target.value)}><option value="">כל הסטטוסים</option>{Object.entries(STATE_LABEL).map(([k, v]) => <option key={k} value={k}>{v.t}</option>)}</select>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead className="border-b border-line bg-paper/60"><tr>{['מק"ט', 'תיאור', 'קטגוריה', 'כמות', 'ספק / מקור', 'אספקה', `עלות ליחידה @${tier}`, 'סטטוס', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((i) => {
                const l = S.lines.get(i.id)?.[tierIdx];
                const iq = quotes.filter((x) => x.bom_item_id === i.id);
                const sq = selected.get(i.id);
                const c = i.category_id ? catById.get(i.category_id) : null;
                return (
                  <tr key={i.id} className="hover:bg-paper/40">
                    <td className="td font-medium" dir="ltr">{i.item}</td>
                    <td className="td max-w-xs truncate" dir="ltr" title={i.description ?? ''}>{i.description}</td>
                    <td className="td">{c ? <Badge color={c.color}>{c.name}</Badge> : '—'}</td>
                    <td className="td">{num(i.total_qty)}</td>
                    <td className="td">
                      {i.sourcing === 'rfq' ? (
                        <select className="input min-w-44 py-1" aria-label="בחירת הצעה" value={sq?.id ?? ''} disabled={pending}
                          onChange={(e) => run(() => selectQuote(project.id, i.id, e.target.value || null))}>
                          <option value="">{iq.length ? 'בחרו הצעה…' : 'אין הצעות'}</option>
                          {iq.map((x) => { const pr = priceForTier(x.prices, tier); return <option key={x.id} value={x.id}>{supName(x.supplier_id)} · {pr ? `${num(pr.price)} ${x.currency}${x.pack_size ? '/אריזה' : ''}` : '—'}</option>; })}
                        </select>
                      ) : i.sourcing === 'not_required' ? <span className="text-xs text-ink/50">{SOURCING_LABELS[i.sourcing]}</span> : (
                        <input type="number" min={0} step="any" dir="ltr" className="input w-28 py-1" placeholder="עלות $" aria-label="עלות פנימית" defaultValue={i.internal_unit_cost ?? ''}
                          onBlur={(e) => { const v = e.target.value === '' ? null : Number(e.target.value); if (v !== i.internal_unit_cost) run(() => setInternalCost(project.id, i.id, v)); }} />
                      )}
                    </td>
                    <td className="td text-xs">{sq?.lead_time_days != null ? `${sq.lead_time_days} ימים` : '—'}</td>
                    <td className="td tabular-nums" dir="ltr">{l && l.state !== 'missing' && l.state !== 'skipped' ? money(l.perSystem) : '—'}</td>
                    <td className="td">{l && <Badge tone={STATE_LABEL[l.state].tone}>{STATE_LABEL[l.state].t}</Badge>}</td>
                    <td className="td whitespace-nowrap">
                      {i.sourcing === 'rfq' && <>
                        <button className="icon-btn" aria-label="הצעה ידנית" title="הוספת הצעה ידנית" onClick={() => setManual({ item: i })}><Plus size={15} /></button>
                        {sq && <button className="icon-btn" aria-label="עריכת ההצעה הנבחרת" onClick={() => setManual({ item: i, quote: sq })}><Pencil size={14} /></button>}
                        {sq && <button className="icon-btn hover:text-red-600" aria-label="מחיקת ההצעה הנבחרת" onClick={() => setDelQuote(sq)}><Trash2 size={14} /></button>}
                      </>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {manual && <QuoteModal projectId={project.id} tiers={tiers} suppliers={suppliers} init={manual} onClose={() => setManual(null)} />}
      {extra && <ExtraModal projectId={project.id} tiers={tiers} init={extra} onClose={() => setExtra(null)} />}
      <ConfirmDelete open={!!delExtra} onClose={() => setDelExtra(null)} busy={pending} phrase={delExtra?.name ?? ''} title="מחיקת עלות נוספת"
        onConfirm={() => run(() => deleteExtra(project.id, delExtra!.id), { ok: 'נמחק', onDone: () => setDelExtra(null) })} />
      <ConfirmDelete open={!!delQuote} onClose={() => setDelQuote(null)} busy={pending} phrase="מחיקה" title="מחיקת הצעת מחיר" description="הצעת הספק תימחק מהחישוב."
        onConfirm={() => run(() => deleteQuote(project.id, delQuote!.id), { ok: 'נמחק', onDone: () => setDelQuote(null) })} />
    </div>
  );
}

function QuoteModal({ projectId, tiers, suppliers, init, onClose }: { projectId: string; tiers: number[]; suppliers: { id: string; name: string }[]; init: { item: BomItem; quote?: Quote }; onClose: () => void }) {
  const q = init.quote;
  const [sup, setSup] = useState(q?.supplier_id ?? '');
  const [cur, setCur] = useState<Currency>(q?.currency ?? 'USD');
  const [pack, setPack] = useState(q?.pack_size ? String(q.pack_size) : '');
  const [lead, setLead] = useState(q?.lead_time_days != null ? String(q.lead_time_days) : '');
  const [notes, setNotes] = useState(q?.notes ?? '');
  const [prices, setPrices] = useState<Record<string, string>>(Object.fromEntries(tiers.map((t) => [String(t), q?.prices[String(t)] != null ? String(q.prices[String(t)]) : ''])));
  const { run, pending } = useAction();
  const filled = Object.fromEntries(Object.entries(prices).filter(([, v]) => v !== '' && Number(v) >= 0).map(([k, v]) => [k, Number(v)]));
  return (
    <Modal open onClose={onClose} title={`הצעת מחיר: ${init.item.item}`} size="lg"
      footer={<><button className="btn-ghost" onClick={onClose}>ביטול</button>
        <button className="btn" disabled={pending || !Object.keys(filled).length} onClick={() => run(() => saveQuote(projectId, {
          id: q?.id, bom_item_id: init.item.id, supplier_id: sup || null, prices: filled, pack_size: pack ? Number(pack) : null, moq: q?.moq ?? null,
          lead_time_days: lead ? Math.round(Number(lead)) : null, currency: cur, notes: notes || null,
        }), { ok: 'נשמר', onDone: onClose })}>שמירה</button></>}>
      <div className="space-y-4">
        <p className="text-sm text-ink/60" dir="ltr">{init.item.description}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className="label" htmlFor="qs">ספק</label><select id="qs" className="input" value={sup} onChange={(e) => setSup(e.target.value)}><option value="">ללא ספק</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><label className="label" htmlFor="qc">מטבע</label><select id="qc" className="input" value={cur} onChange={(e) => setCur(e.target.value as Currency)}><option>USD</option><option>ILS</option><option>EUR</option></select></div>
          <div><label className="label" htmlFor="ql">זמן אספקה (ימים)</label><input id="ql" type="number" min={0} className="input" dir="ltr" value={lead} onChange={(e) => setLead(e.target.value)} /></div>
        </div>
        <div>
          <span className="label">מחיר לכל מדרגה {pack ? '(לאריזה)' : '(ליחידה)'}</span>
          <div className="grid gap-3 sm:grid-cols-5">
            {tiers.map((t) => <div key={t}><label className="text-xs text-ink/60">{t} מערכות</label><input type="number" min={0} step="any" className="input" dir="ltr" value={prices[String(t)]} onChange={(e) => setPrices({ ...prices, [String(t)]: e.target.value })} /></div>)}
          </div>
          <button type="button" className="mt-2 text-xs text-brand hover:underline" onClick={() => { const v = Object.values(prices).find((x) => x !== ''); if (v) setPrices(Object.fromEntries(tiers.map((t) => [String(t), v]))); }}>מילוי כל המדרגות באותו מחיר</button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="qp">גודל אריזה (אם המחיר הוא לאריזה)</label><input id="qp" type="number" min={0} step="any" className="input" dir="ltr" placeholder="ריק = מחיר ליחידה" value={pack} onChange={(e) => setPack(e.target.value)} /></div>
          <div><label className="label" htmlFor="qn">הערות</label><input id="qn" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
      </div>
    </Modal>
  );
}

function ExtraModal({ projectId, tiers, init, onClose }: { projectId: string; tiers: number[]; init: Partial<ExtraCost>; onClose: () => void }) {
  const [name, setName] = useState(init.name ?? '');
  const [cur, setCur] = useState<Currency>(init.currency ?? 'USD');
  const [burden, setBurden] = useState(init.burden ?? true);
  const [amounts, setAmounts] = useState<Record<string, string>>(Object.fromEntries(tiers.map((t) => [String(t), init.amounts?.[String(t)] != null ? String(init.amounts[String(t)]) : ''])));
  const { run, pending } = useAction();
  return (
    <Modal open onClose={onClose} title={init.id ? 'עריכת עלות נוספת' : 'עלות נוספת'} size="lg"
      footer={<><button className="btn-ghost" onClick={onClose}>ביטול</button>
        <button className="btn" disabled={pending || !name.trim()} onClick={() => run(() => saveExtra(projectId, {
          id: init.id, name, currency: cur, burden, amounts: Object.fromEntries(Object.entries(amounts).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)])),
        }), { ok: 'נשמר', onDone: onClose })}>שמירה</button></>}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="en">שם (למשל: צביעה)</label><input id="en" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
          <div><label className="label" htmlFor="ec">מטבע (שקלים מומרים לפי השער)</label><select id="ec" className="input" value={cur} onChange={(e) => setCur(e.target.value as Currency)}><option>USD</option><option>ILS</option><option>EUR</option></select></div>
        </div>
        <div>
          <span className="label">עלות למערכת לכל מדרגה</span>
          <div className="grid gap-3 sm:grid-cols-5">{tiers.map((t) => <div key={t}><label className="text-xs text-ink/60">{t} מערכות</label><input type="number" min={0} step="any" className="input" dir="ltr" value={amounts[String(t)]} onChange={(e) => setAmounts({ ...amounts, [String(t)]: e.target.value })} /></div>)}</div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={burden} onChange={(e) => setBurden(e.target.checked)} /> להחיל Burden על עלות זו</label>
      </div>
    </Modal>
  );
}
