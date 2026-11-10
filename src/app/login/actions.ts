'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { SESSION_SEEN, SESSION_START, stampOptions } from '@/lib/supabase/session';

const schema = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) });

export async function signIn(_: unknown, formData: FormData) {
  const parsed = schema.safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return { error: 'יש להזין אימייל וסיסמה תקינים' };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: 'אימייל או סיסמה שגויים' };
  // חותמות זמן לניהול הסשן (ניתוק אחרי חוסר פעילות / אורך מקסימלי), ראו lib/supabase/session.ts
  const jar = await cookies();
  const now = String(Date.now());
  jar.set(SESSION_START, now, stampOptions);
  jar.set(SESSION_SEEN, now, stampOptions);
  redirect('/');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const jar = await cookies();
  jar.delete(SESSION_START);
  jar.delete(SESSION_SEEN);
  redirect('/login');
}
