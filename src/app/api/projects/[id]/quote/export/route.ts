import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildQuoteXlsx } from '@/lib/excel';
import { computeSummary } from '@/lib/pricing';
import { SOURCING_LABELS, type BomItem, type Category, type ExtraCost, type Project, type Quote } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 });
  const [{ data: project }, { data: items }, { data: cats }, { data: quotes }, { data: sups }, { data: extras }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase.from('bom_items').select('*').eq('project_id', id).order('row_index'),
    supabase.from('categories').select('id,name,color,burden_group,requires_rfq,sort'),
    supabase.from('quotes').select('*').eq('project_id', id).eq('selected', true),
    supabase.from('suppliers').select('id,name'),
    supabase.from('extra_costs').select('id,name,currency,amounts,burden').eq('project_id', id),
  ]);
  if (!project) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 });
  const P = project as unknown as Project;
  const I = (items ?? []) as BomItem[];
  const C = (cats ?? []) as Category[];
  const Q = new Map(((quotes ?? []) as Quote[]).map((q) => [q.bom_item_id, q]));
  const S = computeSummary(P, I, Q, C, (extras ?? []) as ExtraCost[]);
  const cat = new Map(C.map((c) => [c.id, c]));
  const sup = new Map((sups ?? []).map((s) => [s.id, s.name]));
  const labels: Record<string, string> = { ok: 'OK', estimated: 'Estimated', missing: 'Missing', skipped: 'N/A' };

  const buf = await buildQuoteXlsx({
    project: P.name, customer: P.customer, exclusions: P.exclusions, summary: S,
    rows: I.map((i) => {
      const c = i.category_id ? cat.get(i.category_id) : undefined;
      const q = Q.get(i.id);
      const ls = S.lines.get(i.id) ?? [];
      return {
        category: c?.name ?? '', group: c?.burden_group ?? '', item: i.item, description: i.description ?? '', qty: i.total_qty,
        supplier: i.sourcing === 'rfq' ? (q ? sup.get(q.supplier_id ?? '') ?? '' : '') : SOURCING_LABELS[i.sourcing],
        lead: q?.lead_time_days ?? null, status: labels[ls[0]?.state ?? 'missing'],
        perSystem: ls.map((l) => (l.state === 'missing' || l.state === 'skipped' ? null : Math.round(l.perSystem * 100) / 100)),
      };
    }),
  });
  const safe = P.name.replace(/[^\w\-א-ת]+/g, '_').slice(0, 60);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`Quote_${safe}.xlsx`)}`,
      'Cache-Control': 'no-store',
    },
  });
}
