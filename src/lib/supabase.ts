import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/**
 * Cliente de Supabase, o null si el proyecto no está configurado (.env.local).
 * Sin Supabase la carta sigue funcionando con los datos empaquetados,
 * y los pedidos se envían por WhatsApp sin quedar registrados.
 */
export const supabase = url && key ? createClient<Database>(url, key) : null;

/** Convierte un error de Postgres/RPC en un código corto ("ordering_disabled", "invalid_options:26"…). */
export function rpcErrorCode(error: { message?: string } | null | undefined): string {
  return (error?.message ?? '').split(':')[0].trim();
}
