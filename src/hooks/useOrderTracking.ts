import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { PastOrder } from './useCart';

export type OrderStatus = 'pendiente' | 'confirmado' | 'preparando' | 'en_camino' | 'entregado' | 'cancelado';

export type Tracked = {
  id: string;
  code: string;
  status: OrderStatus;
  statusChangedAt: string;
  total: number;
  deliveryFee: number | null;
  customerSignal: string | null;
};

const FINAL: OrderStatus[] = ['entregado', 'cancelado'];
const WINDOW = 24 * 60 * 60 * 1000;

/** Consulta el estado de los pedidos recientes del cliente (cada 20 s mientras la pestaña está visible). */
export function useOrderTracking(history: PastOrder[]): Record<string, Tracked> {
  const [state, setState] = useState<Record<string, Tracked>>({});
  const recent = history.filter((o) => o.id && o.token && Date.now() - o.date < WINDOW);
  const key = recent.map((o) => o.id).join(',');

  useEffect(() => {
    if (!supabase || !recent.length) return;
    let alive = true;
    let timer = 0;

    const poll = async () => {
      const { data, error } = await supabase!.rpc('track_orders', {
        p_orders: recent.map((o) => ({ id: o.id!, token: o.token! })),
      });
      if (!alive) return;
      if (!error && data) {
        const next: Record<string, Tracked> = {};
        for (const r of data) {
          next[r.code] = {
            id: r.id,
            code: r.code,
            status: r.status as OrderStatus,
            statusChangedAt: r.status_changed_at,
            total: r.total,
            deliveryFee: r.delivery_fee,
            customerSignal: r.customer_signal,
          };
        }
        setState(next);
        if (Object.values(next).every((t) => FINAL.includes(t.status))) return; // ya no cambia
      }
      timer = window.setTimeout(tick, 20_000);
    };
    const tick = () => {
      if (document.visibilityState === 'visible') void poll();
      else timer = window.setTimeout(tick, 20_000);
    };
    void poll();
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        window.clearTimeout(timer);
        void poll();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
