import type { Item, OptionGroup } from '../data/menu';

/** Lo que el cliente eligió para un plato. Es lo que se guarda en el pedido. */
export type Selection = {
  /** slug del plato */
  id: string;
  /** Etiqueta del tamaño ('' si el plato no tiene tamaños). */
  label: string;
  /** groupId → ids de opciones elegidas. */
  opts: Record<string, string[]>;
  /** slugs de los adicionales agregados. */
  extras: string[];
  note: string;
};

type ById = Record<string, Item>;

const weightOf = (g: OptionGroup, ids: string[]) =>
  ids.reduce((n, id) => n + (g.choices.find((c) => c.id === id)?.weight ?? 1), 0);

/**
 * Marca/desmarca una opción. Si se pasa del máximo, suelta las elegidas
 * más antiguas (así "elige una" funciona como radio y "elige 2" rota).
 */
export function toggleChoice(g: OptionGroup, current: string[], choiceId: string): string[] {
  if (current.includes(choiceId)) {
    return g.min === 1 && g.max === 1 ? current : current.filter((id) => id !== choiceId);
  }
  const next = [...current, choiceId];
  while (weightOf(g, next) > g.max && next.length > 1) next.shift();
  return next;
}

/** Grupos que aún no cumplen el mínimo. */
export function missingGroups(item: Item, opts: Record<string, string[]>): OptionGroup[] {
  return item.options.filter((g) => weightOf(g, opts[g.id] ?? []) < g.min);
}

export function groupStatus(g: OptionGroup, ids: string[]) {
  const w = weightOf(g, ids);
  return { done: w >= g.min, used: w };
}

export function unitPrice(item: Item, sel: Pick<Selection, 'label' | 'opts' | 'extras'>, byId: ById): number {
  const base = item.variants.find((v) => v.label === sel.label)?.price ?? item.variants[0].price;
  const opts = item.options.reduce(
    (n, g) => n + (sel.opts[g.id] ?? []).reduce((m, id) => m + (g.choices.find((c) => c.id === id)?.price ?? 0), 0),
    0,
  );
  const extras = sel.extras.reduce((n, id) => n + (byId[id]?.variants[0].price ?? 0), 0);
  return base + opts + extras;
}

/** Detalle legible: "Estilo: Frito", "+ Papa criolla". */
export function describe(item: Item, sel: Selection, byId: ById): { options: string[]; extras: string[] } {
  const options = item.options
    .map((g) => {
      const labels = (sel.opts[g.id] ?? []).map((id) => g.choices.find((c) => c.id === id)?.label).filter(Boolean);
      return labels.length ? `${g.label}: ${labels.join(' + ')}` : '';
    })
    .filter(Boolean);
  const extras = sel.extras.map((id) => byId[id]?.name).filter(Boolean) as string[];
  return { options, extras };
}

/** Misma configuración = misma línea del pedido (se suman cantidades). */
export function selectionKey(sel: Selection): string {
  const opts = Object.keys(sel.opts)
    .sort()
    .map((k) => `${k}=${[...sel.opts[k]].sort().join(',')}`)
    .join(';');
  return [sel.id, sel.label, opts, [...sel.extras].sort().join(','), sel.note.trim().toLowerCase()].join('|');
}

/** Revisa una selección guardada contra la carta actual. Devuelve null si ya no es válida. */
export function validateSelection(raw: unknown, byId: ById, extraIds: string[]): Selection | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<Selection>;
  const item = typeof s.id === 'string' ? byId[s.id] : undefined;
  if (!item) return null;
  const label = typeof s.label === 'string' ? s.label : '';
  if (!item.variants.some((v) => v.label === label)) return null;
  const opts: Record<string, string[]> = {};
  for (const g of item.options) {
    const ids = Array.isArray(s.opts?.[g.id]) ? s.opts![g.id].filter((id) => g.choices.some((c) => c.id === id)) : [];
    if (weightOf(g, ids) < g.min || weightOf(g, ids) > g.max) return null;
    opts[g.id] = ids;
  }
  const extras = Array.isArray(s.extras) ? s.extras.filter((id) => item.extras && extraIds.includes(id)) : [];
  const note = typeof s.note === 'string' ? s.note.slice(0, 140) : '';
  return { id: item.id, label, opts, extras, note };
}

/** Lo que espera create_order() en Supabase para un plato. null si la carta no tiene ids de base de datos. */
export function toOrderItem(item: Item, sel: Selection, qty: number, byId: ById) {
  const variant = item.variants.find((v) => v.label === sel.label);
  const choices = item.options.flatMap((g) =>
    (sel.opts[g.id] ?? []).map((id) => g.choices.find((c) => c.id === id)?.dbId),
  );
  const extras = sel.extras.map((id) => byId[id]?.dbId);
  const isNum = (n: number | undefined): n is number => typeof n === 'number';
  if (!item.dbId || !variant?.dbId || !choices.every(isNum) || !extras.every(isNum)) return null;
  return { product_id: item.dbId, variant_id: variant.dbId, qty, choices, extras, note: sel.note.trim() };
}
