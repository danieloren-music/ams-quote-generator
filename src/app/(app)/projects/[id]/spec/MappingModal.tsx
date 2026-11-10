'use client';

import { useMemo, useState } from 'react';
import Modal from '@/components/Modal';
import { cn } from '@/lib/format';
import { MAPPABLE, colLetter, type Cols, type Field, type MappingInput, type MappingRequest } from '@/lib/bom-fields';

/** חלון התאמת עמודות ידנית: מופיע כשהזיהוי האוטומטי לא מצא עמודת מק"ט */
export default function MappingModal({ req, busy, onClose, onConfirm }: {
  req: MappingRequest; busy: boolean; onClose: () => void; onConfirm: (m: MappingInput) => void;
}) {
  const [sheetName, setSheetName] = useState(req.sheets[0].name);
  const sheet = req.sheets.find((s) => s.name === sheetName) ?? req.sheets[0];
  const [headerRow, setHeaderRow] = useState(sheet.headerRow);
  const [cols, setCols] = useState<Cols>(sheet.suggested);

  const pick = (name: string) => {
    const s = req.sheets.find((x) => x.name === name)!;
    setSheetName(name);
    setHeaderRow(s.headerRow);
    setCols(s.suggested);
  };

  const width = Math.max(1, ...sheet.preview.map((r) => r.length));
  const options = useMemo(() => {
    const head = sheet.preview[headerRow - 1] ?? [];
    const body = sheet.preview.slice(headerRow);
    return Array.from({ length: width }, (_, i) => {
      const sample = body.map((r) => r[i]).find(Boolean) ?? '';
      return { col: i + 1, label: `${colLetter(i + 1)} · ${head[i] || '—'}${sample ? `  (${sample.slice(0, 18)})` : ''}` };
    });
  }, [sheet, headerRow, width]);

  const set = (f: Field, v: string) => setCols((c) => {
    const n = { ...c };
    if (v) n[f] = Number(v); else delete n[f];
    return n;
  });

  return (
    <Modal open onClose={onClose} title="התאמת עמודות" size="xl"
      footer={<>
        <button className="btn-ghost" onClick={onClose}>ביטול</button>
        <button className="btn" disabled={busy || !cols.item} onClick={() => onConfirm({ sheet: sheet.name, headerRow, cols })}>
          {busy ? 'קולט…' : 'קליטת ה-BOM'}
        </button>
      </>}>
      <div className="space-y-4">
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{req.reason}. בחרו איזו עמודה מכילה כל נתון, והמערכת תקלוט לפי זה.</p>

        <div className="grid gap-3 sm:grid-cols-2">
          {req.sheets.length > 1 && (
            <div>
              <label className="label" htmlFor="m-sheet">גיליון</label>
              <select id="m-sheet" className="input" value={sheet.name} onChange={(e) => pick(e.target.value)}>
                {req.sheets.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label" htmlFor="m-head">שורת הכותרות</label>
            <select id="m-head" className="input" value={headerRow} onChange={(e) => setHeaderRow(Number(e.target.value))}>
              {sheet.preview.map((_, i) => <option key={i} value={i + 1}>שורה {i + 1}</option>)}
            </select>
          </div>
        </div>

        <div className="max-h-56 overflow-auto rounded-lg border border-line" dir="ltr">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-paper"><tr>
              <th className="th w-8">#</th>
              {Array.from({ length: width }, (_, i) => <th key={i} className="th">{colLetter(i + 1)}</th>)}
            </tr></thead>
            <tbody>
              {sheet.preview.slice(0, 10).map((r, ri) => (
                <tr key={ri} className={cn(ri + 1 === headerRow && 'bg-brand-soft font-semibold')}>
                  <td className="td text-ink/40">{ri + 1}</td>
                  {Array.from({ length: width }, (_, i) => <td key={i} className="td max-w-[10rem] truncate py-1">{r[i] ?? ''}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {MAPPABLE.map(({ field, label, required }) => (
            <div key={field}>
              <label className="label" htmlFor={`m-${field}`}>{label}{required && <span className="text-red-600"> *</span>}</label>
              <select id={`m-${field}`} className="input" dir="ltr" value={cols[field] ?? ''} onChange={(e) => set(field, e.target.value)}>
                <option value="">{required ? 'בחרו עמודה…' : 'ללא'}</option>
                {options.map((o) => <option key={o.col} value={o.col}>{o.label}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
