export type Sourcing = 'rfq' | 'stock' | 'internal' | 'not_required';
export const SOURCING_LABELS: Record<Sourcing, string> = {
  rfq: 'דורש הצעת מחיר',
  stock: 'מהמלאי',
  internal: 'עלות פנימית',
  not_required: 'לא נדרש',
};

export type Currency = 'USD' | 'ILS' | 'EUR';

export interface Category {
  id: string;
  name: string;
  color: string;
  burden_group: string | null;
  requires_rfq: boolean;
  sort: number;
}

export interface Contact { id: string; supplier_id: string; email: string; name: string | null }

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  contacts: Contact[];
  category_ids: string[];
}

export interface Project {
  id: string;
  name: string;
  customer: string | null;
  description: string | null;
  status: 'active' | 'quoted' | 'won' | 'lost' | 'archived';
  tiers: number[];
  fx_rate: number;
  eur_rate: number;
  labor_rate: number;
  oh_pct: number;
  profit_pct: number;
  burden_low_limit: number;
  burden_high_limit: number;
  burden_low_rate: number;
  burden_mid_rate: number;
  burden_high_rate: number;
  labor_hours: Record<string, number>;
  exclusions: string;
  created_at: string;
}

export const STATUS_LABELS: Record<Project['status'], string> = {
  active: 'בעבודה',
  quoted: 'הצעה נשלחה',
  won: 'נסגר',
  lost: 'לא נסגר',
  archived: 'בארכיון',
};

export interface BomItem {
  id: string;
  project_id: string;
  item: string;
  revision: string | null;
  description: string | null;
  uom: string | null;
  mpn: string | null;
  manufacturer: string | null;
  level: number;
  total_qty: number;
  occurrences: number;
  is_assembly: boolean;
  category_id: string | null;
  category_confidence: number | null;
  category_source: 'none' | 'ai' | 'manual';
  sourcing: Sourcing;
  internal_unit_cost: number | null;
  notes: string | null;
}

export interface Quote {
  id: string;
  bom_item_id: string;
  supplier_id: string | null;
  response_id: string | null;
  prices: Record<string, number>;
  pack_size: number | null;
  moq: number | null;
  lead_time_days: number | null;
  currency: Currency;
  notes: string | null;
  selected: boolean;
}

export interface ExtraCost {
  id: string;
  name: string;
  currency: Currency;
  amounts: Record<string, number>;
  burden: boolean;
}

export interface Rfq {
  id: string;
  project_id: string;
  supplier_id: string | null;
  category_id: string | null;
  ref_code: string;
  subject: string;
  to_emails: string[];
  status: 'draft' | 'sent' | 'replied' | 'closed';
  sent_via: 'resend' | 'manual' | null;
  sent_at: string | null;
  replied_at: string | null;
  created_at: string;
}

export const RFQ_STATUS_LABELS: Record<Rfq['status'], string> = {
  draft: 'טיוטה',
  sent: 'נשלח, ממתין לתשובה',
  replied: 'התקבלה תשובה',
  closed: 'סגור',
};
