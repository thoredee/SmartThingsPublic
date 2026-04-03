-- Grocery Tracker Database Schema
-- Run this in the Supabase SQL editor (supabase.com → your project → SQL Editor)

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- HOUSEHOLDS
-- ─────────────────────────────────────────────
create table households (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────────
-- PROFILES  (linked to Supabase auth.users)
-- ─────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid references households(id),
  name text,
  email text,
  created_at timestamptz default now()
);

-- Auto-create a profile when a new user signs up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─────────────────────────────────────────────
-- RECEIPTS
-- ─────────────────────────────────────────────
create table receipts (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references households(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id),
  store text not null default 'Tesco',
  purchase_date date not null,
  total_amount numeric(10,2) not null,
  image_url text,
  created_at timestamptz default now()
);

create index receipts_household_date on receipts(household_id, purchase_date desc);

-- ─────────────────────────────────────────────
-- RECEIPT ITEMS
-- ─────────────────────────────────────────────
create type item_category as enum (
  'fresh-produce', 'dairy', 'meat-fish', 'bakery', 'frozen',
  'drinks', 'snacks', 'cleaning', 'personal-care', 'baby', 'other'
);

create table receipt_items (
  id uuid primary key default uuid_generate_v4(),
  receipt_id uuid not null references receipts(id) on delete cascade,
  name text not null,
  quantity numeric(10,3) not null default 1,
  unit text,
  unit_price numeric(10,2) not null,
  total_price numeric(10,2) not null,
  category item_category not null default 'other',
  created_at timestamptz default now()
);

create index receipt_items_receipt on receipt_items(receipt_id);

-- ─────────────────────────────────────────────
-- PANTRY ITEMS  (estimated current stock)
-- ─────────────────────────────────────────────
create table pantry_items (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  category item_category not null default 'other',
  estimated_quantity numeric(10,3) not null default 1,
  unit text,
  last_purchased_at date not null,
  avg_days_between_purchase numeric(6,1),
  updated_at timestamptz default now(),
  unique(household_id, name)
);

-- Function to upsert pantry item when a receipt is saved
create or replace function upsert_pantry_item(
  p_household_id uuid,
  p_name text,
  p_category item_category,
  p_quantity numeric,
  p_unit text,
  p_purchased_at date
)
returns void as $$
declare
  existing_item pantry_items%rowtype;
  days_since numeric;
begin
  select * into existing_item
  from pantry_items
  where household_id = p_household_id and lower(name) = lower(p_name);

  if not found then
    -- First time buying this item
    insert into pantry_items (household_id, name, category, estimated_quantity, unit, last_purchased_at)
    values (p_household_id, p_name, p_category, p_quantity, p_unit, p_purchased_at);
  else
    -- Calculate average days between purchases
    days_since := p_purchased_at - existing_item.last_purchased_at;

    update pantry_items set
      estimated_quantity = p_quantity,
      last_purchased_at = p_purchased_at,
      avg_days_between_purchase = case
        when existing_item.avg_days_between_purchase is null then days_since
        else round((existing_item.avg_days_between_purchase * 0.7 + days_since * 0.3)::numeric, 1)
      end,
      updated_at = now()
    where id = existing_item.id;
  end if;
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────
-- SHOPPING LIST
-- ─────────────────────────────────────────────
create table shopping_list (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  category item_category not null default 'other',
  quantity numeric(10,3) not null default 1,
  unit text,
  added_by uuid references auth.users(id),
  is_checked boolean not null default false,
  created_at timestamptz default now()
);

create index shopping_list_household on shopping_list(household_id, is_checked);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- Users can only see data from their own household
-- ─────────────────────────────────────────────
alter table households enable row level security;
alter table profiles enable row level security;
alter table receipts enable row level security;
alter table receipt_items enable row level security;
alter table pantry_items enable row level security;
alter table shopping_list enable row level security;

-- Profiles: users can read/update their own profile
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Helper function: get current user's household_id
create or replace function my_household_id()
returns uuid as $$
  select household_id from profiles where id = auth.uid();
$$ language sql security definer stable;

-- Households
create policy "Household members can view" on households
  for select using (id = my_household_id());

-- Receipts
create policy "Household members can view receipts" on receipts
  for select using (household_id = my_household_id());
create policy "Household members can insert receipts" on receipts
  for insert with check (household_id = my_household_id());

-- Receipt items
create policy "Household members can view items" on receipt_items
  for select using (
    receipt_id in (select id from receipts where household_id = my_household_id())
  );
create policy "Household members can insert items" on receipt_items
  for insert with check (
    receipt_id in (select id from receipts where household_id = my_household_id())
  );

-- Pantry
create policy "Household members can view pantry" on pantry_items
  for select using (household_id = my_household_id());
create policy "Household members can manage pantry" on pantry_items
  for all using (household_id = my_household_id());

-- Shopping list
create policy "Household members can view shopping list" on shopping_list
  for select using (household_id = my_household_id());
create policy "Household members can manage shopping list" on shopping_list
  for all using (household_id = my_household_id());
