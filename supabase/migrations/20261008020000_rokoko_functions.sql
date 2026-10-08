-- =====================================================================
-- ROKOKO · funciones: pedidos (cliente), administradores, métricas, fotos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- create_order: el cliente crea su pedido. El servidor recalcula TODO
-- (precios, opciones, adicionales) desde la carta; lo que mande el
-- navegador solo se usa para saber qué eligió, nunca cuánto cuesta.
-- Es SECURITY DEFINER porque anon no puede insertar en orders.
-- ---------------------------------------------------------------------
create or replace function public.create_order(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c jsonb := coalesce(p -> 'customer', '{}'::jsonb);
  it jsonb;
  st public.settings;
  v_order_id uuid;
  v_code text;
  v_token uuid;
  v_product public.products;
  v_category public.categories;
  v_variant public.product_variants;
  v_unit integer;
  v_qty integer;
  v_line integer;
  v_subtotal integer := 0;
  v_count integer := 0;
  v_opts jsonb;
  v_extras jsonb;
  v_items jsonb := '[]'::jsonb;
  v_weight integer;
  v_choice_ids bigint[];
  v_extra_ids bigint[];
  g record;
  ch record;
  ex record;
  v_mode text := c ->> 'mode';
  v_name text := btrim(coalesce(c ->> 'name', ''));
  v_phone text := nullif(regexp_replace(coalesce(c ->> 'phone', ''), '[^0-9+ ]', '', 'g'), '');
  v_time text := nullif(c ->> 'scheduled_time', '');
  v_cash integer := nullif(regexp_replace(coalesce(c ->> 'cash_with', ''), '[^0-9]', '', 'g'), '')::integer;
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
begin
  select * into st from public.settings where id = 1;
  if st.id is null or not st.ordering_enabled then
    raise exception 'ordering_disabled';
  end if;

  if jsonb_typeof(p -> 'items') is distinct from 'array'
     or jsonb_array_length(p -> 'items') = 0
     or jsonb_array_length(p -> 'items') > 50 then
    raise exception 'invalid_items';
  end if;
  if length(v_name) = 0 or length(v_name) > 80 then raise exception 'invalid_name'; end if;
  if v_mode is null or v_mode not in ('domicilio', 'recoger', 'local') then raise exception 'invalid_mode'; end if;
  if v_mode = 'domicilio'
     and (coalesce(btrim(c ->> 'address'), '') = '' or coalesce(btrim(c ->> 'barrio'), '') = '') then
    raise exception 'invalid_address';
  end if;
  if not ((c ->> 'payment') = any (st.payment_methods)) then raise exception 'invalid_payment'; end if;
  if v_phone is not null and v_phone !~ '^[0-9+ ]{7,20}$' then raise exception 'invalid_phone'; end if;

  -- Código corto y único, p. ej. RK-7Q3FX
  loop
    v_code := 'RK-';
    for i in 1..5 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    end loop;
    exit when not exists (select 1 from public.orders o where o.code = v_code);
  end loop;

  insert into public.orders (
    code, customer_name, customer_phone, mode, address, barrio, reference, table_number,
    payment, cash_with, scheduled_time, note, items_count, subtotal, total
  ) values (
    v_code,
    v_name,
    v_phone,
    v_mode,
    case when v_mode = 'domicilio' then left(btrim(c ->> 'address'), 160) end,
    case when v_mode = 'domicilio' then left(btrim(c ->> 'barrio'), 80) end,
    case when v_mode = 'domicilio' then nullif(left(btrim(coalesce(c ->> 'reference', '')), 160), '') end,
    case when v_mode = 'local' then nullif(left(btrim(coalesce(c ->> 'table', '')), 10), '') end,
    c ->> 'payment',
    case when (c ->> 'payment') = 'Efectivo' then v_cash end,
    v_time,
    nullif(left(btrim(coalesce(c ->> 'note', '')), 200), ''),
    1, 0, 0
  )
  returning id, access_token into v_order_id, v_token;

  for it in select value from jsonb_array_elements(p -> 'items') loop
    v_qty := (it ->> 'qty')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 99 then raise exception 'invalid_qty'; end if;

    select * into v_product from public.products pr where pr.id = (it ->> 'product_id')::bigint and pr.active;
    if v_product.id is null then raise exception 'product_unavailable:%', it ->> 'product_id'; end if;
    select * into v_category from public.categories ca where ca.id = v_product.category_id;
    if not v_category.active then raise exception 'product_unavailable:%', v_product.id; end if;

    v_variant := null;
    select * into v_variant from public.product_variants pv
      where pv.id = (it ->> 'variant_id')::bigint and pv.product_id = v_product.id;
    if v_variant.id is null then raise exception 'invalid_variant:%', v_product.id; end if;
    v_unit := v_variant.price;

    -- Opciones: deben ser de grupos asignados al plato, activas, sin repetir, y cumplir mín/máx.
    v_choice_ids := coalesce(
      array(select distinct (e)::bigint from jsonb_array_elements_text(coalesce(it -> 'choices', '[]'::jsonb)) e),
      '{}');
    if jsonb_array_length(coalesce(it -> 'choices', '[]'::jsonb)) <> cardinality(v_choice_ids) then
      raise exception 'invalid_choice:%', v_product.id;
    end if;
    if exists (
      select 1 from unnest(v_choice_ids) as cid
      where not exists (
        select 1 from public.option_choices oc
        join public.product_option_groups pog on pog.group_id = oc.group_id
        where oc.id = cid and oc.active and pog.product_id = v_product.id)
    ) then
      raise exception 'invalid_choice:%', v_product.id;
    end if;

    v_opts := '[]'::jsonb;
    for g in
      select og.id, og.label, og.min_select, og.max_select
      from public.product_option_groups pog
      join public.option_groups og on og.id = pog.group_id
      where pog.product_id = v_product.id
      order by pog.sort, og.id
    loop
      select coalesce(sum(oc.weight), 0) into v_weight
        from public.option_choices oc where oc.group_id = g.id and oc.id = any (v_choice_ids);
      if v_weight < g.min_select or v_weight > g.max_select then
        raise exception 'invalid_options:%', v_product.id;
      end if;
      for ch in
        select oc.id, oc.label, oc.price from public.option_choices oc
        where oc.group_id = g.id and oc.id = any (v_choice_ids)
        order by oc.sort, oc.id
      loop
        v_unit := v_unit + ch.price;
        v_opts := v_opts || jsonb_build_object('group', g.label, 'choice', ch.label, 'price', ch.price, 'choice_id', ch.id);
      end loop;
    end loop;

    -- Adicionales ("Agrégale"): productos marcados como is_extra, a su precio de carta.
    v_extra_ids := coalesce(
      array(select distinct (e)::bigint from jsonb_array_elements_text(coalesce(it -> 'extras', '[]'::jsonb)) e),
      '{}');
    v_extras := '[]'::jsonb;
    if cardinality(v_extra_ids) > 0 then
      if not v_category.allows_extras then raise exception 'extras_not_allowed:%', v_product.id; end if;
      for ex in
        select pr.id, pr.name,
               (select pv.price from public.product_variants pv where pv.product_id = pr.id order by pv.sort, pv.price limit 1) as price
        from public.products pr
        where pr.id = any (v_extra_ids) and pr.is_extra and pr.active
        order by pr.sort, pr.id
      loop
        if ex.price is null then raise exception 'invalid_extra'; end if;
        v_unit := v_unit + ex.price;
        v_extras := v_extras || jsonb_build_object('product_id', ex.id, 'name', ex.name, 'price', ex.price);
      end loop;
      if jsonb_array_length(v_extras) <> cardinality(v_extra_ids) then raise exception 'invalid_extra'; end if;
    end if;

    v_line := v_unit * v_qty;
    v_subtotal := v_subtotal + v_line;
    v_count := v_count + v_qty;

    insert into public.order_items (
      order_id, product_id, product_name, category_name, variant_label,
      unit_price, qty, line_total, options, extras, note
    ) values (
      v_order_id, v_product.id, v_product.name, v_category.name, v_variant.label,
      v_unit, v_qty, v_line, v_opts, v_extras,
      nullif(left(btrim(coalesce(it ->> 'note', '')), 140), '')
    );

    v_items := v_items || jsonb_build_object(
      'product_id', v_product.id, 'name', v_product.name, 'variant', v_variant.label,
      'qty', v_qty, 'unit', v_unit, 'line', v_line, 'options', v_opts, 'extras', v_extras,
      'note', nullif(left(btrim(coalesce(it ->> 'note', '')), 140), ''));
  end loop;

  update public.orders
    set items_count = v_count, subtotal = v_subtotal, total = v_subtotal
    where id = v_order_id;

  return jsonb_build_object(
    'id', v_order_id, 'code', v_code, 'token', v_token,
    'subtotal', v_subtotal, 'total', v_subtotal, 'items_count', v_count, 'items', v_items);
end;
$$;
revoke execute on function public.create_order(jsonb) from public;
grant execute on function public.create_order(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Seguimiento del pedido por el cliente (con su token secreto)
-- ---------------------------------------------------------------------
create or replace function public.track_orders(p_orders jsonb)
returns table (
  id uuid, code text, status text, status_changed_at timestamptz,
  created_at timestamptz, total integer, delivery_fee integer, customer_signal text
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.code, o.status, o.status_changed_at, o.created_at, o.total, o.delivery_fee, o.customer_signal
  from jsonb_array_elements(case when jsonb_typeof(p_orders) = 'array' then p_orders else '[]'::jsonb end) with ordinality as r(v, n)
  join public.orders o
    on o.id = (r.v ->> 'id')::uuid and o.access_token = (r.v ->> 'token')::uuid
  where r.n <= 10;
$$;
revoke execute on function public.track_orders(jsonb) from public;
grant execute on function public.track_orders(jsonb) to anon, authenticated;

-- El cliente avisa "ya lo envié" o "me arrepentí" (solo durante 2 días)
create or replace function public.customer_signal(p_id uuid, p_token uuid, p_signal text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_status text;
begin
  if p_signal not in ('enviado', 'arrepentido') then raise exception 'invalid_signal'; end if;
  update public.orders o
    set customer_signal = p_signal,
        customer_signal_at = now(),
        status = case when p_signal = 'arrepentido' and o.status = 'pendiente' then 'cancelado' else o.status end,
        cancel_reason = case when p_signal = 'arrepentido' and o.status = 'pendiente'
                             then 'El cliente lo canceló desde la página' else o.cancel_reason end
    where o.id = p_id and o.access_token = p_token and o.created_at > now() - interval '2 days'
    returning o.status into v_status;
  if v_status is null then raise exception 'order_not_found'; end if;
  return v_status;
end;
$$;
revoke execute on function public.customer_signal(uuid, uuid, text) from public;
grant execute on function public.customer_signal(uuid, uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Administradores
-- ---------------------------------------------------------------------
-- ¿Ya hay algún administrador? (para mostrar "crear la primera cuenta")
create or replace function public.admin_setup_needed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.admins);
$$;
revoke execute on function public.admin_setup_needed() from public;
grant execute on function public.admin_setup_needed() to anon, authenticated;

-- La primera cuenta que lo pida se vuelve administradora. Después, nunca más.
create or replace function public.claim_first_admin()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  lock table public.admins in exclusive mode;
  if exists (select 1 from public.admins) then raise exception 'admins_exist'; end if;
  insert into public.admins (user_id, email)
    select u.id, coalesce(u.email, '') from auth.users u where u.id = v_uid;
  return true;
end;
$$;
revoke execute on function public.claim_first_admin() from public;
grant execute on function public.claim_first_admin() to authenticated;

-- Un admin agrega a otra persona que ya creó su cuenta.
create or replace function public.add_admin(p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid; v_mail text;
begin
  if not (select private.is_admin()) then raise exception 'not_admin'; end if;
  select u.id, u.email into v_user, v_mail from auth.users u where lower(u.email) = lower(btrim(p_email)) limit 1;
  if v_user is null then raise exception 'user_not_found'; end if;
  insert into public.admins (user_id, email) values (v_user, v_mail) on conflict (user_id) do nothing;
  return true;
end;
$$;
revoke execute on function public.add_admin(text) from public;
grant execute on function public.add_admin(text) to authenticated;

-- ---------------------------------------------------------------------
-- Métricas para el panel (SECURITY INVOKER: respeta RLS, solo admins ven datos)
-- Zona horaria del negocio: America/Bogota.
-- ---------------------------------------------------------------------
create or replace function public.admin_metrics(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result jsonb;
  tz constant text := 'America/Bogota';
begin
  if not (select private.is_admin()) then raise exception 'not_admin'; end if;

  with o as (
    select * from public.orders where created_at >= p_from and created_at < p_to
  ),
  sold as (
    select * from o where status in ('confirmado', 'preparando', 'en_camino', 'entregado')
  ),
  items as (
    select oi.* from public.order_items oi join sold on sold.id = oi.order_id
  ),
  days as (
    select d::date as day
    from generate_series((p_from at time zone tz)::date, ((p_to - interval '1 second') at time zone tz)::date, interval '1 day') d
  )
  select jsonb_build_object(
    'kpis', jsonb_build_object(
      'orders', (select count(*) from o),
      'sold', (select count(*) from sold),
      'pending', (select count(*) from o where status = 'pendiente'),
      'pending_stale', (select count(*) from o where status = 'pendiente' and created_at < now() - interval '2 hours'),
      'cancelled', (select count(*) from o where status = 'cancelado'),
      'customer_regret', (select count(*) from o where customer_signal = 'arrepentido'),
      'customer_sent', (select count(*) from o where customer_signal = 'enviado'),
      'revenue', (select coalesce(sum(total), 0) from sold),
      'avg_ticket', (select coalesce(round(avg(total)), 0) from sold),
      'items_sold', (select coalesce(sum(qty), 0) from items)
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', days.day,
        'orders', (select count(*) from o where (o.created_at at time zone tz)::date = days.day),
        'sold', (select count(*) from sold where (sold.created_at at time zone tz)::date = days.day),
        'revenue', (select coalesce(sum(total), 0) from sold where (sold.created_at at time zone tz)::date = days.day)
      ) order by days.day), '[]'::jsonb)
      from days
    ),
    'hours', (
      select jsonb_agg(jsonb_build_object(
        'hour', h,
        'orders', (select count(*) from o where o.status <> 'cancelado' and extract(hour from o.created_at at time zone tz) = h)
      ) order by h)
      from generate_series(0, 23) h
    ),
    'weekdays', (
      select jsonb_agg(jsonb_build_object(
        'dow', d,
        'orders', (select count(*) from o where o.status <> 'cancelado' and extract(dow from o.created_at at time zone tz) = d)
      ) order by d)
      from generate_series(0, 6) d
    ),
    'top', (
      select coalesce(jsonb_agg(t order by t.qty desc, t.revenue desc), '[]'::jsonb) from (
        select coalesce(i.product_id::text, i.product_name) as key, max(i.product_name) as name,
               max(i.category_name) as category, sum(i.qty)::integer as qty, sum(i.line_total)::integer as revenue
        from items i group by 1 order by qty desc, revenue desc limit 10
      ) t
    ),
    'least', (
      select coalesce(jsonb_agg(t order by t.qty, t.name), '[]'::jsonb) from (
        select pr.id, pr.name, ca.name as category, coalesce(sum(i.qty), 0)::integer as qty
        from public.products pr
        join public.categories ca on ca.id = pr.category_id
        left join items i on i.product_id = pr.id
        where pr.active and ca.active
        group by pr.id, pr.name, ca.name
        order by qty, pr.name limit 10
      ) t
    ),
    'categories', (
      select coalesce(jsonb_agg(t order by t.revenue desc), '[]'::jsonb) from (
        select i.category_name as name, sum(i.qty)::integer as qty, sum(i.line_total)::integer as revenue
        from items i group by i.category_name
      ) t
    ),
    'options', (
      select coalesce(jsonb_agg(t order by t.qty desc), '[]'::jsonb) from (
        select op ->> 'group' as "group", op ->> 'choice' as choice, sum(i.qty)::integer as qty
        from items i cross join lateral jsonb_array_elements(i.options) op
        group by 1, 2 order by qty desc limit 15
      ) t
    ),
    'modes', (
      select coalesce(jsonb_agg(jsonb_build_object('mode', mode, 'orders', n, 'revenue', rev) order by n desc), '[]'::jsonb)
      from (select mode, count(*) n, coalesce(sum(total), 0) rev from sold group by mode) t
    ),
    'payments', (
      select coalesce(jsonb_agg(jsonb_build_object('payment', payment, 'orders', n) order by n desc), '[]'::jsonb)
      from (select payment, count(*) n from sold group by payment) t
    )
  ) into result;

  return result;
end;
$$;
revoke execute on function public.admin_metrics(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_metrics(timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- Fotos de la carta (Storage): lectura pública, escritura solo admins
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu', 'menu', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy menu_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'menu' and (select private.is_admin()));
create policy menu_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'menu' and (select private.is_admin()));
create policy menu_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'menu' and (select private.is_admin()))
  with check (bucket_id = 'menu' and (select private.is_admin()));
create policy menu_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'menu' and (select private.is_admin()));
