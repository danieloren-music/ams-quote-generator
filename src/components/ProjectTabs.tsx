'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/format';

const TABS = [
  { href: '', label: 'סקירה והגדרות' },
  { href: '/spec', label: 'מפרט טכני' },
  { href: '/categories', label: 'חלוקת קטגוריות' },
  { href: '/rfq', label: 'שליחה לספקים' },
  { href: '/responses', label: 'תשובות ספקים' },
  { href: '/quote', label: 'הצעת מחיר' },
];

export default function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line" aria-label="שלבי הפרויקט">
      {TABS.map((t, i) => {
        const href = base + t.href;
        const active = t.href === '' ? pathname === base : pathname.startsWith(href);
        return (
          <Link key={t.href} href={href}
            className={cn('-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium', active ? 'border-brand text-brand' : 'border-transparent text-ink/60 hover:text-ink')}>
            <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[11px]', active ? 'bg-brand text-white' : 'bg-line text-ink/60')}>{i + 1}</span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
