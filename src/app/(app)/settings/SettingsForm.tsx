'use client';

import { useState } from 'react';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import { useAction } from '@/components/useAction';
import { saveSettings } from './actions';

type S = { display_name: string; company: string; email_subject_he: string; email_body_he: string; email_subject_en: string; email_body_en: string; email_signature: string };

export default function SettingsForm({ init, email, canSend, geminiOk }: { init: S; email: string; canSend: boolean; geminiOk: boolean }) {
  const [s, setS] = useState(init);
  const { run, pending } = useAction();
  const set = (k: keyof S) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setS({ ...s, [k]: e.target.value });
  const Status = ({ ok, label, hint }: { ok: boolean; label: string; hint: string }) => (
    <div className="flex items-start gap-2 text-sm">
      {ok ? <CheckCircle2 size={16} className="mt-0.5 text-green-600" /> : <CircleAlert size={16} className="mt-0.5 text-amber-600" />}
      <div><b>{label}</b><p className="text-xs text-ink/60">{hint}</p></div>
    </div>
  );
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">פרופיל</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="dn">שם לתצוגה</label><input id="dn" className="input" value={s.display_name} onChange={set('display_name')} /></div>
            <div><label className="label" htmlFor="co">חברה</label><input id="co" className="input" value={s.company} onChange={set('company')} /></div>
          </div>
          <p className="text-xs text-ink/50">מחוברת כ- <span dir="ltr">{email}</span></p>
        </section>

        <section className="card space-y-4 p-5">
          <div>
            <h2 className="font-semibold">תבניות מייל לבקשת מחיר</h2>
            <p className="mt-1 text-xs text-ink/60">משתנים זמינים: <code dir="ltr">{'{{supplier}} {{project}} {{category}} {{ref}} {{tiers}}'}</code>. הקוד {'{{ref}}'} מזהה את הבקשה כשהתשובה חוזרת.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-sm font-medium">עברית</h3>
              <input className="input" aria-label="נושא בעברית" value={s.email_subject_he} onChange={set('email_subject_he')} />
              <textarea className="input" rows={9} aria-label="גוף בעברית" value={s.email_body_he} onChange={set('email_body_he')} />
            </div>
            <div className="space-y-3" dir="ltr">
              <h3 className="text-sm font-medium">English</h3>
              <input className="input" aria-label="English subject" value={s.email_subject_en} onChange={set('email_subject_en')} />
              <textarea className="input" rows={9} aria-label="English body" value={s.email_body_en} onChange={set('email_body_en')} />
            </div>
          </div>
          <div><label className="label" htmlFor="sig">חתימה (מתווספת בסוף כל מייל)</label><textarea id="sig" className="input" rows={3} value={s.email_signature} onChange={set('email_signature')} /></div>
        </section>
        <button className="btn" disabled={pending}
          onClick={() => run(() => saveSettings({ ...s, display_name: s.display_name || null, company: s.company || null, email_signature: s.email_signature || null }), { ok: 'ההגדרות נשמרו' })}>שמירת הגדרות</button>
      </div>

      <aside className="card h-fit space-y-4 p-5">
        <h2 className="font-semibold">סטטוס חיבורים</h2>
        <Status ok={geminiOk} label="Gemini (AI)" hint={geminiOk ? 'מחובר' : 'חסר GEMINI_API_KEY במשתני הסביבה'} />
        <Status ok={canSend} label="שליחת מייל (Resend)" hint={canSend ? 'שליחה ישירה מהמערכת פעילה' : 'לא מוגדר. המערכת תכין מייל מוכן וקובץ מצורף להורדה'} />
      </aside>
    </div>
  );
}
