'use client';

import { useActionState } from 'react';
import { signIn } from './actions';

export default function LoginForm({ expired }: { expired?: boolean }) {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <main className="login-fade grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-navy p-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand font-bold">A</div>
          <span className="text-lg font-bold">AMS RFQ</span>
        </div>
        <div>
          <h2 className="text-3xl font-bold leading-snug">מפרט הנדסי להצעת מחיר מדויקת.<br />ניהול רכש חכם, מקצה לקצה.</h2>
          <p className="mt-4 max-w-md text-white/60">ממערכת BOM חכמה ועד להצעות מחיר מספקים — תהליך רכש מבוקר, אוטומטי ומדויק במקום אחד.</p>
        </div>
        <p className="text-xs text-white/40">© AMS</p>
      </section>
      <section className="flex items-center justify-center px-4">
        <form action={action} className="w-full max-w-sm space-y-4">
          <div className="flex items-center gap-3 lg:hidden">
            <img src="/ams-logo.jpg" alt="AMS" width="48" height="48" className="rounded-xl object-contain" />
            <span className="text-lg font-bold">AMS RFQ</span>
          </div>
          <h1 className="text-2xl font-bold">כניסה למערכת</h1>
          {expired && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">ההתחברות פגה מטעמי אבטחה. יש להתחבר מחדש.</p>}
          <div>
            <label className="label" htmlFor="email">אימייל</label>
            <input id="email" name="email" type="email" required autoComplete="username" className="input" dir="ltr" />
          </div>
          <div>
            <label className="label" htmlFor="password">סיסמה</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" className="input" dir="ltr" />
          </div>
          {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
          <button className="btn w-full" disabled={pending}>{pending ? 'מתחבר…' : 'כניסה'}</button>
        </form>
      </section>
    </main>
  );
}
