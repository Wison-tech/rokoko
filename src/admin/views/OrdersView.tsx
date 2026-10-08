import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OrderItemRow, OrderRow } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';
import { MODE_ICON, MODE_LABEL, NEXT, STALE_MIN, STATUS, type Status } from '../orderStatus';
import { ConfirmButton, Drawer, Empty, Field, cop, errText, toast } from '../ui';

type Order = OrderRow & { order_items: OrderItemRow[] };
type Filter = 'activos' | 'pendiente' | 'entregado' | 'cancelado' | 'todos';
type Range = 'hoy' | '7d' | '30d';

const FILTERS: { id: Filter; label: string; match: (s: Status) => boolean }[] = [
  { id: 'activos', label: 'En curso', match: (s) => ['pendiente', 'confirmado', 'preparando', 'en_camino'].includes(s) },
  { id: 'pendiente', label: 'Por confirmar', match: (s) => s === 'pendiente' },
  { id: 'entregado', label: 'Entregados', match: (s) => s === 'entregado' },
  { id: 'cancelado', label: 'Cancelados', match: (s) => s === 'cancelado' },
  { id: 'todos', label: 'Todos', match: () => true },
];

const since = (r: Range) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (r === '7d') d.setDate(d.getDate() - 6);
  if (r === '30d') d.setDate(d.getDate() - 29);
  return d.toISOString();
};

const minutesAgo = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
const ago = (iso: string) => {
  const m = minutesAgo(iso);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  if (m < 24 * 60) return `hace ${Math.floor(m / 60)} h`;
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
};
const clock = (iso: string) => new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

// ---------- Alerta de pedido nuevo ----------
let audio: AudioContext | null = null;
function ding() {
  try {
    audio ??= new AudioContext();
    const now = audio.currentTime;
    [880, 1320, 1760].forEach((f, i) => {
      const o = audio!.createOscillator();
      const g = audio!.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + i * 0.16);
      g.gain.exponentialRampToValueAtTime(0.35, now + i * 0.16 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.32);
      o.connect(g).connect(audio!.destination);
      o.start(now + i * 0.16);
      o.stop(now + i * 0.16 + 0.35);
    });
  } catch {
    /* sin audio */
  }
}

const ALERTS_KEY = 'rokoko-admin-alertas';
const alertsOn = () => {
  try {
    return localStorage.getItem(ALERTS_KEY) === '1';
  } catch {
    return false;
  }
};

export function OrdersView({ onPendingChange, background }: { onPendingChange: (n: number) => void; background?: boolean }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('activos');
  const [range, setRange] = useState<Range>('hoy');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState(alertsOn);
  const [, setNow] = useState(0);
  const known = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase!
      .from('orders')
      .select('*, order_items(*)')
      .gte('created_at', since(background ? 'hoy' : range))
      .order('created_at', { ascending: false })
      .limit(300);
    setLoading(false);
    if (error) return toast(errText(error), 'error');
    const list = (data ?? []) as unknown as Order[];
    // Alerta solo para pedidos que no conocíamos (no al cargar la primera vez).
    if (known.current) {
      const fresh = list.filter((o) => !known.current!.has(o.id) && o.status === 'pendiente');
      if (fresh.length && alertsOn()) {
        ding();
        if ('Notification' in window && Notification.permission === 'granted') {
          const o = fresh[0];
          new Notification(`Nuevo pedido ${o.code}`, { body: `${o.customer_name} · ${cop(o.total)} · ${MODE_LABEL[o.mode]}`, icon: '/img/icon-192.png' });
        }
      }
    }
    known.current = new Set(list.map((o) => o.id));
    setOrders(list);
  }, [range, background]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // En vivo: cualquier cambio en pedidos recarga la lista.
  useEffect(() => {
    const ch = supabase!
      .channel(`orders-${background ? 'bg' : 'fg'}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => void load())
      .subscribe();
    // Respaldo por si la conexión en vivo se cae: refresco cada 60 s y reloj de "hace X min".
    const t = window.setInterval(() => {
      setNow(Date.now());
      void load();
    }, 60_000);
    return () => {
      void supabase!.removeChannel(ch);
      window.clearInterval(t);
    };
  }, [load, background]);

  const pending = orders.filter((o) => o.status === 'pendiente').length;
  useEffect(() => onPendingChange(pending), [pending, onPendingChange]);

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter)!;
    const term = q.trim().toLowerCase();
    return orders.filter(
      (o) =>
        f.match(o.status as Status) &&
        (!term || o.code.toLowerCase().includes(term) || o.customer_name.toLowerCase().includes(term) || (o.customer_phone ?? '').includes(term)),
    );
  }, [orders, filter, q]);

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, orders.filter((o) => f.match(o.status as Status)).length])),
    [orders],
  );

  if (background) return null;

  const enableAlerts = async () => {
    const next = !alerts;
    setAlerts(next);
    try {
      localStorage.setItem(ALERTS_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (next) {
      ding(); // desbloquea el audio con el clic
      if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
      toast('Alertas activadas: sonará con cada pedido nuevo mientras el panel esté abierto.');
    }
  };

  const open = orders.find((o) => o.id === openId) ?? null;

  return (
    <section className="a-view">
      <header className="a-view__head">
        <div>
          <h1>Pedidos</h1>
          <p className="a-muted">
            {pending > 0 ? `${pending} por confirmar` : 'Todo al día'} · se actualiza en vivo
          </p>
        </div>
        <button type="button" className={`a-btn ${alerts ? 'a-btn--on' : ''}`} onClick={enableAlerts} aria-pressed={alerts}>
          {alerts ? '🔔 Alertas activas' : '🔕 Activar alertas'}
        </button>
      </header>

      <div className="a-filters">
        <div className="a-seg" role="tablist" aria-label="Periodo">
          {(['hoy', '7d', '30d'] as Range[]).map((r) => (
            <button key={r} role="tab" type="button" aria-selected={range === r} onClick={() => setRange(r)}>
              {r === 'hoy' ? 'Hoy' : r === '7d' ? '7 días' : '30 días'}
            </button>
          ))}
        </div>
        <input className="a-input a-search" type="search" placeholder="Buscar código, nombre o celular" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar pedido" />
      </div>
      <div className="a-chips" role="tablist" aria-label="Estado">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label} <span>{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="a-muted">Cargando pedidos…</p>
      ) : visible.length === 0 ? (
        <Empty icon="🧾" title={filter === 'activos' ? 'No hay pedidos en curso' : 'No hay pedidos aquí'}>
          Los pedidos que los clientes envíen desde la carta aparecen aquí al instante.
        </Empty>
      ) : (
        <ul className="a-orders">
          {visible.map((o) => {
            const st = o.status as Status;
            const stale = st === 'pendiente' && minutesAgo(o.created_at) >= STALE_MIN;
            return (
              <li key={o.id}>
                <button type="button" className={`a-order ${st === 'pendiente' ? 'is-pending' : ''}`} onClick={() => setOpenId(o.id)}>
                  <span className="a-order__top">
                    <strong className="a-order__code">{o.code}</strong>
                    <span className={`a-pill a-pill--${STATUS[st].tone}`}>{STATUS[st].label}</span>
                    <span className="a-order__time">{ago(o.created_at)}</span>
                  </span>
                  <span className="a-order__mid">
                    <span>
                      {MODE_ICON[o.mode]} {o.customer_name}
                      {o.mode === 'domicilio' && o.barrio ? ` · ${o.barrio}` : ''}
                    </span>
                    <strong>{cop(o.total)}</strong>
                  </span>
                  <span className="a-order__items">
                    {o.order_items.map((i) => `${i.qty}× ${i.product_name}${i.variant_label ? ` (${i.variant_label})` : ''}`).join(' · ')}
                  </span>
                  {(o.customer_signal || stale || o.scheduled_time) && (
                    <span className="a-order__flags">
                      {o.scheduled_time && <span className="a-flag">⏰ Para las {o.scheduled_time}</span>}
                      {o.customer_signal === 'enviado' && <span className="a-flag a-flag--good">✓ Cliente dice que lo envió</span>}
                      {o.customer_signal === 'arrepentido' && <span className="a-flag a-flag--bad">Cliente se arrepintió</span>}
                      {stale && !o.customer_signal && <span className="a-flag a-flag--warn">Sin confirmar hace +{STALE_MIN} min: quizá no lo envió</span>}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <OrderDrawer order={open} onClose={() => setOpenId(null)} onChanged={load} />
    </section>
  );
}

// ---------------------------------------------------------------------
function OrderDrawer({ order, onClose, onChanged }: { order: Order | null; onClose: () => void; onChanged: () => void }) {
  const [fee, setFee] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFee(order?.delivery_fee != null ? String(order.delivery_fee) : '');
    setNote(order?.admin_note ?? '');
    setReason('');
  }, [order?.id, order?.delivery_fee, order?.admin_note]);

  if (!order) return null;
  const st = order.status as Status;
  const next = NEXT[st];

  const update = async (patch: Partial<OrderRow>, ok: string) => {
    setBusy(true);
    const { error } = await supabase!.from('orders').update(patch).eq('id', order.id);
    setBusy(false);
    if (error) return toast(errText(error), 'error');
    toast(ok);
    onChanged();
  };

  const saveFee = () => {
    const n = fee.trim() === '' ? null : Math.max(0, Number(fee.replace(/\D/g, '')) || 0);
    void update({ delivery_fee: n, total: order.subtotal + (n ?? 0) }, 'Domicilio actualizado');
  };

  const phoneDigits = (order.customer_phone ?? '').replace(/\D/g, '');
  const waCustomer = phoneDigits ? `https://wa.me/${phoneDigits.length === 10 ? '57' + phoneDigits : phoneDigits}` : null;
  const mapUrl =
    order.mode === 'domicilio' && order.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${order.address}, ${order.barrio ?? ''}`)}`
      : null;
  const change = order.payment === 'Efectivo' && order.cash_with ? order.cash_with - order.total : null;

  return (
    <Drawer
      open
      onClose={onClose}
      title={
        <>
          {order.code} <span className={`a-pill a-pill--${STATUS[st].tone}`}>{STATUS[st].label}</span>
        </>
      }
      footer={
        st !== 'entregado' && st !== 'cancelado' ? (
          <div className="a-row a-row--end">
            <ConfirmButton confirmLabel="¿Cancelar pedido?" onConfirm={() => update({ status: 'cancelado', cancel_reason: reason.trim() || 'Cancelado por el restaurante' }, 'Pedido cancelado')}>
              Cancelar pedido
            </ConfirmButton>
            {next && (
              <button type="button" className="a-btn a-btn--primary" disabled={busy} onClick={() => update({ status: next.to }, `Pedido: ${STATUS[next.to].label}`)}>
                {next.label} →
              </button>
            )}
          </div>
        ) : (
          <div className="a-row a-row--end">
            <button type="button" className="a-btn" disabled={busy} onClick={() => update({ status: 'pendiente', cancel_reason: null }, 'Pedido reabierto')}>
              Reabrir pedido
            </button>
          </div>
        )
      }
    >
      <p className="a-muted">
        Recibido {clock(order.created_at)} ({ago(order.created_at)}) · último cambio {ago(order.status_changed_at)}
      </p>
      {order.customer_signal === 'enviado' && <p className="a-success">El cliente marcó que ya envió el mensaje por WhatsApp.</p>}
      {order.customer_signal === 'arrepentido' && <p className="a-alert">El cliente canceló el pedido desde la página.</p>}
      {st === 'cancelado' && order.cancel_reason && <p className="a-alert">Motivo: {order.cancel_reason}</p>}

      <h3 className="a-h3">Productos</h3>
      <ul className="a-items">
        {order.order_items.map((i) => {
          const opts = Array.isArray(i.options) ? (i.options as { group: string; choice: string }[]) : [];
          const extras = Array.isArray(i.extras) ? (i.extras as { name: string }[]) : [];
          return (
            <li key={i.id}>
              <span className="a-items__qty">{i.qty}×</span>
              <span className="a-items__body">
                <strong>
                  {i.product_name}
                  {i.variant_label && <span className="a-muted"> · {i.variant_label}</span>}
                </strong>
                {opts.length > 0 && <span>{opts.map((o) => `${o.group}: ${o.choice}`).join(' · ')}</span>}
                {extras.length > 0 && <span>+ {extras.map((x) => x.name).join(', ')}</span>}
                {i.note && <em>“{i.note}”</em>}
              </span>
              <span className="a-items__price">{cop(i.line_total)}</span>
            </li>
          );
        })}
      </ul>
      <dl className="a-totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{cop(order.subtotal)}</dd>
        </div>
        {order.mode === 'domicilio' && (
          <div>
            <dt>Domicilio</dt>
            <dd>{order.delivery_fee != null ? cop(order.delivery_fee) : 'por definir'}</dd>
          </div>
        )}
        <div className="is-total">
          <dt>Total</dt>
          <dd>{cop(order.total)}</dd>
        </div>
      </dl>

      <h3 className="a-h3">Cliente</h3>
      <ul className="a-facts">
        <li>
          <span>Nombre</span>
          <strong>{order.customer_name}</strong>
        </li>
        {order.customer_phone && (
          <li>
            <span>Celular</span>
            <strong>
              {order.customer_phone}{' '}
              {waCustomer && (
                <a href={waCustomer} target="_blank" rel="noopener noreferrer" className="a-link">
                  Escribirle
                </a>
              )}
            </strong>
          </li>
        )}
        <li>
          <span>Entrega</span>
          <strong>
            {MODE_ICON[order.mode]} {MODE_LABEL[order.mode]}
            {order.table_number ? ` · Mesa ${order.table_number}` : ''}
          </strong>
        </li>
        {order.mode === 'domicilio' && (
          <li>
            <span>Dirección</span>
            <strong>
              {order.address}, {order.barrio}
              {order.reference && <small className="a-muted"> · {order.reference}</small>}{' '}
              {mapUrl && (
                <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="a-link">
                  Ver mapa
                </a>
              )}
            </strong>
          </li>
        )}
        <li>
          <span>Pago</span>
          <strong>
            {order.payment}
            {order.cash_with ? ` · paga con ${cop(order.cash_with)}` : ''}
            {change != null && change >= 0 ? ` · cambio ${cop(change)}` : ''}
          </strong>
        </li>
        <li>
          <span>Hora</span>
          <strong>{order.scheduled_time ? `Para las ${order.scheduled_time}` : 'Lo antes posible'}</strong>
        </li>
        {order.note && (
          <li>
            <span>Nota</span>
            <strong>{order.note}</strong>
          </li>
        )}
      </ul>

      {order.mode === 'domicilio' && st !== 'cancelado' && (
        <InlineField id="o-fee" label="Valor del domicilio" hint="Se suma al total; el cliente lo ve en su seguimiento." onSave={saveFee} busy={busy}>
          <input id="o-fee" className="a-input" inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value.replace(/\D/g, ''))} placeholder="Ej: 4000" />
        </InlineField>
      )}
      {st !== 'entregado' && st !== 'cancelado' && (
        <Field label="Motivo si lo cancelas (opcional)">
          <input className="a-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: el cliente no respondió" />
        </Field>
      )}
      <InlineField id="o-note" label="Nota interna" onSave={() => update({ admin_note: note.trim() || null }, 'Nota guardada')} busy={busy}>
        <input id="o-note" className="a-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Solo la ve el equipo" />
      </InlineField>
    </Drawer>
  );
}

/** Campo con botón "Guardar" al lado: el botón queda alineado con el campo, no con la nota de ayuda. */
function InlineField({ id, label, hint, onSave, busy, children }: { id: string; label: string; hint?: string; onSave: () => void; busy: boolean; children: React.ReactNode }) {
  return (
    <div className="a-field">
      <label className="a-field__label" htmlFor={id}>
        {label}
      </label>
      <div className="a-inline">
        {children}
        <button type="button" className="a-btn" onClick={onSave} disabled={busy}>
          Guardar
        </button>
      </div>
      {hint && <span className="a-field__hint">{hint}</span>}
    </div>
  );
}
