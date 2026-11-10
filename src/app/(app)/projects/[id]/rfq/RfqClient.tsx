'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck, Download, Mail, Send, Trash2, Truck } from 'lucide-react';
import ConfirmDelete from '@/components/ConfirmDelete';
import Modal from '@/components/Modal';
import { Badge, Empty } from '@/components/ui';
import { useAction } from '@/components/useAction';
import { cn, dateHe, num } from '@/lib/format';
import { toast } from '@/lib/toast';
import { RFQ_STATUS_LABELS, type BomItem, type Category, type Rfq, type Supplier } from '@/lib/types';
import { createRfqs, deleteRfq, markRfqSent, type RfqResult } from '../rfq-actions';

export type RfqRow = Pick<Rfq, 'id' | 'ref_code' | 'subject' | 'status' | 'sent_via' | 'sent_at' | 'replied_at' | 'created_at' | 'category_id' | 'to_emails'> & { supplier_name: string; item_count: number };
type Tpl = { subject: string; body: string };

const mailto = (to: string[], subject: string, body: string) =>
  `mailto:${to.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
const tone = { draft: 'gray', sent: 'amber', replied: 'green', closed: 'gray' } as const;

export default function RfqClient({ projectId, tiers, items, categories, suppliers, rfqs, priced, canSend, templates }: {
  projectId: string; tiers: number[]; items: BomItem[]; categories: Category[]; suppliers: Supplier[]; rfqs: RfqRow[]; priced: string[];
  canSend: boolean; templates: { he: Tpl; en: Tpl };
}) {
  const { run, pending } = useAction();
  const pricedSet = useMemo(() => new Set(priced), [priced]);
  const rfqItems = items.filter((i) => i.sourcing === 'rfq');
  const byCat = (id: string) => rfqItems.filter((i) => i.category_id === id);
  const cats = categories.filter((c) => byCat(c.id).length > 0);
  const uncategorized = rfqItems.filter((i) => !i.category_id).length;

  const [catId, setCatId] = useState<string | null>(cats[0]?.id ?? null);
  const [selItems, setSelItems] = useState<Set<string>>(new Set());
  const [selSup, setSelSup] = useState<Set<string>>(new Set());
  const [compose, setCompose] = useState(false);
  const [results, setResults] = useState<RfqResult[] | null>(null);
  const [delRfq, setDelRfq] = useState<RfqRow | null>(null);

  const catItems = catId ? byCat(catId) : [];
  const catSups = suppliers.filter((s) => catId && s.category_ids.includes(catId));
  useEffect(() => { setSelItems(new Set(catItems.filter((i) => !pricedSet.has(i.id)).map((i) => i.id))); setSelSup(new Set()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [catId, items.length]);

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, v: string) => { const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); setter(n); };
  const category = categories.find((c) => c.id === catId);

  if (!rfqItems.length && !rfqs.length)
    return <Empty title="אין פריטים לשליחה לספקים" hint="העלו BOM וסווגו אותו לקטגוריות"><Link href={`/projects/${projectId}/categories`} className="btn">לחלוקת קטגוריות</Link></Empty>;

  return (
    <div className="space-y-8">
      {!canSend && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          שליחה ישירה מהמערכת אינה מוגדרת (Resend). בלחיצה על "הכנת מיילים" ייווצר לכל ספק מייל מוכן לפתיחה בתוכנת המייל, וקובץ Excel מצורף להורדה.
        </div>
      )}
      {uncategorized > 0 && <p className="text-sm text-amber-700">{uncategorized} פריטים עדיין ללא קטגוריה ולכן לא מופיעים כאן. <Link className="underline" href={`/projects/${projectId}/categories`}>לסיווג</Link></p>}

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <aside className="card h-fit p-2">
          <h2 className="px-2 py-1 text-sm font-semibold">קטגוריות</h2>
          <ul className="space-y-0.5">
            {cats.map((c) => {
              const its = byCat(c.id);
              const done = its.filter((i) => pricedSet.has(i.id)).length;
              const sent = rfqs.filter((r) => r.category_id === c.id).length;
              return (
                <li key={c.id}>
                  <button onClick={() => setCatId(c.id)} className={cn('w-full rounded-lg px-3 py-2 text-start text-sm', catId === c.id ? 'bg-brand-soft' : 'hover:bg-paper')}>
                    <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} /><span className="truncate font-medium">{c.name}</span></span>
                    <span className="mt-0.5 block ps-4 text-xs text-ink/50">{its.length} פריטים · {done} עם מחיר{sent ? ` · ${sent} בקשות` : ''}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {category ? (
          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{category.name}</h2>
              <button className="btn" disabled={!selItems.size || !selSup.size} onClick={() => setCompose(true)}>
                <Send size={16} /> {canSend ? 'שליחה לספקים' : 'הכנת מיילים'} ({selSup.size} ספקים · {selItems.size} פריטים)
              </button>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <div className="card">
                <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                  <h3 className="text-sm font-semibold">פריטים לבקשה</h3>
                  <button className="text-xs text-brand hover:underline" onClick={() => setSelItems(selItems.size === catItems.length ? new Set() : new Set(catItems.map((i) => i.id)))}>{selItems.size === catItems.length ? 'נקה הכל' : 'בחר הכל'}</button>
                </div>
                <ul className="max-h-96 divide-y divide-line overflow-y-auto">
                  {catItems.map((i) => (
                    <li key={i.id}>
                      <label className="flex cursor-pointer items-start gap-2.5 px-4 py-2 text-sm hover:bg-paper">
                        <input type="checkbox" className="mt-1" checked={selItems.has(i.id)} onChange={() => toggle(selItems, setSelItems, i.id)} />
                        <span className="min-w-0 flex-1"><b dir="ltr" className="block">{i.item}</b><span className="block truncate text-xs text-ink/60" dir="ltr">{i.description}</span></span>
                        <span className="text-xs text-ink/50">x{num(i.total_qty)}</span>
                        {pricedSet.has(i.id) && <Badge tone="green">יש מחיר</Badge>}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card">
                <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                  <h3 className="text-sm font-semibold">ספקים בקטגוריה</h3>
                  <Link href={`/suppliers?category=${catId}`} className="text-xs text-brand hover:underline">+ ספק חדש</Link>
                </div>
                {!catSups.length ? (
                  <p className="p-6 text-center text-sm text-ink/60">אין ספקים בקטגוריה. <Link className="text-brand underline" href={`/suppliers?category=${catId}`}>הוסיפו ספק</Link></p>
                ) : (
                  <ul className="divide-y divide-line">
                    {catSups.map((s) => (
                      <li key={s.id}>
                        <label className={cn('flex items-start gap-2.5 px-4 py-3 text-sm', s.contacts.length ? 'cursor-pointer hover:bg-paper' : 'opacity-60')}>
                          <input type="checkbox" className="mt-1" disabled={!s.contacts.length} checked={selSup.has(s.id)} onChange={() => toggle(selSup, setSelSup, s.id)} />
                          <span className="min-w-0 flex-1"><b className="flex items-center gap-1.5"><Truck size={13} className="text-ink/40" />{s.name}</b>
                            <span className="block truncate text-xs text-ink/60" dir="ltr">{s.contacts.length ? s.contacts.map((c) => c.email).join(', ') : 'אין כתובת מייל'}</span></span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        ) : <Empty title="בחרו קטגוריה" />}
      </div>

      <section>
        <h2 className="mb-3 font-semibold">היסטוריית בקשות <span className="text-sm font-normal text-ink/50">({rfqs.length})</span></h2>
        {!rfqs.length ? <Empty title="עדיין לא נשלחו בקשות" /> : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="border-b border-line bg-paper/60"><tr>{['קוד', 'ספק', 'קטגוריה', 'פריטים', 'סטטוס', 'תאריך', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {rfqs.map((r) => {
                  const c = categories.find((x) => x.id === r.category_id);
                  return (
                    <tr key={r.id}>
                      <td className="td font-mono text-xs" dir="ltr">{r.ref_code}</td>
                      <td className="td font-medium">{r.supplier_name}</td>
                      <td className="td">{c ? <Badge color={c.color}>{c.name}</Badge> : '—'}</td>
                      <td className="td">{r.item_count}</td>
                      <td className="td"><Badge tone={tone[r.status]}>{RFQ_STATUS_LABELS[r.status]}</Badge></td>
                      <td className="td text-xs text-ink/60">{dateHe(r.sent_at ?? r.created_at)}</td>
                      <td className="td whitespace-nowrap">
                        <a className="icon-btn" href={`/api/rfqs/${r.id}/attachment`} title="הורדת הקובץ שנשלח" aria-label="הורדת קובץ"><Download size={15} /></a>
                        {r.status === 'draft' && <>
                          <a className="icon-btn" href={mailto(r.to_emails, r.subject, '')} title="פתיחה בתוכנת המייל" aria-label="פתיחה במייל"><Mail size={15} /></a>
                          <button className="icon-btn" title="סימון כנשלח" aria-label="סימון כנשלח" disabled={pending} onClick={() => run(() => markRfqSent(projectId, r.id), { ok: 'סומן כנשלח' })}><CheckCheck size={15} /></button>
                        </>}
                        {r.status === 'sent' && (
                          <a className="icon-btn" title="תזכורת לספק" aria-label="תזכורת" href={mailto(r.to_emails, `Reminder: ${r.subject}`, `Hello,\n\nA gentle reminder regarding our request for quotation ${r.ref_code}. Please send your quotation at your earliest convenience.\nשלום, תזכורת לבקשת הצעת המחיר ${r.ref_code}.\n\nThank you`)}><Bell size={15} /></a>
                        )}
                        <button className="icon-btn hover:text-red-600" aria-label="מחיקה" onClick={() => setDelRfq(r)}><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {compose && category && (
        <ComposeModal projectId={projectId} tiers={tiers} category={category} canSend={canSend} templates={templates}
          suppliers={catSups.filter((s) => selSup.has(s.id))} itemIds={[...selItems]} onClose={() => setCompose(false)}
          onResults={(r) => { setCompose(false); setResults(r); }} />
      )}
      {results && <ResultsModal results={results} projectId={projectId} canSend={canSend} onClose={() => setResults(null)} />}
      <ConfirmDelete open={!!delRfq} onClose={() => setDelRfq(null)} busy={pending} phrase={delRfq?.ref_code ?? ''} title="מחיקת בקשת מחיר"
        description="הבקשה תימחק מההיסטוריה. הצעות מחיר שכבר נקלטו ממנה יישארו."
        onConfirm={() => run(() => deleteRfq(projectId, delRfq!.id, delRfq!.ref_code), { ok: 'נמחק', onDone: () => setDelRfq(null) })} />
    </div>
  );
}

function ComposeModal({ projectId, tiers, category, suppliers, itemIds, canSend, templates, onClose, onResults }: {
  projectId: string; tiers: number[]; category: Category; suppliers: Supplier[]; itemIds: string[]; canSend: boolean;
  templates: { he: Tpl; en: Tpl }; onClose: () => void; onResults: (r: RfqResult[]) => void;
}) {
  const [lang, setLang] = useState<'he' | 'en'>('he');
  const [subject, setSubject] = useState(templates.he.subject);
  const [body, setBody] = useState(templates.he.body);
  const [emails, setEmails] = useState<Record<string, Set<string>>>(() => Object.fromEntries(suppliers.map((s) => [s.id, new Set(s.contacts.map((c) => c.email))])));
  const { run, pending } = useAction();
  const switchLang = (l: 'he' | 'en') => { setLang(l); setSubject(templates[l].subject); setBody(templates[l].body); };
  const tgl = (sid: string, e: string) => setEmails((m) => { const n = new Set(m[sid]); n.has(e) ? n.delete(e) : n.add(e); return { ...m, [sid]: n }; });
  const noRecipients = suppliers.some((s) => emails[s.id].size === 0);

  return (
    <Modal open onClose={onClose} title={`בקשת הצעת מחיר – ${category.name}`} size="lg"
      footer={<><button className="btn-ghost" onClick={onClose}>ביטול</button>
        <button className="btn" disabled={pending || noRecipients || !subject.trim() || !body.trim()}
          onClick={() => run(() => createRfqs(projectId, {
            category_id: category.id, supplier_ids: suppliers.map((s) => s.id), item_ids: itemIds,
            emails: Object.fromEntries(suppliers.map((s) => [s.id, [...emails[s.id]]])), subject, body,
          }), { refresh: true, onDone: (r) => r && onResults(r) })}>
          <Send size={15} /> {pending ? 'מעבד…' : canSend ? 'שליחה' : 'יצירת מיילים'}
        </button></>}>
      <div className="space-y-4">
        <div>
          <span className="label">נמענים</span>
          <ul className="space-y-2">
            {suppliers.map((s) => (
              <li key={s.id} className="rounded-lg border border-line p-2.5">
                <b className="text-sm">{s.name}</b>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {s.contacts.map((c) => (
                    <label key={c.id} className="flex items-center gap-1.5 text-xs" dir="ltr"><input type="checkbox" checked={emails[s.id].has(c.email)} onChange={() => tgl(s.id, c.email)} />{c.email}</label>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          {noRecipients && <p className="mt-1 text-xs text-red-600">יש לבחור לפחות כתובת אחת לכל ספק</p>}
        </div>
        <div className="flex items-center justify-between">
          <span className="label mb-0">תוכן ההודעה</span>
          <div className="flex overflow-hidden rounded-lg border border-line text-xs">
            {(['he', 'en'] as const).map((l) => <button key={l} className={cn('px-3 py-1', lang === l ? 'bg-brand text-white' : 'bg-white')} onClick={() => switchLang(l)}>{l === 'he' ? 'עברית' : 'English'}</button>)}
          </div>
        </div>
        <input className="input" aria-label="נושא" value={subject} onChange={(e) => setSubject(e.target.value)} dir={lang === 'en' ? 'ltr' : 'rtl'} />
        <textarea className="input" rows={10} aria-label="גוף ההודעה" value={body} onChange={(e) => setBody(e.target.value)} dir={lang === 'en' ? 'ltr' : 'rtl'} />
        <p className="text-xs text-ink/50">
          המשתנים <code dir="ltr">{'{{supplier}} {{ref}} {{project}} {{category}} {{tiers}}'}</code> יוחלפו אוטומטית לכל ספק. יצורף קובץ Excel עם {itemIds.length} פריטים וכמויות לפי המדרגות ({tiers.join(', ')} מערכות), וחתימה מההגדרות.
        </p>
      </div>
    </Modal>
  );
}

function ResultsModal({ results, projectId, canSend, onClose }: { results: RfqResult[]; projectId: string; canSend: boolean; onClose: () => void }) {
  const { run, pending } = useAction();
  const [marked, setMarked] = useState<Set<string>>(new Set());
  useEffect(() => { if (results.every((r) => r.sent)) toast('כל הבקשות נשלחו'); }, [results]);
  return (
    <Modal open onClose={onClose} title={canSend ? 'תוצאות השליחה' : 'המיילים מוכנים'} size="lg" footer={<button className="btn" onClick={onClose}>סגירה</button>}>
      <ul className="space-y-3">
        {results.map((r, i) => (
          <li key={i} className="rounded-lg border border-line p-3">
            <div className="flex items-center justify-between gap-2">
              <b>{r.supplier}</b>
              {r.sent ? <Badge tone="green">נשלח</Badge> : r.error ? <Badge tone="red">{r.error}</Badge> : <Badge tone="amber">טיוטה</Badge>}
            </div>
            {r.rfq_id && !r.sent && (
              <div className="mt-2 flex flex-wrap gap-2">
                <a className="btn btn-sm" href={mailto(r.to, r.subject, r.body)}><Mail size={14} /> פתיחה בתוכנת המייל</a>
                <a className="btn-ghost btn-sm" href={`/api/rfqs/${r.rfq_id}/attachment`}><Download size={14} /> הורדת קובץ Excel</a>
                <button className="btn-ghost btn-sm" disabled={pending || marked.has(r.rfq_id)} onClick={() => run(() => markRfqSent(projectId, r.rfq_id), { ok: 'סומן כנשלח', onDone: () => setMarked(new Set(marked).add(r.rfq_id)) })}>
                  <CheckCheck size={14} /> {marked.has(r.rfq_id) ? 'סומן כנשלח' : 'סימון כנשלח'}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {!canSend && <p className="mt-3 text-xs text-ink/60">צרפו ידנית את קובץ ה-Excel למייל שנפתח. קוד הבקשה כבר מופיע בנושא, וכך המערכת תזהה את התשובה.</p>}
    </Modal>
  );
}
