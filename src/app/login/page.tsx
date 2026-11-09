'use client';

import { useActionState } from 'react';
import { signIn } from './actions';

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form action={action} className="w-full max-w-sm space-y-4 rounded-lg border border-line bg-white p-8">
        <h1 className="text-2xl font-bold text-brand">AMS RFQ</h1>
        <p className="text-sm text-ink/70">התחברי כדי לנהל פרויקטים והצעות מחיר.</p>
        <div>
          <label className="label" htmlFor="email">אימייל</label>
          <input id="email" name="email" type="email" required className="input" dir="ltr" />
        </div>
        <div>
          <label className="label" htmlFor="password">סיסמה</label>
          <input id="password" name="password" type="password" required className="input" dir="ltr" />
        </div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button className="btn w-full" disabled={pending}>{pending ? 'מתחבר…' : 'כניסה'}</button>
      </form>
    </main>
  );
}
