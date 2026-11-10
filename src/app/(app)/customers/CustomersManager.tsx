'use client';

import { useState } from 'react';
import { Mail, Pencil, Phone, Plus, Search, Trash2, User } from 'lucide-react';
import ConfirmDelete from '@/components/ConfirmDelete';
import Modal from '@/components/Modal';
import { Empty } from '@/components/ui';
import { useAction } from '@/components/useAction';
import type { Customer } from '@/lib/types';
import { deleteCustomer, saveCustomer } from './actions';

export default function CustomersManager({ customers, counts }: { customers: Customer[]; counts: Record<string, number> }) {
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Partial<Customer> | null>(null);
  const [del, setDel] = useState<Customer | null>(null);
  const { run, pending } = useAction();
  const list = customers.filter((c) => !q || `${c.name} ${c.contact_name ?? ''} ${c.email ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-52 flex-1">
          <Search size={16} className="absolute start-3 top-2.5 text-ink/40" />
          <input className="input ps-9" placeholder="חיפוש לקוח…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn" onClick={() => setEdit({})}><Plus size={16} /> לקוח חדש</button>
      </div>

      {!list.length ? (
        <Empty title={customers.length ? 'לא נמצאו לקוחות' : 'עדיין אין לקוחות'} hint="הוסיפו לקוח כדי לשייך אליו פרויקטים">
          {!customers.length && <button className="btn" onClick={() => setEdit({})}><Plus size={16} /> לקוח חדש</button>}
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <div key={c.id} className="card group p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{c.name}</h3>
                <span className="flex">
                  <button className="icon-btn" aria-label="עריכה" onClick={() => setEdit(c)}><Pencil size={15} /></button>
                  <button className="icon-btn hover:text-red-600" aria-label="מחיקה" onClick={() => setDel(c)}><Trash2 size={15} /></button>
                </span>
              </div>
              <div className="mt-2 space-y-1 text-sm text-ink/70">
                {c.contact_name && <p className="flex items-center gap-2"><User size={14} className="text-ink/40" />{c.contact_name}</p>}
                {c.email && <p className="flex items-center gap-2" dir="ltr"><Mail size={14} className="text-ink/40" />{c.email}</p>}
                {c.phone && <p className="flex items-center gap-2" dir="ltr"><Phone size={14} className="text-ink/40" />{c.phone}</p>}
                {c.notes && <p className="line-clamp-2 text-xs text-ink/50">{c.notes}</p>}
              </div>
              <p className="mt-3 text-xs text-ink/50">{counts[c.id] ?? 0} פרויקטים</p>
            </div>
          ))}
        </div>
      )}

      {edit && <CustomerModal init={edit} onClose={() => setEdit(null)} />}
      <ConfirmDelete open={!!del} onClose={() => setDel(null)} busy={pending} phrase={del?.name ?? ''} title="מחיקת לקוח"
        description="הלקוח יימחק מהרשימה. הפרויקטים שלו יישארו, עם שם הלקוח כטקסט."
        onConfirm={() => run(() => deleteCustomer(del!.id, del!.name), { ok: 'הלקוח נמחק', onDone: () => setDel(null) })} />
    </>
  );
}

function CustomerModal({ init, onClose }: { init: Partial<Customer>; onClose: () => void }) {
  const [f, setF] = useState({
    name: init.name ?? '', contact_name: init.contact_name ?? '', email: init.email ?? '', phone: init.phone ?? '', notes: init.notes ?? '',
  });
  const { run, pending } = useAction();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} title={init.id ? 'עריכת לקוח' : 'לקוח חדש'}
      footer={<>
        <button className="btn-ghost" onClick={onClose}>ביטול</button>
        <button className="btn" disabled={pending || !f.name.trim()}
          onClick={() => run(() => saveCustomer({ id: init.id, name: f.name, contact_name: f.contact_name || null, email: f.email || null, phone: f.phone || null, notes: f.notes || null }),
            { ok: 'נשמר', onDone: onClose })}>שמירה</button>
      </>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="label" htmlFor="cu-n">שם הלקוח</label><input id="cu-n" className="input" value={f.name} onChange={set('name')} placeholder="KLA / CAMTEK" autoFocus /></div>
        <div><label className="label" htmlFor="cu-c">איש קשר</label><input id="cu-c" className="input" value={f.contact_name} onChange={set('contact_name')} /></div>
        <div><label className="label" htmlFor="cu-p">טלפון</label><input id="cu-p" className="input" dir="ltr" value={f.phone} onChange={set('phone')} /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="cu-e">מייל</label><input id="cu-e" type="email" className="input" dir="ltr" value={f.email} onChange={set('email')} /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="cu-t">הערות</label><textarea id="cu-t" rows={2} className="input" value={f.notes} onChange={set('notes')} /></div>
      </div>
    </Modal>
  );
}
