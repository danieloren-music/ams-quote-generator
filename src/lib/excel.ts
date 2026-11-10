import ExcelJS from 'exceljs';
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
