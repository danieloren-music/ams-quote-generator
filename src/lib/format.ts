export const money = (n: number | null | undefined, digits = 2) =>
  n == null || Number.isNaN(n)
    ? '—'
    : '$' + n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const num = (n: number | null | undefined, digits = 2) =>
  n == null || Number.isNaN(n) ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: digits });

export const dateHe = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('he-IL') : '—';

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export const initials = (s: string) =>
  s.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
