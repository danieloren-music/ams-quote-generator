'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

/** חלון "האם אתה בטוח": דורש הקלדת מילת אישור לפני מחיקה */
export default function ConfirmDelete({
  open, onClose, title, description, phrase, onConfirm, busy,
}: {
  open: boolean; onClose: () => void; title: string; description?: string;
  phrase: string; onConfirm: () => void; busy?: boolean;
}) {
  const [v, setV] = useState('');
  useEffect(() => { if (open) setV(''); }, [open]);
  const ok = v.trim() === phrase.trim();
  return (
    <Modal
      open={open} onClose={onClose} title={title} size="sm"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>ביטול</button>
          <button className="btn-danger" disabled={!ok || busy} onClick={onConfirm}>{busy ? 'מוחק…' : 'מחיקה'}</button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p>{description ?? 'הפעולה אינה ניתנת לביטול.'}</p>
        </div>
        <div>
          <label className="label" htmlFor="confirm-phrase">
            לאישור, יש להקליד: <span className="rounded bg-paper px-1.5 py-0.5 font-mono text-xs">{phrase}</span>
          </label>
          <input id="confirm-phrase" className="input" value={v} onChange={(e) => setV(e.target.value)} autoComplete="off" autoFocus />
        </div>
      </div>
    </Modal>
  );
}
