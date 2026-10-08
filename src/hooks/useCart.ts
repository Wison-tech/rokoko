import { useCallback, useMemo } from 'react';
import type { Catalog } from '../data/catalog';
import type { Item } from '../data/menu';
import { selectionKey, unitPrice, validateSelection, type Selection } from '../lib/order';
import { useStored } from './useStored';

type StoredLine = { sel: Selection; qty: number };
export type CartLine = StoredLine & { key: string; item: Item; unit: number };

export type PastOrder = {
  code: string;
  date: number;
  total: number;
  lines: StoredLine[];
  /** Solo si quedó registrado en Supabase: permiten ver su estado. */
  id?: string;
  token?: string;
};

const MAX_QTY = 99;

/** Solo revisa la forma; la validez contra la carta se resuelve al mostrar (la carta puede llegar después). */
function parseShape(raw: unknown): StoredLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((l) =>
    l && typeof l === 'object' && l.sel && typeof l.sel === 'object' && Number(l.qty) > 0
      ? [{ sel: l.sel as Selection, qty: Math.min(MAX_QTY, Math.floor(Number(l.qty))) }]
      : [],
  );
}

function parseHistory(raw: unknown): PastOrder[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((o) =>
    o && typeof o.code === 'string' && typeof o.date === 'number'
      ? [{
          code: o.code,
          date: o.date,
          total: Number(o.total) || 0,
          lines: parseShape(o.lines),
          id: typeof o.id === 'string' ? o.id : undefined,
          token: typeof o.token === 'string' ? o.token : undefined,
        }]
      : [],
  );
}

function resolve(lines: StoredLine[], catalog: Catalog): StoredLine[] {
  const extraIds = catalog.extras.map((x) => x.id);
  return lines.flatMap((l) => {
    const sel = validateSelection(l.sel, catalog.byId, extraIds);
    return sel ? [{ sel, qty: l.qty }] : [];
  });
}

/** Suma líneas iguales (misma configuración) y respeta el máximo por línea. */
function merge(base: StoredLine[], add: StoredLine[]): StoredLine[] {
  const out = base.map((l) => ({ ...l }));
  for (const a of add) {
    const k = selectionKey(a.sel);
    const found = out.find((l) => selectionKey(l.sel) === k);
    if (found) found.qty = Math.min(MAX_QTY, found.qty + a.qty);
    else out.push({ sel: a.sel, qty: Math.min(MAX_QTY, a.qty) });
  }
  return out;
}

export function useCart(catalog: Catalog) {
  const [stored, setStored] = useStored<StoredLine[]>('rokoko-pedido-v4', [], parseShape);
  const [history, setHistory] = useStored<PastOrder[]>('rokoko-historial-v2', [], parseHistory);

  const valid = useMemo(() => resolve(stored, catalog), [stored, catalog]);
  const lines: CartLine[] = useMemo(
    () =>
      valid.map((l) => {
        const item = catalog.byId[l.sel.id];
        return { ...l, key: selectionKey(l.sel), item, unit: unitPrice(item, l.sel, catalog.byId) };
      }),
    [valid, catalog],
  );

  const add = useCallback(
    (sel: Selection, qty: number) => setStored((prev) => merge(resolve(prev, catalog), [{ sel, qty }])),
    [setStored, catalog],
  );

  const change = useCallback(
    (key: string, delta: number) =>
      setStored((prev) =>
        resolve(prev, catalog)
          .map((l) => (selectionKey(l.sel) === key ? { ...l, qty: Math.min(MAX_QTY, l.qty + delta) } : l))
          .filter((l) => l.qty > 0),
      ),
    [setStored, catalog],
  );

  const clear = useCallback(() => setStored([]), [setStored]);

  const count = lines.reduce((n, l) => n + l.qty, 0);
  const total = lines.reduce((n, l) => n + l.unit * l.qty, 0);

  /** Guarda el pedido enviado en el historial (máx. 5) y vacía el carrito. */
  const archive = useCallback(
    (order: { code: string; total: number; id?: string; token?: string }) => {
      setHistory((prev) => [{ ...order, date: Date.now(), lines: valid }, ...prev].slice(0, 5));
      setStored([]);
    },
    [setHistory, setStored, valid],
  );

  /** Vuelve a cargar un pedido anterior (con precios de hoy). Devuelve cuántos productos se agregaron. */
  const reorder = useCallback(
    (order: PastOrder) => {
      const ok = resolve(order.lines, catalog);
      setStored((prev) => merge(resolve(prev, catalog), ok));
      return ok.reduce((n, l) => n + l.qty, 0);
    },
    [setStored, catalog],
  );

  /** El cliente canceló un pedido ya archivado: se quita el seguimiento. */
  const forget = useCallback(
    (code: string) => setHistory((prev) => prev.map((o) => (o.code === code ? { ...o, id: undefined, token: undefined } : o))),
    [setHistory],
  );

  return { lines, count, total, add, change, clear, history, archive, reorder, forget };
}

export function useFavorites(catalog: Catalog) {
  const [favs, setFavs] = useStored<string[]>('rokoko-favoritos', [], (raw) =>
    Array.isArray(raw) ? raw.filter((id) => typeof id === 'string') : [],
  );
  const visible = useMemo(() => favs.filter((id) => catalog.byId[id]), [favs, catalog]);
  const toggle = useCallback(
    (id: string) => setFavs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    [setFavs],
  );
  return { favs: visible, toggle, isFav: (id: string) => favs.includes(id) };
}
