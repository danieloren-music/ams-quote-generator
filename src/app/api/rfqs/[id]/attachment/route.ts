import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildRfqXlsx } from '@/lib/excel';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 });

  const { data: rfq } = await supabase.from('rfqs')
    .select('ref_code,project_id,projects(name,tiers),suppliers(name),categories(name),rfq_items(bom_items(item,revision,description,mpn,manufacturer,total_qty))')
    .eq('id', id).single();
  if (!rfq) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 });
  const r = rfq as unknown as {
    ref_code: string; projects: { name: string; tiers: number[] }; suppliers: { name: string } | null; categories: { name: string } | null;
    rfq_items: { bom_items: { item: string; revision: string | null; description: string | null; mpn: string | null; manufacturer: string | null; total_qty: number } }[];
  };
  const buf = await buildRfqXlsx({
    ref: r.ref_code, project: r.projects.name, supplier: r.suppliers?.name ?? '', category: r.categories?.name ?? '',
    tiers: r.projects.tiers, items: r.rfq_items.map((x) => x.bom_items),
  });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${r.ref_code}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
