'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { FolderKanban, LayoutDashboard, LogOut, Menu, Settings, Truck, X } from 'lucide-react';
import { signOut } from '@/app/login/actions';
import { cn, initials } from '@/lib/format';
import Toaster from './Toaster';

const NAV = [
  { href: '/', label: 'לוח בקרה', icon: LayoutDashboard },
  { href: '/projects', label: 'פרויקטים', icon: FolderKanban },
  { href: '/suppliers', label: 'ספקים וקטגוריות', icon: Truck },
  { href: '/settings', label: 'הגדרות', icon: Settings },
];

export default function AppShell({ user, children }: { user: { email: string; name: string }; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

  const sidebar = (
    <div className="flex h-full flex-col bg-navy text-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold">A</div>
        <div>
          <p className="text-sm font-bold leading-none">AMS RFQ</p>
          <p className="mt-1 text-[11px] text-white/50">ניהול רכש והצעות מחיר</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} onClick={() => setOpen(false)}
            className={cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
              active(href) ? 'bg-brand text-white' : 'text-white/70 hover:bg-navy-soft hover:text-white')}>
            <Icon size={18} /> {label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-navy-line p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold">{initials(user.name || user.email)}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name || user.email.split('@')[0]}</p>
            <p className="truncate text-[11px] text-white/50" dir="ltr">{user.email}</p>
          </div>
          <form action={signOut}>
            <button className="rounded-md p-2 text-white/60 hover:bg-navy-soft hover:text-white" title="התנתקות" aria-label="התנתקות"><LogOut size={16} /></button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">{sidebar}</aside>
      <div className="flex items-center justify-between bg-navy px-4 py-3 text-white lg:hidden">
        <span className="font-bold">AMS RFQ</span>
        <button onClick={() => setOpen(true)} aria-label="תפריט"><Menu size={22} /></button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 start-0 w-64">
            <button className="absolute end-2 top-2 z-10 text-white" onClick={() => setOpen(false)} aria-label="סגירה"><X size={20} /></button>
            {sidebar}
          </div>
        </div>
      )}
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
      <Toaster />
    </div>
  );
}
