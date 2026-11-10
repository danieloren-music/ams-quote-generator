'use server';

import { z } from 'zod';
import { action, must } from '@/lib/action';

const s = z.object({
  display_name: z.string().trim().max(80).nullable(),
  company: z.string().trim().max(120).nullable(),
  email_subject_he: z.string().trim().min(1).max(250),
  email_body_he: z.string().trim().min(1).max(5000),
  email_subject_en: z.string().trim().min(1).max(250),
  email_body_en: z.string().trim().min(1).max(5000),
  email_signature: z.string().trim().max(1000).nullable(),
});

export async function saveSettings(input: z.infer<typeof s>) {
  return action(async ({ supabase, user }) => {
    const v = s.parse(input);
    must(await supabase.from('user_settings').upsert({ user_id: user.id, ...v }));
  });
}
