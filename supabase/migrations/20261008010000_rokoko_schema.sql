-- =====================================================================
-- ROKOKO · esquema base: carta, opciones, pedidos, administradores.
-- Precios en pesos colombianos enteros (sin decimales).
-- =====================================================================

create schema if not exists private;

-- ---------------------------------------------------------------------
-- Administradores
-- ---------------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

-- ¿El usuario actual es administrador? (consulta interna, fuera del esquema expuesto)
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke execute on function private.is_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

-- ---------------------------------------------------------------------
-- Ajustes del restaurante (una sola fila)
-- ---------------------------------------------------------------------
create table public.settings (
  id smallint primary key default 1 check (id = 1),
  name text not null default 'Pollos Rokoko',
  claim text not null default 'Calidad y sabor sin límite',
  whatsapp text not null default '' check (whatsapp ~ '^[0-9]{0,15}$'),
  address text not null default '',
  phone text not null default '',
  -- { "0": ["11:00","21:00"], "1": [...] } · null = no mostrar horario
  hours jsonb,
  payment_methods text[] not null default array['Efectivo', 'Nequi', 'Daviplata', 'Transferencia'],
  delivery_note text not null default 'El valor del domicilio se confirma por WhatsApp según tu barrio.',
  ordering_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Carta
-- ---------------------------------------------------------------------
create table public.categories (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (length(name) between 1 and 60),
  icon text not null default '🍗',
  note text,
  allows_extras boolean not null default true,
  sort integer not null default 0,
  active boolean not null default true
);

create table public.products (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  category_id bigint not null references public.categories (id) on delete restrict,
  name text not null check (length(name) between 1 and 80),
  description text,
  tag text,
  icon text,
  photo_url text,
  sort integer not null default 0,
  active boolean not null default true,
  featured boolean not null default false,
  featured_sort integer not null default 0,
  is_extra boolean not null default false,    -- se ofrece en "Agrégale"
  is_upsell boolean not null default false,   -- se ofrece en "¿Le falta algo?"
  show_category_note boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_id_idx on public.products (category_id);

create table public.product_variants (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products (id) on delete cascade,
  label text not null default '',
  price integer not null check (price >= 0),
  sort integer not null default 0,
  unique (product_id, label)
);
create index product_variants_product_id_idx on public.product_variants (product_id);

-- Grupos de opciones reutilizables ("Papa", "Tipo de arroz", "Proteínas"...)
create table public.option_groups (
  id bigint generated always as identity primary key,
  name text not null,          -- nombre interno para el panel, p. ej. "Papa (francesa/criolla)"
  label text not null,         -- lo que ve el cliente, p. ej. "Papa"
  hint text,
  min_select integer not null default 1 check (min_select >= 0),
  max_select integer not null default 1 check (max_select >= 1 and max_select >= min_select)
);

create table public.option_choices (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.option_groups (id) on delete cascade,
  label text not null,
  price integer not null default 0 check (price >= 0),
  weight integer not null default 1 check (weight >= 1),
  sort integer not null default 0,
  active boolean not null default true
);
create index option_choices_group_id_idx on public.option_choices (group_id);

create table public.product_option_groups (
  product_id bigint not null references public.products (id) on delete cascade,
  group_id bigint not null references public.option_groups (id) on delete cascade,
  sort integer not null default 0,
  primary key (product_id, group_id)
);
create index product_option_groups_group_id_idx on public.product_option_groups (group_id);

-- Recomendaciones de "¿Para cuántos es?"
create table public.party_picks (
  id bigint generated always as identity primary key,
  party text not null check (party in ('1', '2', '4', '6')),
  product_id bigint not null references public.products (id) on delete cascade,
  variant_id bigint references public.product_variants (id) on delete set null,
  sort integer not null default 0
);
create index party_picks_product_id_idx on public.party_picks (product_id);
create index party_picks_variant_id_idx on public.party_picks (variant_id);

-- ---------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  -- secreto que solo conoce el navegador del cliente: le permite ver el estado
  -- y avisar "ya lo envié" / "me arrepentí" sin iniciar sesión
  access_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'pendiente'
    check (status in ('pendiente', 'confirmado', 'preparando', 'en_camino', 'entregado', 'cancelado')),
  status_changed_at timestamptz not null default now(),
  customer_signal text check (customer_signal in ('enviado', 'arrepentido')),
  customer_signal_at timestamptz,
  customer_name text not null check (length(customer_name) between 1 and 80),
  customer_phone text check (customer_phone ~ '^[0-9+ ]{7,20}$'),
  mode text not null check (mode in ('domicilio', 'recoger', 'local')),
  address text,
  barrio text,
  reference text,
  table_number text,
  payment text not null,
  cash_with integer check (cash_with >= 0),
  scheduled_time text check (scheduled_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  note text,
  items_count integer not null check (items_count > 0),
  subtotal integer not null check (subtotal >= 0),
  delivery_fee integer check (delivery_fee >= 0),
  total integer not null check (total >= 0),
  cancel_reason text,
  admin_note text
);
create index orders_created_at_idx on public.orders (created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id bigint references public.products (id) on delete set null,
  product_name text not null,
  category_name text not null default '',
  variant_label text not null default '',
  unit_price integer not null check (unit_price >= 0),
  qty integer not null check (qty between 1 and 99),
  line_total integer not null check (line_total >= 0),
  options jsonb not null default '[]'::jsonb,   -- [{ "group": "Papa", "choice": "Criolla", "price": 0 }]
  extras jsonb not null default '[]'::jsonb,    -- [{ "product_id": 1, "name": "Yuca", "price": 5000 }]
  note text
);
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);

-- updated_at / status_changed_at automáticos
create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger products_touch before update on public.products
  for each row execute function private.touch_updated_at();
create trigger settings_touch before update on public.settings
  for each row execute function private.touch_updated_at();

create or replace function private.touch_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;
create trigger orders_touch_status before update on public.orders
  for each row execute function private.touch_status();

-- ---------------------------------------------------------------------
-- Seguridad (RLS + permisos explícitos: las tablas nuevas no se exponen solas)
-- ---------------------------------------------------------------------
alter table public.admins enable row level security;
alter table public.settings enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.option_groups enable row level security;
alter table public.option_choices enable row level security;
alter table public.product_option_groups enable row level security;
alter table public.party_picks enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- admins: cada quien ve su fila; los admins ven todas
create policy admins_select on public.admins for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy admins_delete on public.admins for delete to authenticated
  using ((select private.is_admin()) and user_id <> (select auth.uid()));

-- Lectura pública de la carta (solo lo activo); los admins ven todo
create policy settings_read on public.settings for select to anon, authenticated using (true);
create policy categories_read on public.categories for select to anon, authenticated
  using (active or (select private.is_admin()));
create policy products_read on public.products for select to anon, authenticated
  using (active or (select private.is_admin()));
create policy variants_read on public.product_variants for select to anon, authenticated using (true);
create policy groups_read on public.option_groups for select to anon, authenticated using (true);
create policy choices_read on public.option_choices for select to anon, authenticated
  using (active or (select private.is_admin()));
create policy pog_read on public.product_option_groups for select to anon, authenticated using (true);
create policy party_read on public.party_picks for select to anon, authenticated using (true);

-- Escritura de la carta: solo admins
do $$
declare t text;
begin
  foreach t in array array['settings', 'categories', 'products', 'product_variants', 'option_groups',
                           'option_choices', 'product_option_groups', 'party_picks']
  loop
    execute format('create policy %1$s_admin_insert on public.%1$I for insert to authenticated with check ((select private.is_admin()))', t);
    execute format('create policy %1$s_admin_update on public.%1$I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
    execute format('create policy %1$s_admin_delete on public.%1$I for delete to authenticated using ((select private.is_admin()))', t);
  end loop;
end $$;

-- Pedidos: solo admins leen/actualizan. Nadie inserta directo: se crean con create_order().
create policy orders_admin_select on public.orders for select to authenticated using ((select private.is_admin()));
create policy orders_admin_update on public.orders for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy orders_admin_delete on public.orders for delete to authenticated using ((select private.is_admin()));
create policy order_items_admin_select on public.order_items for select to authenticated using ((select private.is_admin()));
create policy order_items_admin_delete on public.order_items for delete to authenticated using ((select private.is_admin()));

grant select on public.settings, public.categories, public.products, public.product_variants,
  public.option_groups, public.option_choices, public.product_option_groups, public.party_picks
  to anon, authenticated;
grant insert, update, delete on public.settings, public.categories, public.products, public.product_variants,
  public.option_groups, public.option_choices, public.product_option_groups, public.party_picks
  to authenticated;
grant select, delete on public.admins to authenticated;
grant select, update, delete on public.orders to authenticated;
grant select, delete on public.order_items to authenticated;

-- Avisos en vivo de pedidos nuevos para el panel
alter publication supabase_realtime add table public.orders;
