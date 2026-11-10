import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { asSessionCookie, IDLE_MS, MAX_MS, SESSION_SEEN, SESSION_START, stampOptions } from './session';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, asSessionCookie(value, options)));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isLogin = path.startsWith('/login');
  const now = Date.now();

  /** ניתוק: מוחק את עוגיות האימות ומעביר להתחברות (או 401 ל-API) */
  const kill = async (reason: 'expired' | 'signed_out') => {
    await supabase.auth.signOut().catch(() => undefined);
    const res = path.startsWith('/api')
      ? NextResponse.json({ error: 'ההתחברות פגה, יש להתחבר מחדש' }, { status: 401 })
      : (() => {
          const url = request.nextUrl.clone();
          url.pathname = '/login';
          url.search = reason === 'expired' ? '?expired=1' : '';
          return NextResponse.redirect(url);
        })();
    request.cookies.getAll().filter((c) => c.name.startsWith('sb-') || c.name === SESSION_START || c.name === SESSION_SEEN)
      .forEach((c) => res.cookies.set(c.name, '', { path: '/', maxAge: 0 }));
    return res;
  };

  if (user) {
    const start = Number(request.cookies.get(SESSION_START)?.value);
    const seen = Number(request.cookies.get(SESSION_SEEN)?.value);
    // סשן ישן (נוצר לפני השדרוג) או עוגיות נקיות בלי חותמת: דורש התחברות מחדש
    const stale = !Number.isFinite(start) || !Number.isFinite(seen) || now - seen > IDLE_MS || now - start > MAX_MS;
    if (stale && !isLogin) return kill('expired');
    if (stale && isLogin) {
      // כבר בדף ההתחברות: מנקים עוגיות ישנות ומאפשרים כניסה חדשה
      const res = NextResponse.next({ request });
      request.cookies.getAll().filter((c) => c.name.startsWith('sb-'))
        .forEach((c) => res.cookies.set(c.name, '', { path: '/', maxAge: 0 }));
      return res;
    }
    response.cookies.set(SESSION_SEEN, String(now), stampOptions);
  }

  if (!user && path.startsWith('/api')) {
    return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 });
  }
  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  return response;
}
