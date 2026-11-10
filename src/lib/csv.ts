/** CSV בטוח: מונע CSV/Formula injection ומוסיף BOM כדי שאקסל יציג עברית נכון */
const guard = (v: string) => (/^[=+\-@\t\r]/.test(v) ? "'" + v : v);
const esc = (v: unknown) => {
  const s = guard(v == null ? '' : String(v));
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
export function toCsv(rows: unknown[][]): string {
  return '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
}
export function downloadCsv(name: string, rows: unknown[][]) {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
