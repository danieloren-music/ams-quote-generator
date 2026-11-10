import Link from 'next/link';
import { Check, Circle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import type { Project } from '@/lib/types';
import OverviewForm from './OverviewForm';

export default async function ProjectOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: p }, { data: items }, { data: quotes }, { count: rfqs }, { count: replied }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase.from('bom_items').select('id,category_id,sourcing').eq('project_id', id),
    supabase.from('quotes').select('bom_item_id').eq('project_id', id).eq('selected', true),
    supabase.from('rfqs').select('*', { count: 'exact', head: true }).eq('project_id', id).in('status', ['sent', 'replied']),
    supabase.from('rfqs').select('*', { count: 'exact', head: true }).eq('project_id', id).eq('status', 'replied'),
  ]);
  const all = items ?? [];
  const cat = all.filter((i) => i.category_id).length;
  const needRfq = all.filter((i) => i.sourcing === 'rfq');
  const priced = new Set((quotes ?? []).map((q) => q.bom_item_id));
  const missing = needRfq.filter((i) => !priced.has(i.id)).length;

  const steps = [
    { href: 'spec', title: 'מפרט טכני', done: all.length > 0, text: all.length ? `${all.length} פריטים` : 'להעלות BOM' },
    { href: 'categories', title: 'חלוקת קטגוריות', done: all.length > 0 && cat === all.length, text: all.length ? `${cat}/${all.length} מסווגים` : '—' },
    { href: 'rfq', title: 'שליחה לספקים', done: (rfqs ?? 0) > 0, text: `${rfqs ?? 0} בקשות נשלחו` },
    { href: 'responses', title: 'תשובות ספקים', done: (replied ?? 0) > 0, text: `${replied ?? 0} תשובות עובדו` },
    { href: 'quote', title: 'הצעת מחיר', done: needRfq.length > 0 && missing === 0, text: needRfq.length ? (missing ? `חסר מחיר ל-${missing} פריטים` : 'כל המחירים קיימים') : '—' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((s, i) => (
          <Link key={s.href} href={`/projects/${id}/${s.href}`} className="card p-4 transition-shadow hover:shadow-md">
            <div className="flex items-center gap-2 text-xs text-ink/50">
              {s.done ? <Check size={14} className="text-green-600" /> : <Circle size={14} />} שלב {i + 1}
            </div>
            <p className="mt-1 font-semibold">{s.title}</p>
            <p className="mt-0.5 text-xs text-ink/60">{s.text}</p>
          </Link>
        ))}
      </div>
      <OverviewForm project={p as unknown as Project} />
    </div>
  );
}
