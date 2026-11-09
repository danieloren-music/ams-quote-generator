-- AMS RFQ: סכמה ראשונית
create extension if not exists "pgcrypto";

-- ===== טבלאות =====
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  customer text,
  description text,
  created_at timestamptz not null default now()
);

create table bom_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

create table bom_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  bom_file_id uuid references bom_files(id) on delete cascade,
  row_index int,
  part_number text,
  description text,
  quantity numeric,
  raw jsonb,                       -- השורה המקורית מה-Excel
  category text check (category in
    ('mechanics','sheet_metal','fasteners','packaging','optic','electronic')),
  category_confidence numeric,     -- 0..1 מ-Gemini; נמוך = לבדיקה ידנית
  category_source text default 'ai' check (category_source in ('ai','manual')),
  created_at timestamptz not null default now()
);
create index on bom_items (project_id, category);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  category text not null check (category in
    ('mechanics','sheet_metal','fasteners','packaging','optic','electronic')),
  emails text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table rfqs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  supplier_id uuid not null references suppliers(id),
  category text not null,
  subject text,
  body text,
  status text not null default 'sent' check (status in ('draft','sent','replied')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table rfq_items (
  rfq_id uuid not null references rfqs(id) on delete cascade,
  bom_item_id uuid not null references bom_items(id) on delete cascade,
  primary key (rfq_id, bom_item_id)
);

-- תשובה שהועלתה ידנית (PDF / EML / טקסט)
create table supplier_responses (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references rfqs(id) on delete cascade,
  file_name text,
  storage_path text,
  raw_text text,
  parsed jsonb,
  created_at timestamptz not null default now()
);

create table quotes (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references supplier_responses(id) on delete cascade,
  bom_item_id uuid references bom_items(id) on delete cascade,
  unit_price numeric,
  currency text default 'USD',
  lead_time_days int,
  moq numeric,
  notes text
);

-- ===== RLS: כל משתמש רואה רק את הנתונים שלו =====
alter table projects enable row level security;
alter table bom_files enable row level security;
alter table bom_items enable row level security;
alter table suppliers enable row level security;
alter table rfqs enable row level security;
alter table rfq_items enable row level security;
alter table supplier_responses enable row level security;
alter table quotes enable row level security;

create policy "own projects" on projects for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own suppliers" on suppliers for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own bom_files" on bom_files for all
  using (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));

create policy "own bom_items" on bom_items for all
  using (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));

create policy "own rfqs" on rfqs for all
  using (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));

create policy "own rfq_items" on rfq_items for all
  using (exists (select 1 from rfqs r join projects p on p.id = r.project_id
                 where r.id = rfq_id and p.user_id = auth.uid()))
  with check (exists (select 1 from rfqs r join projects p on p.id = r.project_id
                 where r.id = rfq_id and p.user_id = auth.uid()));

create policy "own responses" on supplier_responses for all
  using (exists (select 1 from rfqs r join projects p on p.id = r.project_id
                 where r.id = rfq_id and p.user_id = auth.uid()))
  with check (exists (select 1 from rfqs r join projects p on p.id = r.project_id
                 where r.id = rfq_id and p.user_id = auth.uid()));

create policy "own quotes" on quotes for all
  using (exists (select 1 from supplier_responses sr
                 join rfqs r on r.id = sr.rfq_id join projects p on p.id = r.project_id
                 where sr.id = response_id and p.user_id = auth.uid()))
  with check (exists (select 1 from supplier_responses sr
                 join rfqs r on r.id = sr.rfq_id join projects p on p.id = r.project_id
                 where sr.id = response_id and p.user_id = auth.uid()));

-- ===== Storage: bucket פרטי, נתיב הקובץ מתחיל ב-<user_id>/ =====
insert into storage.buckets (id, name, public) values
  ('bom-files', 'bom-files', false),
  ('supplier-responses', 'supplier-responses', false)
on conflict do nothing;

create policy "own files read" on storage.objects for select
  using (bucket_id in ('bom-files','supplier-responses')
         and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files insert" on storage.objects for insert
  with check (bucket_id in ('bom-files','supplier-responses')
         and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files delete" on storage.objects for delete
  using (bucket_id in ('bom-files','supplier-responses')
         and (storage.foldername(name))[1] = auth.uid()::text);
