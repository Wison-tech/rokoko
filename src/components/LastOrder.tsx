import type { Item } from '../data/menu';
import { useCatalog } from '../data/catalog';
import type { PastOrder } from '../hooks/useCart';
import type { OrderStatus, Tracked } from '../hooks/useOrderTracking';
import { money } from '../lib/format';
import { RepeatIcon } from './Icons';

const when = (ts: number) =>
  new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(ts);

export function summary(order: PastOrder, byId: Record<string, Item>, max = 2) {
  const names = order.lines.map((l) => `${l.qty}× ${byId[l.sel.id]?.name ?? 'Producto'}`);
  return names.slice(0, max).join(', ') + (names.length > max ? ` y ${names.length - max} más` : '');
}

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'pendiente', label: 'Recibido' },
  { status: 'confirmado', label: 'Confirmado' },
  { status: 'preparando', label: 'Preparando' },
  { status: 'en_camino', label: 'En camino' },
  { status: 'entregado', label: 'Entregado' },
];

const STATUS_TEXT: Record<OrderStatus, string> = {
  pendiente: 'Esperando que el restaurante lo confirme por WhatsApp',
  confirmado: '¡Confirmado! Ya lo tienen en cuenta',
  preparando: 'Lo están preparando',
  en_camino: 'Va en camino o está listo para recoger',
  entregado: 'Entregado. ¡Buen provecho!',
  cancelado: 'Este pedido fue cancelado',
};

/** Seguimiento del último pedido, o "Pide lo de siempre" si ya terminó. */
export function LastOrder({
  order,
  tracked,
  onRepeat,
}: {
  order: PastOrder;
  tracked?: Tracked;
  onRepeat: (o: PastOrder) => void;
}) {
  const { byId } = useCatalog();
  const live = tracked && tracked.status !== 'entregado' && tracked.status !== 'cancelado';

  if (live) {
    const step = STEPS.findIndex((s) => s.status === tracked.status);
    return (
      <section className="wrap" aria-label="Estado de tu pedido">
        <div className="track" role="status" aria-live="polite">
          <div className="track__head">
            <span className="track__pulse" aria-hidden="true" />
            <div>
              <p className="again__kicker">Tu pedido {order.code}</p>
              <p className="track__text">{STATUS_TEXT[tracked.status]}</p>
            </div>
            <strong className="track__total">
              {money(tracked.total)}
              {tracked.deliveryFee ? <small> con domicilio</small> : null}
            </strong>
          </div>
          <ol className="track__steps">
            {STEPS.map((s, i) => (
              <li key={s.status} className={i <= step ? 'is-done' : ''} aria-current={i === step ? 'step' : undefined}>
                {s.label}
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  return (
    <section className="wrap" aria-label="Tu último pedido">
      <div className="again">
        <span className="again__icon" aria-hidden="true">
          <RepeatIcon />
        </span>
        <div className="again__body">
          <p className="again__kicker">
            {tracked?.status === 'cancelado' ? `Pedido ${order.code} cancelado` : `Pide lo de siempre · ${when(order.date)}`}
          </p>
          <p className="again__text">{summary(order, byId)}</p>
        </div>
        <button className="btn btn--white btn--sm" type="button" onClick={() => onRepeat(order)}>
          Repetir <span className="again__total">{money(order.total)}</span>
        </button>
      </div>
    </section>
  );
}
