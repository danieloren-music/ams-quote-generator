import { PageHeader } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import { resendConfigured } from '@/lib/email';
import SettingsForm from './SettingsForm';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: s } = await supabase.from('user_settings').select('*').maybeSingle();
  return (
    <>
      <PageHeader title="הגדרות" subtitle="פרופיל ותבניות מייל לבקשות מחיר" />
      <SettingsForm email={user?.email ?? ''} canSend={resendConfigured()} geminiOk={!!process.env.GEMINI_API_KEY}
        init={{
          display_name: s?.display_name ?? '', company: s?.company ?? '',
          email_subject_he: s?.email_subject_he ?? '', email_body_he: s?.email_body_he ?? '',
          email_subject_en: s?.email_subject_en ?? '', email_body_en: s?.email_body_en ?? '',
          email_signature: s?.email_signature ?? '',
        }} />
    </>
  );
}
