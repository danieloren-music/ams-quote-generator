/** הגדרות משותפות לפענוח BOM (בטוח לשימוש גם בצד לקוח, ללא תלות ב-exceljs) */

export type Field = 'item' | 'qty' | 'level' | 'desc' | 'rev' | 'uom' | 'mpn' | 'mfr' | 'vendor' | 'line';
export type Cols = Partial<Record<Field, number>>; // מספרי עמודות, מבוססי 1

/** השדות שהמשתמש יכול למפות ידנית, לפי סדר התצוגה */
export const MAPPABLE: { field: Field; label: string; required?: boolean }[] = [
  { field: 'item', label: 'מק"ט / Part Number', required: true },
  { field: 'qty', label: 'כמות' },
  { field: 'level', label: 'רמה בעץ (Level)' },
  { field: 'desc', label: 'תיאור' },
  { field: 'mpn', label: 'MPN (מק"ט יצרן)' },
  { field: 'mfr', label: 'יצרן' },
  { field: 'rev', label: 'Rev' },
  { field: 'uom', label: 'יחידת מידה' },
  { field: 'vendor', label: 'ספק (מידע בלבד)' },
];

export const FIELD_LABELS: Record<Field, string> = {
  item: 'מק"ט', qty: 'כמות', level: 'רמה', desc: 'תיאור', rev: 'Rev', uom: 'יחידה',
  mpn: 'MPN', mfr: 'יצרן', vendor: 'ספק', line: 'מס׳ שורה',
};

export interface MappingInput {
  sheet: string;
  headerRow: number;
  cols: Cols;
}

export interface MappingSheet {
  name: string;
  headerRow: number; // ניחוש של השרת
  preview: string[][]; // הגיליון הראשון, עד 15 שורות ו-30 עמודות
  suggested: Cols;
}

export interface MappingRequest {
  reason: string;
  sheets: MappingSheet[];
}

export function colLetter(n: number): string {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export interface ImportSummary {
  sheet: string;
  rows: number;
  added: number;
  updated: number;
  detected: { field: Field; header: string; column: string }[];
  warnings: string[];
  skippedSheets: string[];
}
