import Header from '@/components/Header';
import ComingSoon from '@/components/ComingSoon';
import { createClient } from '@/lib/supabase/server';

export default async function SuppliersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <>
      <Header email={user?.email} />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="mb-4 text-2xl font-bold">ניהול ספקים</h1>
        <ComingSoon title="ספקים וכתובות מייל לפי קטגוריה" step="שלב 4" />
      </main>
    </>
  );
}
