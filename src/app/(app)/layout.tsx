import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // יוצר הגדרות וקטגוריות ברירת מחדל בכניסה הראשונה (פעולה אידמפוטנטית)
  const { count } = await supabase.from('categories').select('*', { count: 'exact', head: true });
  if (!count) await supabase.rpc('seed_defaults');
  const { data: s } = await supabase.from('user_settings').select('display_name').maybeSingle();

  return (
    <AppShell user={{ email: user.email ?? '', name: s?.display_name ?? '' }}>{children}</AppShell>
  );
}
