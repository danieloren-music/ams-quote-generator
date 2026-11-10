import type { CookieOptions } from '@supabase/ssr';

/**
 * מדיניות סשן.
 * ברירת המחדל של Supabase היא עוגיות שחיות ~400 יום עם חידוש אוטומטי, ולכן המשתמש נשאר מחובר
 * גם אחרי סגירת הדפדפן. כאן מחמירים:
 *  1. עוגיות האימות הן "עוגיות סשן": נמחקות כשסוגרים את הדפדפן.
 *  2. ניתוק אחרי חוסר פעילות (SESSION_IDLE_MINUTES, ברירת מחדל 60 דקות).
 *  3. תקרת אורך סשן מוחלטת (SESSION_MAX_HOURS, ברירת מחדל 12 שעות), גם אם פעילים כל הזמן.
 */
export const SESSION_START = 'ams_session_start';
export const SESSION_SEEN = 'ams_session_seen';

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};
export const IDLE_MS = num(process.env.SESSION_IDLE_MINUTES, 60) * 60_000;
export const MAX_MS = num(process.env.SESSION_MAX_HOURS, 12) * 3_600_000;

/** מסיר maxAge/expires מעוגיות אימות כדי שיהיו עוגיות סשן. עוגיית מחיקה (maxAge=0) נשארת כמו שהיא. */
export function asSessionCookie(value: string, options: CookieOptions = {}): CookieOptions {
  if (!value || options.maxAge === 0) return options;
  const { maxAge: _m, expires: _e, ...rest } = options;
  void _m; void _e;
  return rest;
}

export const stampOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};
