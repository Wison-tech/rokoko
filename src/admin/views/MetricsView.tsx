import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Bars, ChartCard, Columns, Stat, type Datum } from '../charts';
import { MODE_LABEL } from '../orderStatus';
import { cop, errText, toast } from '../ui';

type Metrics = {
  kpis: {
    orders: number;
    sold: number;
    pending: number;
    pending_stale: number;
    cancelled: number;
    customer_regret: number;
    customer_sent: number;
    revenue: number;
    avg_ticket: number;
    items_sold: number;
  };
  daily: { day: string; orders: number; sold: number; revenue: number }[];
  hours: { hour: number; orders: number }[];
  weekdays: { dow: number; orders: number }[];
  top: { key: string; name: string; category: string; qty: number; revenue: number }[];
  least: { id: number; name: string; category: string; qty: number }[];
  categories: { name: string; qty: number; revenue: number }[];
  options: { group: string; choice: string; qty: number }[];
  modes: { mode: string; orders: number; revenue: number }[];
  payments: { payment: string; orders: number }[];
};

type Preset = 'hoy' | 'ayer' | '7d' | '30d' | 'mes' | 'custom';
const PRESETS: { id: Preset; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'ayer', label: 'Ayer' },
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: 'mes', label: 'Este mes' },
  { id: 'custom', label: 'Fechas…' },
];

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function rangeFor(p: Preset, from: string, to: string): [Date, Date] {
  const today = dayStart(new Date());
  switch (p) {
    case 'hoy':
      return [today, addDays(today, 1)];
    case 'ayer':
      return [addDays(today, -1), today];
    case '7d':
      return [addDays(today, -6), addDays(today, 1)];
    case '30d':
      return [addDays(today, -29), addDays(today, 1)];
    case 'mes':
      return [new Date(today.getFullYear(), today.getMonth(), 1), addDays(today, 1)];
    case 'custom': {
      const a = from ? new Date(from + 'T00:00') : addDays(today, -6);
      const b = to ? addDays(new Date(to + 'T00:00'), 1) : addDays(today, 1);
      return a < b ? [a, b] : [b, a];
    }
  }
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');

export function MetricsView() {
  const [preset, setPreset] = useState<Preset>('7d');
  const [from, setFrom] = useState(ymd(addDays(new Date(), -6)));
  const [to, setTo] = useState(ymd(new Date()));
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  const [start, end] = useMemo(() => rangeFor(preset, from, to), [preset, from, to]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    supabase!
      .rpc('admin_metrics', { p_from: start.toISOString(), p_to: end.toISOString() })
      .then(({ data: d, error }) => {
        if (!alive) return;
        setLoading(false);
        if (error) return toast(errText(error), 'error');
        setData(d as unknown as Metrics);
      });
    return () => {
      alive = false;
    };
  }, [start, end]);

  const k = data?.kpis;
  const days = data?.daily ?? [];
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const dayLabel = (iso: string) => {
    const d = new Date(iso + 'T12:00');
    return `${d.getDate()} ${MES[d.getMonth()]}`;
  };
  const daily: Datum[] = days.map((d) => ({
    key: d.day,
    label: dayLabel(d.day),
    value: d.revenue,
    detail: `${d.sold} vendidos de ${d.orders} pedidos`,
  }));
  const hours: Datum[] = (data?.hours ?? []).map((h) => ({ key: String(h.hour), label: `${h.hour}h`, value: h.orders, detail: 'pedidos' }));
  const weekdays: Datum[] = [1, 2, 3, 4, 5, 6, 0].map((d) => ({
    key: String(d),
    label: DOW[d],
    value: data?.weekdays.find((w) => w.dow === d)?.orders ?? 0,
  }));
  const top: Datum[] = (data?.top ?? []).map((t) => ({ key: t.key, label: t.name, value: t.qty, detail: cop(t.revenue) }));
  const least: Datum[] = (data?.least ?? []).map((t) => ({ key: String(t.id), label: t.name, value: t.qty, detail: t.category }));
  const cats: Datum[] = (data?.categories ?? []).map((c) => ({ key: c.name, label: c.name, value: c.revenue, detail: `${c.qty} und.` }));
  const opts: Datum[] = (data?.options ?? []).map((o) => ({ key: o.group + o.choice, label: `${o.group}: ${o.choice}`, value: o.qty }));
  const modes: Datum[] = (data?.modes ?? []).map((m) => ({ key: m.mode, label: MODE_LABEL[m.mode] ?? m.mode, value: m.orders, detail: cop(m.revenue) }));
  const pays: Datum[] = (data?.payments ?? []).map((p) => ({ key: p.payment, label: p.payment, value: p.orders }));

  const abandoned = (k?.pending_stale ?? 0) + (k?.cancelled ?? 0);

  return (
    <section className="a-view">
      <header className="a-view__head">
        <div>
          <h1>Métricas</h1>
          <p className="a-muted">Ventas = pedidos confirmados, en preparación, en camino o entregados.</p>
        </div>
      </header>

      <div className="a-filters">
        <div className="a-seg" role="tablist" aria-label="Periodo">
          {PRESETS.map((p) => (
            <button key={p.id} role="tab" type="button" aria-selected={preset === p.id} onClick={() => setPreset(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="a-row">
            <input className="a-input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} aria-label="Desde" />
            <span className="a-muted">a</span>
            <input className="a-input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-label="Hasta" />
          </div>
        )}
      </div>

      <div className={`a-metrics ${loading ? 'is-loading' : ''}`}>
        <div className="a-stats">
          <Stat label="Ventas" value={cop(k?.revenue)} hint={`${k?.sold ?? 0} pedidos vendidos`} />
          <Stat label="Ticket promedio" value={cop(k?.avg_ticket)} hint={`${k?.items_sold ?? 0} productos vendidos`} />
          <Stat
            label="Pedidos recibidos"
            value={(k?.orders ?? 0).toLocaleString('es-CO')}
            hint={`${k?.pending ?? 0} por confirmar · ${k?.cancelled ?? 0} cancelados`}
          />
          <Stat
            label="Se concretan"
            value={pct(k?.sold ?? 0, k?.orders ?? 0)}
            hint="de los pedidos llegan a venta"
            tone={k && k.orders > 0 && k.sold / k.orders < 0.6 ? 'warn' : undefined}
          />
          <Stat
            label="Abandonados"
            value={abandoned.toLocaleString('es-CO')}
            hint={`${k?.customer_regret ?? 0} se arrepintieron · ${k?.pending_stale ?? 0} nunca confirmados`}
            tone={abandoned > 0 ? 'bad' : undefined}
          />
        </div>

        {k && k.orders === 0 ? (
          <div className="a-card a-empty-metrics">
            <p>
              <strong>Aún no hay pedidos en este periodo.</strong> Cuando los clientes empiecen a pedir desde la carta, aquí verás qué se
              vende más, a qué horas y cuánto entra.
            </p>
          </div>
        ) : (
          <div className="a-grid">
            <ChartCard title="Ventas por día" data={daily} money subtitle="Solo pedidos vendidos">
              <Columns data={daily} money labelEvery={daily.length > 14 ? Math.ceil(daily.length / 10) : 1} />
            </ChartCard>
            <ChartCard title="Pedidos por hora" data={hours} unit="Pedidos" subtitle="Sin contar cancelados · hora de Colombia">
              <Columns data={hours} labelEvery={3} />
            </ChartCard>
            <ChartCard title="Lo más pedido" data={top} unit="Unidades" subtitle="Unidades vendidas · valor vendido">
              <Bars data={top} />
            </ChartCard>
            <ChartCard title="Lo menos pedido" data={least} unit="Unidades" subtitle="Platos activos con menos ventas (incluye los que no se vendieron)">
              {/* Misma escala que "Lo más pedido" para no exagerar 2 unidades como barra llena. */}
              <Bars data={least} max={top[0]?.value} />
            </ChartCard>
            <ChartCard title="Ventas por categoría" data={cats} money>
              <Bars data={cats} money />
            </ChartCard>
            <ChartCard title="Opciones más elegidas" data={opts} unit="Veces" subtitle="Papa, tipo de arroz, proteínas…">
              <Bars data={opts} />
            </ChartCard>
            <ChartCard title="Días de la semana" data={weekdays} unit="Pedidos">
              <Columns data={weekdays} height={140} />
            </ChartCard>
            <div className="a-stack">
              <ChartCard title="Tipo de entrega" data={modes} unit="Pedidos">
                <Bars data={modes} />
              </ChartCard>
              <ChartCard title="Forma de pago" data={pays} unit="Pedidos">
                <Bars data={pays} />
              </ChartCard>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
