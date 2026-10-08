-- Supabase da EXECUTE a anon por defecto en funciones nuevas de public;
-- estas dos solo tienen sentido con sesión iniciada.
revoke execute on function public.claim_first_admin() from anon;
revoke execute on function public.add_admin(text) from anon;
comment on function public.create_order(jsonb) is 'Público a propósito: el cliente crea su pedido; recalcula precios y valida todo en el servidor.';
comment on function public.track_orders(jsonb) is 'Público a propósito: solo devuelve pedidos cuyo access_token conoce el cliente.';
comment on function public.customer_signal(uuid, uuid, text) is 'Público a propósito: requiere el access_token del pedido; solo 2 días.';
comment on function public.admin_setup_needed() is 'Público a propósito: solo dice si aún no existe ningún administrador.';
