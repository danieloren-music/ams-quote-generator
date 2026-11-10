import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { categorizeItems } from '@/lib/gemini';
import { UserError } from '@/lib/action';

export const runtime = 'nodejs';
export const maxDuration = 60;
const BATCH = 40;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 });
  try {
    const { data: cats } = await supabase.from('categories').select('id,name').order('sort');
    if (!cats?.length) throw new UserError('אין קטגוריות. הוסיפו קטגוריות בעמוד הספקים');
    const { data: items } = await supabase.from('bom_items')
      .select('id,item,description,mpn,manufacturer')
      .eq('project_id', id).is('category_id', null).eq('category_source', 'none').limit(BATCH);

    if (items?.length) {
      const list = items.map((it, idx) => ({ idx, item: it.item, description: it.description, mpn: it.mpn, manufacturer: it.manufacturer }));
      const results = await categorizeItems(cats, list);
      const byName = new Map(cats.map((c) => [c.name, c.id]));
      await Promise.all(items.map((it, idx) => {
        const r = results.find((x) => x.idx === idx);
        const catId = r ? byName.get(r.category) ?? null : null;
        return supabase.from('bom_items').update({
          category_id: catId, category_source: 'ai', category_confidence: catId ? Math.max(0, Math.min(1, r?.confidence ?? 0)) : 0,
        }).eq('id', it.id).eq('project_id', id);
      }));
      // קטגוריות שלא דורשות RFQ
      const { data: noRfq } = await supabase.from('categories').select('id').eq('requires_rfq', false);
      if (noRfq?.length) await supabase.from('bom_items').update({ sourcing: 'not_required' })
        .eq('project_id', id).eq('sourcing', 'rfq').eq('category_source', 'ai').in('category_id', noRfq.map((c) => c.id));
    }
    const { count } = await supabase.from('bom_items').select('*', { count: 'exact', head: true })
      .eq('project_id', id).is('category_id', null).eq('category_source', 'none');
    return NextResponse.json({ ok: true, processed: items?.length ?? 0, remaining: count ?? 0 });
  } catch (e) {
    if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error('categorize', e);
    return NextResponse.json({ error: 'אירעה שגיאה בסיווג' }, { status: 500 });
  }
}
