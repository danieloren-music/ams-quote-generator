'use client';

import { useMemo, useState } from 'react';
import { Mail, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import Modal from '@/components/Modal';
import ConfirmDelete from '@/components/ConfirmDelete';
import { Badge, Empty } from '@/components/ui';
import { useAction } from '@/components/useAction';
import { cn } from '@/lib/format';
import type { Category, Supplier } from '@/lib/types';
import { deleteCategory, deleteSupplier, saveCategory, saveSupplier } from './actions';

const SWATCHES = ['#0f7a89', '#2563eb', '#7c3aed', '#d97706', '#b45309', '#16a34a', '#db2777', '#0891b2', '#475569', '#dc2626'];

export default function SuppliersManager({ categories, suppliers, initialCategory }: { categories: Category[]; suppliers: Supplier[]; initialCategory: string | null }) {
  const [sel, setSel] = useState<string | null>(initialCategory);
  const [q, setQ] = useState('');
  const [catModal, setCatModal] = useState<Partial<Category> | null>(null);
  const [supModal, setSupModal] = useState<Supplier | 'new' | null>(null);
  const [delCat, setDelCat] = useState<Category | null>(null);
  const [delSup, setDelSup] = useState<Supplier | null>(null);
  const { run, pending } = useAction();

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    suppliers.forEach((s) => s.category_ids.forEach((c) => m.set(c, (m.get(c) ?? 0) + 1)));
    return m;
  }, [suppliers]);

  const current = categories.find((c) => c.id === sel) ?? null;
  const list = suppliers.filter((s) => (!sel || s.category_ids.includes(sel)) && (!q || s.name.toLowerCase().includes(q.toLowerCase()) || s.contacts.some((c) => c.email.includes(q.toLowerCase()))));
  const catName = (id: string) => categories.find((c) => c.id === id);

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      {/* קטגוריות */}
      <aside className="card h-fit p-3">
        <div className="mb-2 flex items-center justify-between px-2">
          <h2 className="text-sm font-semibold">קטגוריות</h2>
          <button className="btn btn-sm" onClick={() => setCatModal({ color: SWATCHES[0], requires_rfq: true })}><Plus size={14} /> חדשה</button>
        </div>
        <ul className="space-y-0.5">
          <li>
            <button onClick={() => setSel(null)} className={cn('flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm', !sel ? 'bg-brand-soft font-medium text-brand-dark' : 'hover:bg-paper')}>
              <span>כל הספקים</span><span className="text-xs text-ink/50">{suppliers.length}</span>
            </button>
          </li>
          {categories.map((c) => (
            <li key={c.id} className={cn('group flex items-center rounded-lg', sel === c.id ? 'bg-brand-soft' : 'hover:bg-paper')}>
              <button onClick={() => setSel(c.id)} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                <span className={cn('truncate', sel === c.id && 'font-medium text-brand-dark')}>{c.name}</span>
                <span className="ms-auto text-xs text-ink/50">{counts.get(c.id) ?? 0}</span>
              </button>
              <button className="icon-btn opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => setCatModal(c)} aria-label="עריכת קטגוריה"><Pencil size={14} /></button>
            </li>
          ))}
        </ul>
      </aside>

      {/* ספקים */}
      <section>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1">
            <Search size={16} className="absolute start-3 top-2.5 text-ink/40" />
            <input className="input ps-9" placeholder="חיפוש ספק או מייל…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {current && <button className="btn-ghost" onClick={() => setDelCat(current)}><Trash2 size={15} /> מחיקת הקטגוריה</button>}
          <button className="btn" onClick={() => setSupModal('new')}><Plus size={16} /> ספק חדש</button>
        </div>
        {current && (
          <p className="mb-3 text-sm text-ink/60">
            קטגוריה: <b>{current.name}</b>{current.burden_group ? ` · קבוצת Burden: ${current.burden_group}` : ''}{!current.requires_rfq ? ' · לא דורשת הצעת מחיר' : ''}
          </p>
        )}
        {!list.length ? (
          <Empty title="אין ספקים להצגה" hint={current ? 'הוסיפו ספק ראשון לקטגוריה הזו' : 'הוסיפו את הספק הראשון'}>
            <button className="btn" onClick={() => setSupModal('new')}><Plus size={16} /> ספק חדש</button>
          </Empty>
        ) : (
          <ul className="grid gap-3 xl:grid-cols-2">
            {list.map((s) => (
              <li key={s.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{s.name}</h3>
                    {s.phone && <p className="text-xs text-ink/50" dir="ltr">{s.phone}</p>}
                  </div>
                  <div className="flex shrink-0">
                    <button className="icon-btn" onClick={() => setSupModal(s)} aria-label="עריכה"><Pencil size={15} /></button>
                    <button className="icon-btn hover:text-red-600" onClick={() => setDelSup(s)} aria-label="מחיקה"><Trash2 size={15} /></button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {s.category_ids.map((id) => catName(id)).filter(Boolean).map((c) => <Badge key={c!.id} color={c!.color}>{c!.name}</Badge>)}
                </div>
                <div className="mt-3 space-y-1">
                  {s.contacts.length ? s.contacts.map((c) => (
                    <p key={c.id} className="flex items-center gap-2 text-sm" dir="ltr"><Mail size={13} className="text-ink/40" />{c.email}{c.name && <span className="text-ink/50">({c.name})</span>}</p>
                  )) : <p className="text-sm text-amber-700">אין כתובות מייל, לא ניתן לשלוח לספק זה</p>}
                </div>
                {s.notes && <p className="mt-2 text-xs text-ink/60">{s.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {catModal && <CategoryModal init={catModal} groups={[...new Set(categories.map((c) => c.burden_group).filter(Boolean) as string[])]} onClose={() => setCatModal(null)}
        onDelete={catModal.id ? () => { setDelCat(catModal as Category); setCatModal(null); } : undefined} />}
      {supModal && <SupplierModal init={supModal === 'new' ? null : supModal} categories={categories} defaultCategory={sel} onClose={() => setSupModal(null)} />}

      <ConfirmDelete open={!!delCat} onClose={() => setDelCat(null)} busy={pending} phrase={delCat?.name ?? ''}
        title="מחיקת קטגוריה" description="פריטים בפרויקטים שמשויכים לקטגוריה זו יישארו ללא קטגוריה. הספקים לא יימחקו."
        onConfirm={() => run(() => deleteCategory(delCat!.id, delCat!.name), { ok: 'הקטגוריה נמחקה', onDone: () => { setDelCat(null); setSel(null); } })} />
      <ConfirmDelete open={!!delSup} onClose={() => setDelSup(null)} busy={pending} phrase={delSup?.name ?? ''}
        title="מחיקת ספק" description="הספק וכל כתובות המייל שלו יימחקו. בקשות מחיר היסטוריות יישמרו."
        onConfirm={() => run(() => deleteSupplier(delSup!.id, delSup!.name), { ok: 'הספק נמחק', onDone: () => setDelSup(null) })} />
    </div>
  );
}

function CategoryModal({ init, groups, onClose, onDelete }: { init: Partial<Category>; groups: string[]; onClose: () => void; onDelete?: () => void }) {
  const [name, setName] = useState(init.name ?? '');
  const [color, setColor] = useState(init.color ?? SWATCHES[0]);
  const [group, setGroup] = useState(init.burden_group ?? '');
  const [rfq, setRfq] = useState(init.requires_rfq ?? true);
  const { run, pending } = useAction();
  return (
    <Modal open onClose={onClose} title={init.id ? 'עריכת קטגוריה' : 'קטגוריה חדשה'}
      footer={<>
        {onDelete && <button className="btn-ghost me-auto text-red-600" onClick={onDelete}><Trash2 size={15} /> מחיקה</button>}
        <button className="btn-ghost" onClick={onClose}>ביטול</button>
        <button className="btn" disabled={pending || !name.trim()} onClick={() => run(() => saveCategory({ id: init.id, name, color, burden_group: group || null, requires_rfq: rfq }), { ok: 'נשמר', onDone: onClose })}>שמירה</button>
      </>}>
      <div className="space-y-4">
        <div><label className="label" htmlFor="cn">שם הקטגוריה</label><input id="cn" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
        <div>
          <span className="label">צבע</span>
          <div className="flex flex-wrap gap-2">
            {SWATCHES.map((c) => <button key={c} type="button" aria-label={c} onClick={() => setColor(c)} className={cn('h-7 w-7 rounded-full ring-offset-2', color === c && 'ring-2 ring-ink')} style={{ background: c }} />)}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="cg">קבוצת Burden (קטגוריות באותה קבוצה מחושבות יחד)</label>
          <input id="cg" className="input" list="groups" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="ריק = הקטגוריה לבדה" />
          <datalist id="groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rfq} onChange={(e) => setRfq(e.target.checked)} /> פריטים בקטגוריה זו דורשים הצעת מחיר מספק</label>
      </div>
    </Modal>
  );
}

function SupplierModal({ init, categories, defaultCategory, onClose }: { init: Supplier | null; categories: Category[]; defaultCategory: string | null; onClose: () => void }) {
  const [name, setName] = useState(init?.name ?? '');
  const [phone, setPhone] = useState(init?.phone ?? '');
  const [notes, setNotes] = useState(init?.notes ?? '');
  const [cats, setCats] = useState<string[]>(init?.category_ids ?? (defaultCategory ? [defaultCategory] : []));
  const [emails, setEmails] = useState<{ email: string; name: string }[]>(
    init?.contacts.length ? init.contacts.map((c) => ({ email: c.email, name: c.name ?? '' })) : [{ email: '', name: '' }]
  );
  const { run, pending } = useAction();
  const setE = (i: number, patch: Partial<{ email: string; name: string }>) => setEmails((s) => s.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const toggle = (id: string) => setCats((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Modal open onClose={onClose} title={init ? 'עריכת ספק' : 'ספק חדש'} size="lg"
      footer={<>
        <button className="btn-ghost" onClick={onClose}>ביטול</button>
        <button className="btn" disabled={pending || !name.trim()}
          onClick={() => run(() => saveSupplier({ id: init?.id, name, phone, notes, category_ids: cats, contacts: emails.filter((e) => e.email.trim()).map((e) => ({ email: e.email, name: e.name || null })) }), { ok: 'הספק נשמר', onDone: onClose })}>שמירה</button>
      </>}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="sn">שם הספק</label><input id="sn" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
          <div><label className="label" htmlFor="sp">טלפון</label><input id="sp" className="input" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        </div>
        <div>
          <span className="label">קטגוריות שהספק מספק</span>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button key={c.id} type="button" onClick={() => toggle(c.id)}
                className={cn('rounded-full border px-3 py-1 text-xs transition-colors', cats.includes(c.id) ? 'border-brand bg-brand text-white' : 'border-line bg-white hover:bg-paper')}>{c.name}</button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">כתובות מייל לשליחת בקשות מחיר</span>
          <div className="space-y-2">
            {emails.map((e, i) => (
              <div key={i} className="flex gap-2">
                <input className="input" dir="ltr" type="email" placeholder="name@supplier.com" aria-label="אימייל" value={e.email}
                  onChange={(ev) => setE(i, { email: ev.target.value })}
                  onKeyDown={(ev) => { if (ev.key === 'Enter' && i === emails.length - 1 && e.email.trim()) { ev.preventDefault(); setEmails((s) => [...s, { email: '', name: '' }]); } }} />
                <input className="input max-w-40" placeholder="איש קשר (אופציונלי)" aria-label="איש קשר" value={e.name} onChange={(ev) => setE(i, { name: ev.target.value })} />
                <button className="icon-btn hover:text-red-600" onClick={() => setEmails((s) => (s.length > 1 ? s.filter((_, j) => j !== i) : [{ email: '', name: '' }]))} aria-label="הסרת מייל"><X size={16} /></button>
              </div>
            ))}
          </div>
          <button type="button" className="btn-ghost btn-sm mt-2" onClick={() => setEmails((s) => [...s, { email: '', name: '' }])}><Plus size={14} /> הוספת כתובת מייל</button>
        </div>
        <div><label className="label" htmlFor="snt">הערות</label><textarea id="snt" className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      </div>
    </Modal>
  );
}
