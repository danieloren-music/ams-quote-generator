import Link from 'next/link';
import { signOut } from '@/app/login/actions';

export default function Header({ email }: { email?: string }) {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <nav className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold text-brand">AMS RFQ</Link>
          <Link href="/" className="text-sm hover:text-brand">פרויקטים</Link>
          <Link href="/suppliers" className="text-sm hover:text-brand">ספקים</Link>
        </nav>
        <form action={signOut} className="flex items-center gap-3">
          <span className="text-sm text-ink/60">{email}</span>
          <button className="btn-ghost">התנתקות</button>
        </form>
      </div>
    </header>
  );
}
