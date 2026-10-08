export type Status = 'pendiente' | 'confirmado' | 'preparando' | 'en_camino' | 'entregado' | 'cancelado';

export const STATUS: Record<Status, { label: string; tone: string }> = {
  pendiente: { label: 'Pendiente', tone: 'warn' },
  confirmado: { label: 'Confirmado', tone: 'info' },
  preparando: { label: 'Preparando', tone: 'info' },
  en_camino: { label: 'En camino / listo', tone: 'info' },
  entregado: { label: 'Entregado', tone: 'good' },
  cancelado: { label: 'Cancelado', tone: 'bad' },
};

/** Siguiente paso natural de cada estado. */
export const NEXT: Partial<Record<Status, { to: Status; label: string }>> = {
  pendiente: { to: 'confirmado', label: 'Confirmar pedido' },
  confirmado: { to: 'preparando', label: 'Pasar a cocina' },
  preparando: { to: 'en_camino', label: 'Despachado / listo' },
  en_camino: { to: 'entregado', label: 'Marcar entregado' },
};

export const MODE_LABEL: Record<string, string> = { domicilio: 'Domicilio', recoger: 'Recoger', local: 'En el local' };
export const MODE_ICON: Record<string, string> = { domicilio: '🛵', recoger: '🏃', local: '🍽️' };

/** Un pedido "pendiente" con más de 30 min probablemente no se envió por WhatsApp. */
export const STALE_MIN = 30;
