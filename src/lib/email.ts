import { UserError } from './action';

export const resendConfigured = () => !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM);

/** מונע Header Injection בנושא המייל */
export const cleanHeader = (s: string) => s.replace(/[\r\n\u2028\u2029]+/g, ' ').trim().slice(0, 250);

export function fillTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newRefCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return 'RFQ-' + [...bytes].map((b) => REF_ALPHABET[b % REF_ALPHABET.length]).join('');
}
export const REF_REGEX = /RFQ-[A-HJ-NP-Z2-9]{6}/g;

export async function sendWithResend(o: {
  to: string[]; subject: string; text: string; attachment?: { filename: string; content: Buffer };
}) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) throw new UserError('שליחה דרך Resend לא מוגדרת');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: o.to,
      reply_to: process.env.RESEND_REPLY_TO || undefined,
      subject: cleanHeader(o.subject),
      text: o.text,
      attachments: o.attachment
        ? [{ filename: o.attachment.filename, content: o.attachment.content.toString('base64') }]
        : undefined,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    console.error('resend http', res.status);
    throw new UserError('שליחת המייל נכשלה (בדקו את הגדרות Resend והדומיין)');
  }
}
