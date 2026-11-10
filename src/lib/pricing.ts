import type { BomItem, Category, Currency, ExtraCost, Project, Quote } from './types';

export type PricingParams = Pick<
  Project,
  | 'tiers' | 'fx_rate' | 'eur_rate' | 'labor_rate' | 'oh_pct' | 'profit_pct'
  | 'burden_low_limit' | 'burden_high_limit' | 'burden_low_rate' | 'burden_mid_rate' | 'burden_high_rate'
  | 'labor_hours'
>;

export const toUsd = (amount: number, cur: Currency, p: Pick<Project, 'fx_rate' | 'eur_rate'>) =>
  cur === 'ILS' ? amount / p.fx_rate : cur === 'EUR' ? amount * p.eur_rate : amount;

export type LineState = 'ok' | 'estimated' | 'missing' | 'skipped';
export interface Line { total: number; perSystem: number; state: LineState }

/** מחיר למדרגה: מדרגה מדויקת, אחרת המדרגה הנמוכה הקרובה (מסומן "הערכה") */
export function priceForTier(prices: Record<string, number>, tier: number) {
  const keys = Object.keys(prices)
    .map(Number)
    .filter((k) => Number.isFinite(k) && prices[String(k)] != null)
    .sort((a, b) => a - b);
  if (!keys.length) return null;
  if (prices[String(tier)] != null) return { price: prices[String(tier)], exact: true };
  const lower = keys.filter((k) => k <= tier);
  const k = lower.length ? lower[lower.length - 1] : keys[0];
  return { price: prices[String(k)], exact: false };
}

export function lineFor(
  item: Pick<BomItem, 'sourcing' | 'total_qty' | 'internal_unit_cost'>,
  quote: Quote | null | undefined,
  tier: number,
  p: Pick<Project, 'fx_rate' | 'eur_rate'>
): Line {
  const none: Line = { total: 0, perSystem: 0, state: 'missing' };
  if (item.sourcing === 'not_required') return { total: 0, perSystem: 0, state: 'skipped' };
  const qty = item.total_qty * tier; // כמות חלקים למדרגה

  if (item.sourcing === 'stock' || item.sourcing === 'internal') {
    if (item.internal_unit_cost == null) return none;
    const total = item.internal_unit_cost * qty;
    return { total, perSystem: total / tier, state: 'ok' };
  }
  if (!quote) return none;
  const hit = priceForTier(quote.prices, tier);
  if (!hit) return none;
  let total: number;
  if (quote.pack_size && quote.pack_size > 0) {
    // מחיר לאריזה: מעגלים מספר אריזות כלפי מעלה (כמו שנעשה היום ידנית ב-McMaster)
    total = Math.ceil(qty / quote.pack_size) * hit.price;
  } else {
    total = hit.price * qty;
  }
  total = toUsd(total, quote.currency, p);
  return { total, perSystem: total / tier, state: hit.exact ? 'ok' : 'estimated' };
}

export function burden(x: number, p: PricingParams) {
  if (x <= 0) return 0;
  if (x < p.burden_low_limit) return x * p.burden_low_rate;
  if (x > p.burden_high_limit) return x * p.burden_high_rate;
  return x * p.burden_mid_rate;
}

export interface GroupRow { name: string; totals: number[]; burden: number[] }
export interface Summary {
  tiers: number[];
  lines: Map<string, Line[]>;
  groups: GroupRow[];
  extras: GroupRow[];
  bomTotal: number[];
  burdenTotal: number[];
  materials: number[];
  laborHours: number[];
  labor: number[];
  oh: number[];
  subtotal: number[];
  profit: number[];
  total: number[];
  missing: number;
  estimated: number;
}

export function computeSummary(
  p: PricingParams & Pick<Project, 'fx_rate' | 'eur_rate'>,
  items: BomItem[],
  selected: Map<string, Quote>,
  categories: Category[],
  extras: ExtraCost[]
): Summary {
  const tiers = p.tiers;
  const T = tiers.length;
  const zeros = () => new Array<number>(T).fill(0);
  const catById = new Map(categories.map((c) => [c.id, c]));
  const lines = new Map<string, Line[]>();
  const groupMap = new Map<string, number[]>();
  let missing = 0;
  let estimated = 0;

  for (const it of items) {
    const ls = tiers.map((t) => lineFor(it, selected.get(it.id), t, p));
    lines.set(it.id, ls);
    if (ls.some((l) => l.state === 'missing')) missing++;
    else if (ls.some((l) => l.state === 'estimated')) estimated++;
    const cat = it.category_id ? catById.get(it.category_id) : undefined;
    const g = cat ? cat.burden_group || cat.name : 'ללא קטגוריה';
    const arr = groupMap.get(g) ?? zeros();
    ls.forEach((l, i) => (arr[i] += l.perSystem));
    groupMap.set(g, arr);
  }

  const groups: GroupRow[] = [...groupMap.entries()]
    .filter(([, v]) => v.some((x) => x > 0))
    .map(([name, totals]) => ({ name, totals, burden: totals.map((x) => burden(x, p)) }));

  const extraRows: GroupRow[] = extras.map((e) => {
    const totals = tiers.map((t) => toUsd(e.amounts[String(t)] ?? 0, e.currency, p));
    return { name: e.name, totals, burden: e.burden ? totals.map((x) => burden(x, p)) : zeros() };
  });

  const all = [...groups, ...extraRows];
  const bomTotal = tiers.map((_, i) => all.reduce((s, g) => s + g.totals[i], 0));
  const burdenTotal = tiers.map((_, i) => all.reduce((s, g) => s + g.burden[i], 0));
  const materials = bomTotal.map((x, i) => x + burdenTotal[i]);
  const laborHours = tiers.map((t) => Number(p.labor_hours[String(t)] ?? 0));
  const labor = laborHours.map((h) => h * p.labor_rate);
  const oh = labor.map((l) => l * p.oh_pct);
  const subtotal = materials.map((m, i) => m + labor[i] + oh[i]);
  const profit = subtotal.map((s) => s * p.profit_pct);
  const total = subtotal.map((s, i) => s + profit[i]);

  return { tiers, lines, groups, extras: extraRows, bomTotal, burdenTotal, materials, laborHours, labor, oh, subtotal, profit, total, missing, estimated };
}

/** מיפוי שוברי מחיר (qty בחלקים) למדרגות מערכות */
export function breaksToTierPrices(
  breaks: { qty_pieces?: number | null; unit_price: number }[],
  qtyPerSystem: number,
  tiers: number[]
): Record<string, number> {
  const sorted = [...breaks].filter((b) => Number.isFinite(b.unit_price)).sort((a, b) => (a.qty_pieces ?? 0) - (b.qty_pieces ?? 0));
  const out: Record<string, number> = {};
  if (!sorted.length) return out;
  for (const t of tiers) {
    const pieces = qtyPerSystem * t;
    let pick = sorted[0];
    for (const b of sorted) if ((b.qty_pieces ?? 0) <= pieces) pick = b;
    out[String(t)] = pick.unit_price;
  }
  return out;
}
