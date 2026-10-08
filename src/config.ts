// Valores de RESPALDO del restaurante: solo se usan si Supabase no responde en la primera visita.
// Los datos reales (WhatsApp, horario, pagos…) se editan en el panel /admin → Ajustes.

/** Número de WhatsApp que recibe los pedidos: indicativo + número, sin espacios ni "+". Ej: '573001234567'. */
export const WHATSAPP = '573242332549';

/** Dirección y teléfono que se muestran en el pie de página. Vacío = no se muestra. */
export const ADDRESS = '';
export const PHONE = '';

/**
 * Horario de atención por día (0 = domingo … 6 = sábado), en formato 24 h 'HH:MM'.
 * Pon `null` para no mostrar el estado "Abierto / Cerrado".
 * Ejemplo: { 0: ['11:00', '21:00'], 1: ['11:00', '22:00'], ... }
 */
export const HOURS: Partial<Record<number, [string, string]>> | null = null;

/** Formas de pago que aparecen al finalizar el pedido. */
export const PAYMENT_METHODS = ['Efectivo', 'Nequi', 'Daviplata', 'Transferencia'] as const;

/** Texto sobre el domicilio que se muestra en el pedido. */
export const DELIVERY_NOTE = 'El valor del domicilio se confirma por WhatsApp según tu barrio.';
