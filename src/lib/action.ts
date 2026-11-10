import { ZodError } from 'zod';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export class UserError extends Error {}
export type Res<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };
export interface Ctx { supabase: SupabaseClient; user: User }

type DbResult<T> = { data: T; error: { code?: string; message: string } | null };

/** מחזיר את הנתונים או זורק שגיאה ידידותית (בלי לחשוף פרטי DB פנימיים) */
export function must<T>(r: DbResult<T>): NonNullable<T> {
  if (r.error) {
    if (r.error.code === '23505') throw new UserError('הרשומה כבר קיימת');
    if (r.error.code === '23503') throw new UserError('לא ניתן לבצע, הרשומה מקושרת לנתונים אחרים');
    if (r.error.code === '23514') throw new UserError('ערך לא תקין');
    console.error('db error', r.error.code, r.error.message);
    const c = r.error.code ?? '';
    const hint =
      c === '42703' || c === 'PGRST204' ? 'חסרה עמודה במסד הנתונים. יש להריץ את קובץ ה-SQL של הגרסה האחרונה (supabase/migrations)' :
      c === '42P01' || c === 'PGRST205' ? 'חסרה טבלה במסד הנתונים. יש להריץ את קובץ ה-SQL של הגרסה האחרונה' :
      c === '42501' ? 'אין הרשאה (RLS). בדקו שה-SQL הורץ במלואו' :
      'שגיאת מסד נתונים';
    throw new UserError(`${hint} [${c || 'ללא קוד'}]`);
  }
  return r.data as NonNullable<T>;
}

/** עוטף Server Action: בודק התחברות, מטפל בשגיאות ומחזיר תוצאה אחידה */
export async function action<T = void>(fn: (c: Ctx) => Promise<T>): Promise<Res<T>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'נדרשת התחברות מחדש' };
    const data = await fn({ supabase, user });
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ZodError) return { ok: false, error: 'נתונים לא תקינים: ' + (e.issues[0]?.message ?? '') };
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error('action error', e);
    return { ok: false, error: 'אירעה שגיאה. נסו שוב.' };
  }
}
