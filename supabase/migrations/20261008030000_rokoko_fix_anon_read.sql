-- Los visitantes (anon) no pueden ejecutar private.is_admin(); si la política
-- la menciona, leer la carta falla con "permission denied for function is_admin".
-- Se separan: anon solo ve lo activo; authenticated ve lo activo o todo si es admin.

alter policy categories_read on public.categories to authenticated using (active or (select private.is_admin()));
alter policy products_read on public.products to authenticated using (active or (select private.is_admin()));
alter policy choices_read on public.option_choices to authenticated using (active or (select private.is_admin()));

create policy categories_read_anon on public.categories for select to anon using (active);
create policy products_read_anon on public.products for select to anon using (active);
create policy choices_read_anon on public.option_choices for select to anon using (active);
