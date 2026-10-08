# Pollos Rokoko · Carta y pedidos

Carta digital (React + Vite) con pedidos por WhatsApp y panel de administración sobre Supabase.

## Qué hay

- **Carta pública** (`/`): carta con personalización (horno/frito, papa, chino/paisa, proteínas…), adicionales, favoritos,
  "¿Para cuántos es?", pedido con envío por WhatsApp y **seguimiento del pedido** en vivo.
- **Panel** (`/admin`): pedidos en vivo con alerta sonora, estados (pendiente → confirmado → preparando → en camino → entregado),
  métricas (ventas, lo más y lo menos pedido, horas, días, opciones, entrega y pago), editor de carta, opciones,
  destacados, ajustes del negocio (WhatsApp, horario, pagos, pausar pedidos) y equipo.

## Cómo funciona un pedido

1. El cliente toca **Enviar pedido por WhatsApp** → se crea en Supabase con `create_order()` como **pendiente**.
   El servidor recalcula todos los precios: lo que mande el navegador no puede alterarlos.
2. Se abre WhatsApp con el pedido escrito y su código (RK-XXXXX). El cliente puede marcar en la página
   "Sí, ya lo envié" o "Me arrepentí" (este último lo cancela).
3. En el panel lo confirmas y avanzas el estado; el cliente lo ve en la página. Si queda **pendiente más de 30 min**
   sin señal del cliente, el panel avisa que probablemente nunca se envió.
4. Las métricas solo cuentan como venta lo confirmado/preparando/en camino/entregado.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173  ·  panel en http://localhost:5173/admin
npm run build      # versión para publicar en dist/
```

Variables en `.env.local` (ver `.env.example`): `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`
(la llave *publishable* es pública por diseño; la seguridad la dan las reglas RLS de la base).

## Base de datos (Supabase)

- Migraciones en `supabase/migrations/` (ya aplicadas al proyecto `ROKOKO`), carga inicial en `supabase/seed.sql`.
- `src/data/menu.ts` es solo el respaldo sin conexión y la fuente del seed; **la carta real se edita en `/admin`**.

## Primer uso del panel

1. Entra a `/admin` → **Crear cuenta** → confirma el correo.
2. Inicia sesión: como aún no hay administradores, te ofrece ser el **administrador principal**.
3. Para sumar personas: ellas crean su cuenta y tú las agregas en **Equipo**.

## Publicar (Cloudflare Pages + GitHub)

- Cada push a `main` lo publica Cloudflare Pages automáticamente; cada rama o PR genera una vista previa.
- GitHub Actions (`.github/workflows/ci.yml`) revisa tipos y compila en cada push y PR.
- Configuración en Cloudflare Pages: framework **Vite**, build `npm run build`, salida `dist`, variables
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` y `NODE_VERSION=22`.
- `/admin` funciona gracias a `public/_redirects`.
- En Supabase → Authentication → URL Configuration pon la URL final como **Site URL** y agrega
  `https://TU-DOMINIO/admin` (y `http://localhost:5173/admin`) a **Redirect URLs**.
