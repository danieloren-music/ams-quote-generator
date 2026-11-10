import ExcelJS from 'exceljs';
import { UserError } from './action';
import type { Summary } from './pricing';

/* ---------- עזרים ---------- */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cellText(v: any): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t: { text: string }) => t.text).join('').trim();
    if ('result' in v && v.result != null) return cellText(v.result);
    if (v.text != null) return String(v.text).trim();
    return '';
  }
  return String(v).trim();
}

const norm = (s: string) => s.toLowerCase().replace(/["'`״׳]/g, '').replace(/\s+/g, ' ').trim();

const COLS: Record<string, string[]> = {
  level: ['level', 'lvl', 'רמה', 'רמה בעץ'],
  qty: ['quantity', 'qty', 'כמות', 'יחס לאב'],
  item: ['item', 'part number', 'part no', 'part', 'p/n', 'pn', 'מקט', 'מקט לקוח'],
  rev: ['revision', 'rev', 'רויזיה'],
  desc: ['description', 'desc', 'תיאור', 'תאור מוצר'],
  uom: ['uom', 'יחידת מידה'],
  mpn: ['mpn', 'manufacturer part number'],
  mfr: ['manufacturer', 'mfr', 'יצרן'],
};

export interface ParsedItem {
  item: string;
  revision: string | null;
  description: string | null;
  uom: string | null;
  mpn: string | null;
  manufacturer: string | null;
  level: number;
  total_qty: number;
  occurrences: number;
  is_assembly: boolean;
  row_index: number;
}

export async function parseBom(buf: Buffer): Promise<{ items: ParsedItem[]; rows: number }> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
  } catch {
    throw new UserError('לא ניתן לקרוא את הקובץ. ודאו שזה קובץ Excel (.xlsx) תקין');
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new UserError('הקובץ ריק');

  // איתור שורת כותרות
  let headerRow = 0;
  const colIdx: Record<string, number> = {};
  for (let r = 1; r <= Math.min(25, ws.rowCount) && !headerRow; r++) {
    const found: Record<string, number> = {};
    ws.getRow(r).eachCell((cell, c) => {
      const t = norm(cellText(cell.value));
      if (!t) return;
      for (const [k, syn] of Object.entries(COLS)) if (!(k in found) && syn.includes(t)) found[k] = c;
    });
    if ('item' in found && ('qty' in found || 'desc' in found)) {
      headerRow = r;
      Object.assign(colIdx, found);
    }
  }
  if (!headerRow) throw new UserError('לא זוהתה שורת כותרות עם עמודת Item/מק"ט וכמות. בדקו את הקובץ');

  const get = (row: ExcelJS.Row, k: string) => (colIdx[k] ? cellText(row.getCell(colIdx[k]).value) : '');
  type R = { item: string; rev: string; desc: string; uom: string; mpn: string; mfr: string; level: number; qty: number; ext: number; asm: boolean; idx: number };
  const rows: R[] = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const item = get(row, 'item');
    if (!item) continue;
    const lvl = parseInt(get(row, 'level').replace(/\D/g, ''), 10);
    const q = parseFloat(get(row, 'qty').replace(',', '.'));
    rows.push({
      item: item.slice(0, 120), rev: get(row, 'rev'), desc: get(row, 'desc'), uom: get(row, 'uom'),
      mpn: get(row, 'mpn'), mfr: get(row, 'mfr'),
      level: Number.isFinite(lvl) && lvl > 0 ? lvl : 1,
      qty: Number.isFinite(q) && q >= 0 ? q : 1, ext: 0, asm: false, idx: r,
    });
  }
  if (!rows.length) throw new UserError('לא נמצאו שורות פריטים בקובץ');
  if (rows.length > 5000) throw new UserError('הקובץ גדול מדי (מעל 5,000 שורות)');

  // כמות מצטברת לאורך העץ + זיהוי הרכבות
  const mult: number[] = [];
  rows.forEach((r, i) => {
    const parent = r.level > 1 ? mult[r.level - 1] ?? 1 : 1;
    r.ext = r.qty * parent;
    mult[r.level] = r.ext;
    const next = rows[i + 1];
    r.asm = !!next && next.level > r.level;
  });

  // איחוד לפי מק"ט
  const map = new Map<string, ParsedItem>();
  for (const r of rows) {
    const key = r.item.toUpperCase();
    const ex = map.get(key);
    if (ex) {
      ex.total_qty += r.ext;
      ex.occurrences += 1;
      ex.level = Math.min(ex.level, r.level);
      ex.is_assembly = ex.is_assembly || r.asm;
    } else {
      map.set(key, {
        item: r.item, revision: r.rev || null, description: r.desc || null, uom: r.uom || null,
        mpn: r.mpn || null, manufacturer: r.mfr || null, level: r.level, total_qty: r.ext,
        occurrences: 1, is_assembly: r.asm, row_index: r.idx,
      });
    }
  }
  return { items: [...map.values()], rows: rows.length };
}

/* ---------- קובץ RFQ לספק ---------- */
export interface RfqRow { item: string; revision: string | null; description: string | null; mpn: string | null; manufacturer: string | null; total_qty: number }

export async function buildRfqXlsx(o: {
  ref: string; project: string; supplier: string; category: string; tiers: number[]; items: RfqRow[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('RFQ');
  const bold = { bold: true };
  ws.addRow(['Request for Quotation']).font = { bold: true, size: 14 };
  ws.addRow(['Reference', o.ref]).getCell(1).font = bold;
  ws.addRow(['Project', o.project]).getCell(1).font = bold;
  ws.addRow(['Supplier', o.supplier]).getCell(1).font = bold;
  ws.addRow(['Category', o.category]).getCell(1).font = bold;
  ws.addRow(['Please fill the yellow cells: unit price (or pack price) per quantity, MOQ / pack size, lead time.']);
  ws.addRow([]);

  const head = ['#', 'Part Number', 'Rev', 'Description', 'MPN', 'Manufacturer', 'Qty / system'];
  o.tiers.forEach((t) => head.push(`Qty pcs @ ${t} systems`, `Unit price @ ${t} systems`));
  head.push('Price basis (unit / pack)', 'Pack size / MOQ', 'Lead time (days)', 'Currency', 'Notes');
  const hr = ws.addRow(head);
  hr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F7A89' } };
  hr.alignment = { wrapText: true, vertical: 'middle' };
  const headerRowNum = hr.number;

  o.items.forEach((it, i) => {
    const row: (string | number | null)[] = [i + 1, it.item, it.revision, it.description, it.mpn, it.manufacturer, it.total_qty];
    o.tiers.forEach((t) => row.push(it.total_qty * t, null));
    row.push(null, null, null, null, null);
    ws.addRow(row);
  });

  const widths = [5, 18, 6, 38, 20, 20, 10];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  for (let c = widths.length + 1; c <= head.length; c++) ws.getColumn(c).width = 16;
  const yellow = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFF6CC' } };
  for (let r = headerRowNum + 1; r <= ws.rowCount; r++) {
    o.tiers.forEach((_, ti) => (ws.getCell(r, 8 + ti * 2 + 1).fill = yellow));
    for (let c = 8 + o.tiers.length * 2; c <= head.length; c++) ws.getCell(r, c).fill = yellow;
  }
  ws.views = [{ state: 'frozen', ySplit: headerRowNum }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* ---------- ייצוא הצעת מחיר ---------- */
export async function buildQuoteXlsx(o: {
  project: string; customer: string | null; exclusions: string; summary: Summary;
  rows: { category: string; group: string; item: string; description: string; qty: number; supplier: string; lead: number | null; status: string; perSystem: (number | null)[] }[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const money = '#,##0.00';
  const S = o.summary;

  const sum = wb.addWorksheet('Quote');
  sum.addRow([`Quotation – ${o.project}`]).font = { bold: true, size: 14 };
  if (o.customer) sum.addRow(['Customer', o.customer]);
  sum.addRow([]);
  const h = sum.addRow(['', ...S.tiers.map((t) => `${t} systems`)]);
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F7A89' } };
  const add = (label: string, vals: number[], b = false) => {
    const r = sum.addRow([label, ...vals]);
    r.font = { bold: b };
    for (let c = 2; c <= S.tiers.length + 1; c++) r.getCell(c).numFmt = money;
  };
  S.groups.forEach((g) => { add(g.name, g.totals); add('  Burden', g.burden); });
  S.extras.forEach((g) => { add(g.name, g.totals); if (g.burden.some((x) => x)) add('  Burden', g.burden); });
  add('Total BOM', S.bomTotal, true);
  add('Burden', S.burdenTotal);
  add('BOM + Burden', S.materials, true);
  add('Labor hours', S.laborHours);
  add('Labor', S.labor);
  add('OH', S.oh);
  add('Sub total', S.subtotal, true);
  add('Profit', S.profit);
  add('TOTAL PRICE / system (USD)', S.total, true);
  sum.addRow([]);
  o.exclusions.split('\n').forEach((l) => sum.addRow([l]));
  sum.getColumn(1).width = 34;
  S.tiers.forEach((_, i) => (sum.getColumn(i + 2).width = 14));

  const ws = wb.addWorksheet('Items');
  const hr = ws.addRow(['Category', 'Group', 'Part Number', 'Description', 'Qty / system', 'Supplier', 'Lead time (days)', 'Status', ...S.tiers.map((t) => `Cost/system @ ${t}`)]);
  hr.font = { bold: true };
  o.rows.forEach((r) => {
    const row = ws.addRow([r.category, r.group, r.item, r.description, r.qty, r.supplier, r.lead, r.status, ...r.perSystem]);
    for (let c = 9; c <= 8 + S.tiers.length; c++) row.getCell(c).numFmt = money;
  });
  [18, 20, 18, 40, 10, 20, 12, 12].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 8 + S.tiers.length } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* ---------- Excel -> טקסט (לפענוח תשובות ספקים) ---------- */
export async function xlsxToText(buf: Buffer): Promise<string> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const out: string[] = [];
  wb.worksheets.slice(0, 3).forEach((ws) => {
    out.push(`## ${ws.name}`);
    for (let r = 1; r <= Math.min(ws.rowCount, 600); r++) {
      const vals: string[] = [];
      ws.getRow(r).eachCell({ includeEmpty: true }, (c) => vals.push(cellText(c.value)));
      if (vals.some(Boolean)) out.push(vals.join(' | '));
    }
  });
  return out.join('\n').slice(0, 120_000);
}
