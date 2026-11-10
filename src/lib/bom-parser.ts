import ExcelJS from 'exceljs';
import { UserError } from './action';
import { cellText } from './excel';
import type { Cols, Field, MappingInput, MappingRequest } from './bom-fields';

/* =====================================================================
   פענוח BOM דינמי
   - זיהוי כותרות לפי מילים נרדפות (עברית/אנגלית), התאמה מדויקת או חלקית
   - עמודת "מק"ט" נבחרת לפי עדיפות: Component Number > Part Number > Item
     ("Item Number" ב-SAP הוא בדרך כלל מספר שורה ולא מק"ט)
   - תמיכה בכל פורמטי הרמה: 1 / .1 / ..2 / 1.2.3 / "Level 2"
   - שורות חלופות (בלי מק"ט, עם MPN/יצרן) מצורפות לפריט שמעליהן
   - כמות מצטברת לפי עץ ה-BOM, בלי תלות במספור הרמות
   - בחירת הגיליון המתאים, ואם אין זיהוי: מיפוי ידני בממשק
   ===================================================================== */

type SynField = Field | 'ignore';

/** מילים נרדפות לכל שדה, לפי עדיפות (tier 0 = הכי חזק). הטקסט כבר מנורמל (ראו norm) */
const SYN: Record<SynField, string[][]> = {
  item: [
    [
      'component number', 'component no', 'component num', 'component', 'comp number', 'comp no',
      'part number', 'part no', 'part num', 'part', 'part code', 'part id', 'p n', 'pn',
      'catalog number', 'catalog no', 'catalogue number', 'cat no', 'sku',
      'internal part number', 'our part number', 'ams part number',
      'מקט', 'מקט פריט', 'מקט רכיב', 'מקט מלא', 'מספר רכיב', 'מספר חלק', 'מספר קטלוגי', 'מס רכיב',
    ],
    [
      'item number', 'item no', 'item num', 'item code', 'item id', 'item', 'items',
      'article number', 'article no', 'article', 'customer part number', 'customer pn', 'cust part number',
      'מקט לקוח', 'מספר פריט', 'פריט', 'קוד פריט',
    ],
    ['material number', 'material no', 'material', 'material code', 'מספר חומר'],
  ],
  qty: [
    [
      'component quantity', 'component qty', 'quantity', 'qty', 'quantity per', 'qty per', 'qty per assembly',
      'quantity per assembly', 'qty assy', 'qty per unit', 'bom qty', 'bom quantity', 'required quantity',
      'required qty', 'req qty', 'qnty', 'amount',
      'כמות', 'כמות ליחידה', 'כמות נדרשת', 'כמות לפריט', 'יחס לאב', 'כמות בהרכבה',
    ],
    ['usage', 'total quantity', 'total qty', 'כמות כוללת'],
  ],
  level: [
    [
      'explosion level', 'bom level', 'level', 'lvl', 'indent level', 'indent', 'indentation', 'hierarchy', 'depth',
      'רמה', 'רמה בעץ', 'רמת פיצוץ', 'רמת הרכבה',
    ],
  ],
  desc: [
    [
      'object description', 'component description', 'part description', 'item description',
      'description', 'desc', 'part name', 'item name', 'component name', 'name', 'title',
      'תיאור', 'תאור', 'תיאור פריט', 'תאור מוצר', 'תיאור מוצר', 'שם פריט', 'שם רכיב',
    ],
    [],
    ['material description', 'material text'],
  ],
  rev: [['revision', 'rev', 'rev no', 'version', 'ver', 'רויזיה', 'גרסה', 'ריוויזיה']],
  uom: [
    [
      'uom', 'unit of measure', 'unit of measurement', 'base unit of measure', 'bun', 'unit', 'units', 'um',
      'יחידת מידה', 'יחידה', 'יח',
    ],
  ],
  mpn: [
    [
      'mpn', 'manufacturer part number', 'manufacturer part no', 'manufacturer p n', 'manufacturer pn',
      'mfr part number', 'mfr part no', 'mfr p n', 'mfr pn', 'mfg part number', 'mfg part no', 'mfg p n', 'mfg pn',
      'manufacturers part number', 'mfrpn', 'mfgpn', 'מקט יצרן', 'מספר יצרן', 'מקט היצרן',
    ],
  ],
  mfr: [
    [
      'manufacturer name', 'manufacturer', 'manufacturers', 'mfr name', 'mfr', 'mfg name', 'mfg', 'maker', 'brand',
      'יצרן', 'שם יצרן', 'שם היצרן',
    ],
  ],
  vendor: [
    [
      'vendor name', 'vendor', 'supplier name', 'supplier', 'preferred vendor', 'preferred supplier',
      'ספק', 'שם ספק', 'ספק מועדף',
    ],
  ],
  line: [
    [], [],
    [
      'item number', 'item no', 'item num', 'line number', 'line no', 'line', 'pos', 'position', 'pos no',
      'position number', 'seq', 'sequence', 'find number', 'find no', 'sr no', 'serial', 'row',
      'מספר שורה', 'שורה', 'פוזיציה', 'פוז', 'מס שורה', 'סידורי',
    ],
  ],
  // עמודות שנראות כמו מק"ט אבל אינן (האב / ההרכבה) - נחסמות מלהיבחר
  ignore: [
    [
      'parent', 'parent item', 'parent part', 'parent part number', 'parent number', 'parent assembly',
      'next higher assembly', 'where used', 'assembly', 'assembly number', 'top level', 'father',
      'אב', 'מקט אב', 'הרכבת אב', 'הרכבה',
    ],
  ],
};

const FIELDS = Object.keys(SYN) as SynField[];

/** נרמול כותרת: אותיות קטנות, בלי גרשיים, כל תו מיוחד הופך לרווח (P/N -> "p n", מק"ט -> "מקט") */
export function norm(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/["'`״׳’]/g, '')
    .replace(/[^a-z0-9\u0590-\u05ff]+/g, ' ')
    .trim();
}

function matchScore(h: string, syn: string, tier: number, exactOnly: boolean): number {
  if (h === syn) return 1000 - tier * 10;
  if (exactOnly || syn.length < 3) return 0;
  if (` ${h} `.includes(` ${syn} `)) return 500 + syn.split(' ').length * 20 - tier * 10;
  return 0;
}

/** שיוך עמודות לשדות: הציון הגבוה ביותר קודם; כל עמודה ושדה נתפסים פעם אחת */
function assign(headers: string[]): { cols: Cols; count: number } {
  const cands: { s: number; i: number; f: SynField }[] = [];
  headers.forEach((h, i) => {
    if (!h || h.length > 60) return;
    for (const f of FIELDS) {
      SYN[f].forEach((tier, ti) => {
        for (const syn of tier) {
          const s = matchScore(h, syn, ti, f === 'ignore');
          if (s) cands.push({ s, i, f });
        }
      });
    }
  });
  cands.sort((a, b) => b.s - a.s || a.i - b.i);
  const cols: Cols = {};
  const used = new Set<number>();
  for (const c of cands) {
    if (used.has(c.i)) continue;
    if (c.f === 'ignore') { used.add(c.i); continue; }
    if (cols[c.f] !== undefined) continue;
    cols[c.f] = c.i + 1;
    used.add(c.i);
  }
  const count = Object.keys(cols).filter((k) => k !== 'line').length;
  return { cols, count };
}

/* ---------- עזרים לקריאת תאים ---------- */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrap(v: any): any {
  if (v == null) return null;
  if (typeof v === 'object' && !(v instanceof Date)) {
    if (v.richText) return v.richText.map((t: { text: string }) => t.text).join('');
    if ('result' in v) return unwrap(v.result);
    if (v.text != null) return v.text;
    return null;
  }
  return v;
}

/** רמה בעץ: 1 | ".1" | "..2" | "...3" | "1.2.3" | "Level 2" | 0.1 (Excel הופך ".1" ל-0.1) */
export function parseLevel(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 0) return null;
    if (Number.isInteger(raw)) return raw;
    return raw < 1 ? Math.round(raw * 10) : Math.floor(raw);
  }
  const s = String(raw).trim();
  if (!s) return null;
  if (/^0\.\d+$/.test(s)) return Math.round(parseFloat(s) * 10);
  if (/^\d+(\.\d+)+$/.test(s)) return s.split('.').length;
  const m = s.match(/\d+/);
  if (m) return parseInt(m[0], 10);
  if (/^\.+$/.test(s)) return s.length;
  return null;
}

/** כמות: 2 | "2" | "1,5" | "1,200.50" | "2 EA" */
export function parseQty(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? raw : null;
  const s = String(raw ?? '').replace(/\s/g, '');
  const m = s.match(/\d[\d.,]*/);
  if (!m) return null;
  let t = m[0].replace(/[.,]+$/, '');
  const lastDot = t.lastIndexOf('.');
  const lastComma = t.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    t = lastDot > lastComma ? t.replace(/,/g, '') : t.replace(/\./g, '').replace(',', '.');
  } else if (lastComma >= 0) {
    t = /^\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');
  }
  const n = parseFloat(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/* ---------- איתור שורת כותרות בגיליון ---------- */
interface Detection { row: number; cols: Cols; count: number; valid: boolean; headers: string[] }

function detectHeader(ws: ExcelJS.Worksheet): Detection | null {
  let best: Detection | null = null;
  let fallback: Detection | null = null;
  const last = Math.min(40, ws.rowCount);
  for (let r = 1; r <= last; r++) {
    const raw: string[] = [];
    let nonEmpty = 0;
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell, c) => {
      const t = cellText(cell.value);
      if (t) { raw[c - 1] = t; nonEmpty++; }
    });
    if (!nonEmpty) continue;
    const headers = Array.from(raw, (t) => (t ? norm(t) : ''));
    const { cols, count } = assign(headers);
    const valid = cols.item !== undefined && (count >= 2 || nonEmpty === 1);
    const d: Detection = { row: r, cols, count, valid, headers: Array.from(raw, (t) => t ?? '') };
    if (valid && (!best || d.count > best.count)) best = d;
    if (!fallback && nonEmpty >= 2) fallback = d;
    else if (fallback && !fallback.valid && count > fallback.count) fallback = d;
  }
  return best ?? fallback;
}

/* ---------- קריאת שורות ---------- */
interface Alt { mpn: string; manufacturer: string }
interface RawRow {
  item: string; rev: string; desc: string; uom: string; mpn: string; mfr: string; vendor: string;
  level: number | null; qty: number | null; idx: number; alts: Alt[];
  ext: number; asm: boolean; disp: number;
}

function readRows(ws: ExcelJS.Worksheet, headerRow: number, cols: Cols, warnings: string[]): RawRow[] {
  const itemHeaderNorm = norm(cellText(ws.getRow(headerRow).getCell(cols.item!).value));
  const txt = (row: ExcelJS.Row, f: Field) => (cols[f] ? cellText(row.getCell(cols[f]!).value) : '');
  const rows: RawRow[] = [];
  let noPn = 0;

  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const item = txt(row, 'item').replace(/\s+/g, ' ').trim();

    if (!item) {
      // שורת חלופה: אין מק"ט אבל יש MPN / יצרן -> מצורפת לפריט שמעליה
      const mpn = txt(row, 'mpn'), mfr = txt(row, 'mfr');
      if ((mpn || mfr) && rows.length && !txt(row, 'desc') && !txt(row, 'level')) {
        rows[rows.length - 1].alts.push({ mpn, manufacturer: mfr });
      } else if (txt(row, 'desc') || (parseQty(unwrap(cols.qty ? row.getCell(cols.qty).value : null)) ?? 0) > 0) {
        noPn++;
      }
      continue;
    }
    if (norm(item) === itemHeaderNorm) continue; // כותרת שחוזרת באמצע הגיליון

    rows.push({
      item: item.slice(0, 120),
      rev: txt(row, 'rev'), desc: txt(row, 'desc'), uom: txt(row, 'uom'),
      mpn: txt(row, 'mpn'), mfr: txt(row, 'mfr'), vendor: txt(row, 'vendor'),
      level: cols.level ? parseLevel(unwrap(row.getCell(cols.level).value)) : null,
      qty: cols.qty ? parseQty(unwrap(row.getCell(cols.qty).value)) : null,
      idx: r, alts: [], ext: 0, asm: false, disp: 1,
    });
    if (rows.length > 5000) throw new UserError('הקובץ גדול מדי (מעל 5,000 שורות בגיליון)');
  }
  if (noPn) warnings.push(`${noPn} שורות ללא מק"ט דולגו`);
  return rows;
}

/** כמות מצטברת לפי עץ ה-BOM + זיהוי הרכבות. עובד עם כל מספור רמות (גם אם מתחיל ב-0 או מדלג) */
function explode(rows: RawRow[]) {
  const hasLevel = rows.some((r) => r.level != null);
  let prev = 1;
  for (const r of rows) {
    if (r.level == null) r.level = hasLevel ? prev : 1;
    prev = r.level;
  }
  const minL = Math.min(...rows.map((r) => r.level!));
  const stack: { level: number; ext: number }[] = [];
  rows.forEach((r, i) => {
    while (stack.length && stack[stack.length - 1].level >= r.level!) stack.pop();
    const parentExt = stack.length ? stack[stack.length - 1].ext : 1;
    r.ext = Math.round((r.qty ?? 1) * parentExt * 1e6) / 1e6;
    stack.push({ level: r.level!, ext: r.ext });
    r.asm = i + 1 < rows.length && rows[i + 1].level! > r.level!;
    r.disp = r.level! - minL + 1;
  });
}

/* ---------- תוצאה ---------- */
export interface ParsedItem {
  item: string;
  revision: string | null;
  description: string | null;
  uom: string | null;
  mpn: string | null;
  manufacturer: string | null;
  vendor: string | null;
  alternates: Alt[];
  level: number;
  total_qty: number;
  occurrences: number;
  is_assembly: boolean;
  row_index: number;
}

export interface ParseResult {
  items: ParsedItem[];
  rows: number;
  sheet: string;
  skippedSheets: string[];
  detected: { field: Field; header: string; column: number }[];
  warnings: string[];
}

export class NeedsMapping extends Error {
  constructor(public payload: MappingRequest) { super(payload.reason); }
}

interface SheetParse {
  name: string; rows: RawRow[]; cols: Cols; headerRow: number; headers: string[]; warnings: string[];
}

function parseSheet(ws: ExcelJS.Worksheet, headerRow: number, cols: Cols, headers: string[]): SheetParse {
  const warnings: string[] = [];
  const rows = readRows(ws, headerRow, cols, warnings);
  if (rows.length) {
    explode(rows);
    if (!cols.qty) warnings.push('לא זוהתה עמודת כמות, נקבעה כמות 1 לכל פריט');
    if (!cols.level) warnings.push('לא זוהתה עמודת רמה, הכמויות לא נצברות לפי עץ ההרכבות');
    const looksLikeLines = rows.length > 3 && rows.every((r) => /^\d{1,5}$/.test(r.item));
    if (looksLikeLines) warnings.push('עמודת המק"ט מכילה מספרים קצרים בלבד (נראה כמו מספר שורה). אם זה לא נכון, בחרו את העמודה הנכונה ידנית');
  }
  return { name: ws.name, rows, cols, headerRow, headers, warnings };
}

function previewOf(ws: ExcelJS.Worksheet): string[][] {
  const out: string[][] = [];
  const last = Math.min(15, ws.rowCount);
  for (let r = 1; r <= last; r++) {
    const line: string[] = [];
    for (let c = 1; c <= 30; c++) line.push(cellText(ws.getRow(r).getCell(c).value).slice(0, 40));
    while (line.length && !line[line.length - 1]) line.pop();
    out.push(line);
  }
  return out;
}

function mappingRequest(sheets: ExcelJS.Worksheet[], reason: string): MappingRequest {
  return {
    reason,
    sheets: sheets.map((ws) => {
      const d = detectHeader(ws);
      return { name: ws.name, headerRow: d?.row ?? 1, preview: previewOf(ws), suggested: d?.cols ?? {} };
    }),
  };
}

/**
 * @param opts.sheet  'auto' (ברירת מחדל: הגיליון עם הכי הרבה שורות) | 'all' (איחוד כל הגיליונות) | שם גיליון
 * @param opts.mapping מיפוי ידני שהמשתמש בחר
 */
export async function parseBom(
  buf: Buffer,
  opts: { sheet?: string; mapping?: MappingInput } = {},
): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
  } catch {
    throw new UserError('לא ניתן לקרוא את הקובץ. ודאו שזה קובץ Excel (.xlsx) תקין');
  }
  const all = wb.worksheets.filter((w) => w.rowCount > 0);
  const visible = all.filter((w) => w.state === 'visible' || !w.state);
  const sheets = visible.length ? visible : all;
  if (!sheets.length) throw new UserError('הקובץ ריק');

  let parsed: SheetParse[] = [];

  if (opts.mapping) {
    const ws = sheets.find((s) => s.name === opts.mapping!.sheet) ?? all.find((s) => s.name === opts.mapping!.sheet);
    if (!ws) throw new UserError('הגיליון שנבחר לא נמצא בקובץ');
    const { headerRow, cols } = opts.mapping;
    if (!cols.item) throw new UserError('יש לבחור עמודת מק"ט');
    const headers: string[] = [];
    ws.getRow(headerRow).eachCell({ includeEmpty: false }, (cell, c) => { headers[c - 1] = cellText(cell.value); });
    parsed = [parseSheet(ws, headerRow, cols, headers)];
  } else {
    const wanted = opts.sheet && opts.sheet !== 'auto' && opts.sheet !== 'all'
      ? sheets.filter((s) => s.name === opts.sheet)
      : sheets;
    if (!wanted.length) throw new UserError('הגיליון שנבחר לא נמצא בקובץ');
    for (const ws of wanted) {
      const d = detectHeader(ws);
      if (!d?.valid) continue;
      const p = parseSheet(ws, d.row, d.cols, d.headers);
      if (p.rows.length) parsed.push(p);
    }
    if (!parsed.length) {
      throw new NeedsMapping(mappingRequest(wanted, 'לא זוהתה אוטומטית עמודת מק"ט בקובץ. אפשר להתאים את העמודות ידנית'));
    }
    if (opts.sheet !== 'all' && parsed.length > 1) {
      // ברירת מחדל: הגיליון הגדול ביותר (בדרך כלל ה-BOM המלא; השאר עותקי עבודה)
      parsed.sort((a, b) => b.rows.length - a.rows.length);
      parsed = [parsed[0]];
    }
  }

  const total = parsed.reduce((n, p) => n + p.rows.length, 0);
  if (!total) throw new UserError('לא נמצאו שורות פריטים בקובץ');

  // איחוד לפי מק"ט
  const map = new Map<string, ParsedItem>();
  parsed.forEach((p, si) => {
    for (const r of p.rows) {
      const key = r.item.toUpperCase();
      const ex = map.get(key);
      const alts = r.alts.filter((a) => a.mpn || a.manufacturer);
      if (ex) {
        ex.total_qty = Math.round((ex.total_qty + r.ext) * 1e6) / 1e6;
        ex.occurrences += 1;
        ex.level = Math.min(ex.level, r.disp);
        ex.is_assembly = ex.is_assembly || r.asm;
        ex.revision ||= r.rev || null;
        ex.description ||= r.desc || null;
        ex.uom ||= r.uom || null;
        ex.mpn ||= r.mpn || null;
        ex.manufacturer ||= r.mfr || null;
        ex.vendor ||= r.vendor || null;
        ex.alternates.push(...alts);
      } else {
        map.set(key, {
          item: r.item, revision: r.rev || null, description: r.desc || null, uom: r.uom || null,
          mpn: r.mpn || null, manufacturer: r.mfr || null, vendor: r.vendor || null, alternates: alts,
          level: r.disp, total_qty: r.ext, occurrences: 1, is_assembly: r.asm, row_index: si * 10000 + r.idx,
        });
      }
    }
  });

  const main = parsed[0];
  const detected = (Object.entries(main.cols) as [Field, number][])
    .filter(([f]) => f !== 'line')
    .map(([field, column]) => ({ field, header: main.headers[column - 1] ?? '', column }));
  const used = new Set(parsed.map((p) => p.name));

  return {
    items: [...map.values()],
    rows: total,
    sheet: parsed.length > 1 ? `${parsed.length} גיליונות` : main.name,
    skippedSheets: sheets.map((s) => s.name).filter((n) => !used.has(n)),
    detected,
    warnings: [...new Set(parsed.flatMap((p) => p.warnings))],
  };
}
