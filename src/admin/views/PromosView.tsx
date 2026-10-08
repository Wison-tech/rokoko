import { useMemo, useState } from 'react';
import { PARTY_LABELS } from '../../data/catalog';
import { supabase } from '../../lib/supabase';
import { move, useAdminData } from '../data';
import { cop, errText, toast } from '../ui';

const PARTIES = ['1', '2', '4', '6'];

export function PromosView() {
  const { data, loading, reload } = useAdminData();
  const [add, setAdd] = useState('');
  const [busy, setBusy] = useState(false);

  const featured = useMemo(
    () => [...(data?.products ?? [])].filter((p) => p.featured).sort((a, b) => a.featured_sort - b.featured_sort || a.id - b.id),
    [data],
  );

  if (loading) return <section className="a-view"><p className="a-muted">Cargando…</p></section>;
  if (!data) return null;

  const run = async (fn: () => PromiseLike<{ error: unknown }[] | { error: unknown }>) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    const err = (Array.isArray(res) ? res : [res]).find((r) => r.error)?.error;
    if (err) toast(errText(err as Error), 'error');
    void reload();
  };

  const saveFeatured = (ids: number[]) =>
    run(() => Promise.all(ids.map((id, i) => supabase!.from('products').update({ featured: true, featured_sort: i }).eq('id', id))));

  const nameOf = (id: number) => data.products.find((p) => p.id === id)?.name ?? '—';
  const variantsOf = (pid: number) => data.variants.filter((v) => v.product_id === pid).sort((a, b) => a.sort - b.sort);
  const sortedProducts = [...data.products].filter((p) => p.active).sort((a, b) => a.name.localeCompare(b.name, 'es'));

  return (
    <section className="a-view">
      <header className="a-view__head">
        <div>
          <h1>Destacados</h1>
          <p className="a-muted">Lo que se ve primero en la carta: “Los recomendados” y “¿Para cuántos es?”.</p>
        </div>
      </header>

      <section className="a-card a-pad">
        <h2 className="a-h2">Los recomendados</h2>
        <p className="a-muted a-small">Aparecen en tarjetas grandes al inicio. Recomendado: entre 4 y 6.</p>
        <ol className="a-chosen">
          {featured.map((p, i) => (
            <li key={p.id}>
              <span>
                <strong>{p.name}</strong> <small className="a-muted">{variantsOf(p.id).map((v) => cop(v.price))[0]}</small>
              </span>
              <button type="button" className="a-icon-btn" disabled={busy || i === 0} onClick={() => saveFeatured(move(featured, i, -1).map((x) => x.id))} aria-label="Subir">↑</button>
              <button type="button" className="a-icon-btn" disabled={busy || i === featured.length - 1} onClick={() => saveFeatured(move(featured, i, 1).map((x) => x.id))} aria-label="Bajar">↓</button>
              <button type="button" className="a-icon-btn" disabled={busy} onClick={() => run(() => supabase!.from('products').update({ featured: false }).eq('id', p.id))} aria-label={`Quitar ${p.name}`}>✕</button>
            </li>
          ))}
        </ol>
        <div className="a-row">
          <select className="a-input" value={add} onChange={(e) => setAdd(e.target.value)} aria-label="Plato para recomendar">
            <option value="">Elegir plato…</option>
            {sortedProducts.filter((p) => !p.featured).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="a-btn"
            disabled={!add || busy}
            onClick={() => {
              const id = Number(add);
              setAdd('');
              void run(() => supabase!.from('products').update({ featured: true, featured_sort: featured.length }).eq('id', id));
            }}
          >
            ＋ Agregar
          </button>
        </div>
      </section>

      <section className="a-card a-pad">
        <h2 className="a-h2">¿Para cuántos es?</h2>
        <p className="a-muted a-small">El cliente elige cuántas personas son y le sugerimos estos platos con el tamaño indicado.</p>
        <div className="a-party">
          {PARTIES.map((party) => (
            <PartyColumn
              key={party}
              party={party}
              picks={data.party.filter((p) => p.party === party).sort((a, b) => a.sort - b.sort)}
              products={sortedProducts}
              variantsOf={variantsOf}
              nameOf={nameOf}
              busy={busy}
              run={run}
            />
          ))}
        </div>
      </section>
    </section>
  );
}

function PartyColumn({
  party,
  picks,
  products,
  variantsOf,
  nameOf,
  busy,
  run,
}: {
  party: string;
  picks: { id: number; product_id: number; variant_id: number | null; sort: number }[];
  products: { id: number; name: string }[];
  variantsOf: (pid: number) => { id: number; label: string; price: number }[];
  nameOf: (id: number) => string;
  busy: boolean;
  run: (fn: () => PromiseLike<{ error: unknown }[] | { error: unknown }>) => Promise<void>;
}) {
  const [pid, setPid] = useState('');
  const reorder = (ids: number[]) => run(() => Promise.all(ids.map((id, i) => supabase!.from('party_picks').update({ sort: i }).eq('id', id))));
  return (
    <div className="a-party__col">
      <h3>{PARTY_LABELS[party]}</h3>
      <ul>
        {picks.map((pk, i) => {
          const vs = variantsOf(pk.product_id);
          return (
            <li key={pk.id}>
              <strong>{nameOf(pk.product_id)}</strong>
              {vs.length > 1 && (
                <select
                  className="a-input a-input--sm"
                  value={pk.variant_id ?? ''}
                  onChange={(e) => run(() => supabase!.from('party_picks').update({ variant_id: Number(e.target.value) }).eq('id', pk.id))}
                  aria-label="Tamaño sugerido"
                >
                  {vs.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label} · {cop(v.price)}
                    </option>
                  ))}
                </select>
              )}
              <span className="a-row">
                <button type="button" className="a-icon-btn" disabled={busy || i === 0} onClick={() => reorder(move(picks, i, -1).map((x) => x.id))} aria-label="Subir">↑</button>
                <button type="button" className="a-icon-btn" disabled={busy} onClick={() => run(() => supabase!.from('party_picks').delete().eq('id', pk.id))} aria-label="Quitar">✕</button>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="a-row">
        <select className="a-input a-input--sm" value={pid} onChange={(e) => setPid(e.target.value)} aria-label="Agregar plato">
          <option value="">＋ Plato…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="a-btn a-btn--sm"
          disabled={!pid || busy}
          onClick={() => {
            const id = Number(pid);
            setPid('');
            void run(() =>
              supabase!.from('party_picks').insert({ party, product_id: id, variant_id: variantsOf(id)[0]?.id ?? null, sort: picks.length }),
            );
          }}
        >
          Agregar
        </button>
      </div>
    </div>
  );
}
