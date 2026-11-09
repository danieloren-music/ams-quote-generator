'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '', label: 'סקירה' },
  { href: '/spec', label: 'מפרט טכני' },
  { href: '/categories', label: 'חלוקת קטגוריות' },
  { href: '/suppliers', label: 'שליחה לספקים' },
  { href: '/quote', label: 'הצעת מחיר' },
];

export default function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  return (
    <nav className="flex gap-1 border-b border-line">
      {TABS.map((t) => {
        const href = base + t.href;
        const active = t.href === '' ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={t.href}
            href={href}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              active ? 'border-brand text-brand' : 'border-transparent text-ink/60 hover:text-ink'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
