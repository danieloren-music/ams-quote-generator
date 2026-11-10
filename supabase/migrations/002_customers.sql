-- =====================================================================
-- שדרוג v0.3: ניהול לקוחות
-- להרצה פעם אחת ב-Supabase SQL Editor על מסד נתונים קיים (בטוח להרצה חוזרת).
-- =====================================================================

create table if not exists customers (
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

alter table customers enable row level security;
drop policy if exists "own customers" on customers;
create policy "own customers" on customers for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table projects add column if not exists customer_id uuid references customers(id) on delete set null;
create index if not exists projects_customer_idx on projects (customer_id);

-- הפרויקט יכול להצביע רק על לקוח שלו
drop policy if exists "own projects" on projects;
create policy "own projects" on projects for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
    and (customer_id is null or exists (select 1 from customers c where c.id = customer_id and c.user_id = auth.uid())));

-- העברת שמות הלקוחות הקיימים (טקסט חופשי בפרויקטים) לטבלת הלקוחות וקישור אליהם
insert into customers (user_id, name)
select distinct p.user_id, left(trim(p.customer), 120)
from projects p
where p.customer is not null and trim(p.customer) <> ''
on conflict (user_id, name) do nothing;

update projects p set customer_id = c.id
from customers c
where p.customer_id is null and c.user_id = p.user_id and c.name = left(trim(p.customer), 120);
