// Gráficas del panel: una sola serie, color de marca, barras delgadas con punta
// redondeada, cuadrícula fina, valor al pasar el mouse o con el teclado, y una
// tabla alternativa para cada gráfica (el valor nunca depende solo del color).
import { useId, useState, type ReactNode } from 'react';

export type Datum = { key: string; label: string; value: number; detail?: string };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

const compact = (v: number, money?: boolean) => {
  const pre = money ? '$' : '';
  if (v >= 1_000_000) return `${pre}${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1).replace('.', ',')} M`;
  if (v >= 1_000) return `${pre}${Math.round(v / 1_000)} mil`;
  return `${pre}${Math.round(v).toLocaleString('es-CO')}`;
};

/** Tarjeta de cifra. */
export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className={`a-stat ${tone ? `a-stat--${tone}` : ''}`}>
      <span className="a-stat__label">{label}</span>
      <span className="a-stat__value">{value}</span>
      {hint && <span className="a-stat__hint">{hint}</span>}
    </div>
  );
}

/** Tarjeta de gráfica con alternancia "Ver tabla". */
export function ChartCard({ title, subtitle, data, children, money, unit }: { title: string; subtitle?: string; data: Datum[]; children: ReactNode; money?: boolean; unit?: string }) {
  const [table, setTable] = useState(false);
  return (
    <section className="a-card a-chart">
      <header className="a-chart__head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p className="a-muted a-small">{subtitle}</p>}
        </div>
        <button type="button" className="a-link a-small" onClick={() => setTable((t) => !t)} aria-pressed={table}>
          {table ? 'Ver gráfica' : 'Ver tabla'}
        </button>
      </header>
      {table ? (
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th scope="col">{title}</th>
                <th scope="col" className="is-num">
                  {money ? 'Valor' : unit ?? 'Cantidad'}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.key}>
                  <td>
                    {d.label}
                    {d.detail && <small className="a-muted"> · {d.detail}</small>}
                  </td>
                  <td className="is-num">{money ? '$' + d.value.toLocaleString('es-CO') : d.value.toLocaleString('es-CO')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

/** Columnas verticales (series en el tiempo: días, horas). */
export function Columns({ data, money, labelEvery = 1, height = 180 }: { data: Datum[]; money?: boolean; labelEvery?: number; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  // Marca intermedia solo si cae en un número redondo (nada de "12,5 pedidos").
  const ticks = Number.isInteger(max / 2) ? [0, max / 2, max] : [0, max];
  const fmt = (v: number) => (money ? '$' + v.toLocaleString('es-CO') : v.toLocaleString('es-CO'));
  const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0);

  return (
    <div className="a-cols" style={{ ['--h' as string]: `${height}px` }}>
      <div className="a-cols__axis" aria-hidden="true">
        {[...ticks].reverse().map((t) => (
          <span key={t}>{compact(t, money)}</span>
        ))}
      </div>
      <div className="a-cols__plot">
        <div className="a-cols__grid" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} style={{ bottom: `${(t / max) * 100}%` }} />
          ))}
        </div>
        <div className="a-cols__bars" role="list" aria-describedby={id}>
          {data.map((d, i) => (
            <div
              key={d.key}
              className={`a-cols__slot ${hover === i ? 'is-hover' : ''}`}
              role="listitem"
              tabIndex={0}
              aria-label={`${d.label}: ${fmt(d.value)}${d.detail ? `, ${d.detail}` : ''}`}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            >
              <span className="a-cols__bar" style={{ height: `${(d.value / max) * 100}%` }} />
              {i === peak && d.value > 0 && hover === null && <span className="a-cols__peak">{compact(d.value, money)}</span>}
              {hover === i && (
                <span className="a-tip" role="tooltip">
                  <strong>{fmt(d.value)}</strong>
                  <span>{d.label}</span>
                  {d.detail && <span>{d.detail}</span>}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="a-cols__labels" aria-hidden="true">
          {data.map((d, i) => (
            <span key={d.key}>{i % labelEvery === 0 ? d.label : ''}</span>
          ))}
        </div>
      </div>
      <span id={id} className="sr-only">
        Pasa el cursor o usa Tab sobre cada barra para ver su valor.
      </span>
    </div>
  );
}

/** Barras horizontales con el nombre arriba y el valor al final (rankings). */
export function Bars({ data, money, max: scaleMax }: { data: Datum[]; money?: boolean; /** Escala común (p. ej. el más vendido) */ max?: number }) {
  const max = Math.max(scaleMax ?? 0, ...data.map((d) => d.value), 1);
  const fmt = (v: number) => (money ? '$' + v.toLocaleString('es-CO') : v.toLocaleString('es-CO'));
  if (!data.length) return <p className="a-muted a-small">Sin datos en este periodo.</p>;
  return (
    <ul className="a-bars">
      {data.map((d) => (
        <li key={d.key} tabIndex={0} aria-label={`${d.label}: ${fmt(d.value)}${d.detail ? `, ${d.detail}` : ''}`} title={d.detail}>
          <span className="a-bars__text">
            <span className="a-bars__label">{d.label}</span>
            <span className="a-bars__value">
              {fmt(d.value)}
              {d.detail && <small> · {d.detail}</small>}
            </span>
          </span>
          <span className="a-bars__track" aria-hidden="true">
            <span className="a-bars__fill" style={{ width: `${Math.max((d.value / max) * 100, d.value > 0 ? 1.5 : 0)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}
