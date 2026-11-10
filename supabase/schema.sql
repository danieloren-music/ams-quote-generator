-- =====================================================================
-- AMS RFQ - סכמה מלאה (גרסה 2). להרצה ב-Supabase SQL Editor על פרויקט חדש.
-- אם כבר הרצת את הגרסה הקודמת, הריצו קודם:
--   drop schema public cascade; create schema public;
--   grant usage on schema public to anon, authenticated, service_role;
--   grant all on schema public to postgres, service_role;
--   alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
--   alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
-- =====================================================================
create extension if not exists "pgcrypto";

-- ---------- הגדרות משתמש ----------
create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  display_name text,
  company text,
  email_subject_he text not null default 'בקשה להצעת מחיר – {{project}} – {{category}} [{{ref}}]',
  email_body_he text not null default E'שלום {{supplier}},\n\nמצורף קובץ עם החלקים הנדרשים. אבקש לקבל עבורם הצעת מחיר.\nנבקש מחיר ליחידה עבור הכמויות המצוינות בקובץ ({{tiers}} מערכות), כולל MOQ וזמן אספקה.\n\nאנא השיבו למייל זה ושמרו על קוד הבקשה בנושא: {{ref}}\n\nתודה,',
  email_subject_en text not null default 'Request for Quotation – {{project}} – {{category}} [{{ref}}]',
  email_body_en text not null default E'Hello {{supplier}},\n\nPlease find attached the list of required parts. We kindly ask for your quotation.\nPlease quote unit prices for the quantities listed in the file ({{tiers}} systems), including MOQ and lead time.\n\nPlease reply to this email and keep the reference code in the subject: {{ref}}\n\nThank you,',
  email_signature text,
  created_at timestamptz not null default now()
);

-- ---------- קטגוריות (ניתנות לעריכה) ----------
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 80),
  color text not null default '#0f7a89' check (color ~ '^#[0-9a-fA-F]{6}$'),
  burden_group text check (char_length(burden_group) <= 80),
  requires_rfq boolean not null default true,
  sort int not null default 100,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- ---------- ספקים ----------
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 120),
  phone text check (char_length(phone) <= 40),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table supplier_categories (
  supplier_id uuid not null references suppliers(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  primary key (supplier_id, category_id)
);

create table supplier_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  name text check (char_length(name) <= 120),
  created_at timestamptz not null default now(),
  unique (supplier_id, email)
);

-- ---------- לקוחות ----------
create table customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 120),
  contact_name text check (char_length(contact_name) <= 120),
  email text check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 40),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- ---------- פרויקטים ----------
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 160),
  customer_id uuid references customers(id) on delete set null,
  customer text check (char_length(customer) <= 120),  -- שם הלקוח (עותק לתצוגה וייצוא)
  description text check (char_length(description) <= 4000),
  status text not null default 'active' check (status in ('active','quoted','won','lost','archived')),
  tiers int[] not null default '{5,10,20,40,80}',
  fx_rate numeric not null default 3.64 check (fx_rate > 0),        -- ILS לדולר
  eur_rate numeric not null default 1.08 check (eur_rate > 0),      -- דולר ליורו
  labor_rate numeric not null default 50 check (labor_rate >= 0),
  oh_pct numeric not null default 0.20 check (oh_pct >= 0),
  profit_pct numeric not null default 0.18 check (profit_pct >= 0),
  burden_low_limit numeric not null default 1500,
  burden_high_limit numeric not null default 3000,
  burden_low_rate numeric not null default 0.15,
  burden_mid_rate numeric not null default 0.12,
  burden_high_rate numeric not null default 0.08,
  labor_hours jsonb not null default '{}'::jsonb,
  exclusions text not null default E'THE PRICE DOES NOT INCLUDE\n► ANY FAI EXPENSES (EXTERNAL/INTERNAL)\nLAB TESTING\n► no special packaging / ATP\nif needed will be quoted separately',
  created_at timestamptz not null default now()
);

create table bom_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  project_id uuid not null references projects(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  size_bytes int,
  created_at timestamptz not null default now()
);

create table bom_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  project_id uuid not null references projects(id) on delete cascade,
  bom_file_id uuid references bom_files(id) on delete set null,
  row_index int,
  item text not null check (char_length(item) between 1 and 120),
  revision text,
  description text,
  uom text,
  mpn text,
  manufacturer text,
  level int not null default 1,
  total_qty numeric not null default 1 check (total_qty >= 0),
  occurrences int not null default 1,
  is_assembly boolean not null default false,
  category_id uuid references categories(id) on delete set null,
  category_confidence numeric,
  category_source text not null default 'none' check (category_source in ('none','ai','manual')),
  sourcing text not null default 'rfq' check (sourcing in ('rfq','stock','internal','not_required')),
  internal_unit_cost numeric check (internal_unit_cost >= 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (project_id, item)
);
create index bom_items_project_idx on bom_items (project_id, category_id);

create table rfqs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  project_id uuid not null references projects(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  ref_code text not null unique,
  subject text not null,
  body text not null,
  to_emails text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','sent','replied','closed')),
  sent_via text check (sent_via in ('resend','manual')),
  sent_at timestamptz,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

create table rfq_items (
  rfq_id uuid not null references rfqs(id) on delete cascade,
  bom_item_id uuid not null references bom_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  project_id uuid not null references projects(id) on delete cascade,
  primary key (rfq_id, bom_item_id)
);

create table supplier_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  project_id uuid not null references projects(id) on delete cascade,
  rfq_id uuid references rfqs(id) on delete set null,
  source text not null default 'upload' check (source in ('upload','paste')),
  file_name text,
  storage_path text,
  parsed jsonb,
  summary text,
  status text not null default 'parsed' check (status in ('parsed','applied','failed')),
  created_at timestamptz not null default now()
);

create table quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  project_id uuid not null references projects(id) on delete cascade,
  bom_item_id uuid not null references bom_items(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,
  response_id uuid references supplier_responses(id) on delete set null,
  prices jsonb not null default '{}'::jsonb,       -- {"5": 21.5, "10": 18}  מחיר לכל מדרגת מערכות
  pack_size numeric check (pack_size > 0),         -- אם מוגדר: המחיר הוא לאריזה (MOQ)
  moq numeric,
  lead_time_days int,
  currency text not null default 'USD' check (currency in ('USD','ILS','EUR')),
  notes text,
  selected boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index quotes_one_selected on quotes (bom_item_id) where selected;

create table extra_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  currency text not null default 'USD' check (currency in ('USD','ILS','EUR')),
  amounts jsonb not null default '{}'::jsonb,      -- עלות ליחידה לכל מדרגה
  burden boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- RLS: כל משתמש רואה ומשנה רק את הנתונים שלו ----------
alter table user_settings enable row level security;
alter table categories enable row level security;
alter table suppliers enable row level security;
alter table supplier_categories enable row level security;
alter table supplier_contacts enable row level security;
alter table projects enable row level security;
alter table customers enable row level security;

create policy "own settings" on user_settings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own categories" on categories for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own suppliers" on suppliers for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own customers" on customers for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own projects" on projects for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
    and (customer_id is null or exists (select 1 from customers c where c.id = customer_id and c.user_id = auth.uid())));

create policy "own supplier_categories" on supplier_categories for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
    and exists (select 1 from suppliers s where s.id = supplier_id and s.user_id = auth.uid())
    and exists (select 1 from categories c where c.id = category_id and c.user_id = auth.uid()));
create policy "own supplier_contacts" on supplier_contacts for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
    and exists (select 1 from suppliers s where s.id = supplier_id and s.user_id = auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['bom_files','bom_items','rfqs','rfq_items','supplier_responses','quotes','extra_costs'] loop
    execute format('alter table %I enable row level security', t);
    execute format($p$
      create policy "own rows" on %I for all
      using (user_id = auth.uid())
      with check (user_id = auth.uid()
        and exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()))
    $p$, t);
  end loop;
end $$;

-- ---------- קטגוריות מוכנות (לפי הקובץ הסופי) ----------
create or replace function seed_defaults() returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  insert into user_settings (user_id) values (uid) on conflict do nothing;
  if exists (select 1 from categories where user_id = uid) then return; end if;
  insert into categories (user_id, name, color, burden_group, requires_rfq, sort) values
    (uid, 'Machined – מיוצר מעובד',     '#0f7a89', 'Mechanical',            true,  10),
    (uid, 'Sheet Metal – מיוצר פח',     '#2563eb', 'Mechanical',            true,  20),
    (uid, 'Optics – פריטים אופטיים',    '#7c3aed', 'Optics',                true,  30),
    (uid, 'Electronics – אלקטרוניקה',   '#d97706', 'Electronics',           true,  40),
    (uid, 'Cable & Wiring – צמות וחיווט','#b45309','Cables',                true,  50),
    (uid, 'Fasteners – ברגים',          '#475569', 'Screws & Consumables',  true,  60),
    (uid, 'Fasteners – אומים',          '#64748b', 'Other Fasteners',       true,  70),
    (uid, 'Fasteners – קשיחים',         '#64748b', 'Other Fasteners',       true,  80),
    (uid, 'Fasteners – פינים',          '#64748b', 'Other Fasteners',       true,  90),
    (uid, 'Fasteners – קפיצים',         '#64748b', 'Other Fasteners',       true, 100),
    (uid, 'Fasteners – דיסקיות',        '#64748b', 'Other Fasteners',       true, 110),
    (uid, 'Bulk – דבקים',               '#16a34a', 'Screws & Consumables',  true, 120),
    (uid, 'Bulk – חומרים',              '#15803d', 'Bulk Materials',        true, 130),
    (uid, 'Packaging – אריזות',         '#0891b2', 'Packaging',             true, 140),
    (uid, 'Buy – קנוי',                 '#db2777', 'Buy',                   true, 150),
    (uid, 'Labels – מדבקות',            '#9333ea', 'Screws & Consumables',  true, 160),
    (uid, 'Sub Assembly – תת הרכבה',    '#94a3b8', 'Sub Assembly',          false,170),
    (uid, 'Documents – מסמך/דיסק',      '#94a3b8', 'Documents',             false,180);
end $$;

-- ---------- Storage: buckets פרטיים, נתיב הקובץ מתחיל ב-<user_id>/ ----------
insert into storage.buckets (id, name, public, file_size_limit) values
  ('bom-files', 'bom-files', false, 5242880),
  ('supplier-responses', 'supplier-responses', false, 10485760)
on conflict (id) do update set public = false;

create policy "own files read" on storage.objects for select
  using (bucket_id in ('bom-files','supplier-responses') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files insert" on storage.objects for insert
  with check (bucket_id in ('bom-files','supplier-responses') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files delete" on storage.objects for delete
  using (bucket_id in ('bom-files','supplier-responses') and (storage.foldername(name))[1] = auth.uid()::text);
