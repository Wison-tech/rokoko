import { createContext, useContext, useEffect, useState } from 'react';
import * as config from '../config';
import type {
  CategoryRow,
  OptionChoiceRow,
  OptionGroupRow,
  PartyPickRow,
  ProductOptionGroupRow,
  ProductRow,
  SettingsRow,
  VariantRow,
} from '../lib/database.types';
import { supabase } from '../lib/supabase';
import { EXTRA_IDS, FEATURED_IDS, MENU, PARTY, UPSELL_IDS, type Category, type Item, type OptionGroup } from './menu';

export type Hours = Partial<Record<number, [string, string]>>;

export type Settings = {
  name: string;
  claim: string;
  whatsapp: string;
  address: string;
  phone: string;
  hours: Hours | null;
  paymentMethods: string[];
  deliveryNote: string;
  orderingEnabled: boolean;
};

export type PartyGroup = { id: string; label: string; picks: { item: Item; variantIndex: number }[] };

export type Catalog = {
  /** db = recién traída de Supabase · cache = última copia guardada · bundled = carta empaquetada */
  source: 'db' | 'cache' | 'bundled';
  categories: Category[];
  items: Item[];
  byId: Record<string, Item>;
  featured: Item[];
  extras: Item[];
  upsell: Item[];
  party: PartyGroup[];
  settings: Settings;
};

export const PARTY_LABELS: Record<string, string> = { '1': 'Solo yo', '2': 'Pa’2', '4': '3 a 4', '6': '5 o más' };
const PARTY_ORDER = ['1', '2', '4', '6'];

function finish(source: Catalog['source'], categories: Category[], settings: Settings, ids: {
  featured: string[];
  extras: string[];
  upsell: string[];
  party: { party: string; slug: string; variantIndex: number }[];
}): Catalog {
  const items = categories.flatMap((c) => c.items);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const pick = (list: string[]) => list.map((id) => byId[id]).filter(Boolean);
  const party = PARTY_ORDER.map((p) => ({
    id: p,
    label: PARTY_LABELS[p],
    picks: ids.party
      .filter((x) => x.party === p && byId[x.slug])
      .map((x) => ({ item: byId[x.slug], variantIndex: Math.max(0, x.variantIndex) })),
  })).filter((g) => g.picks.length > 0);
  return { source, categories, items, byId, featured: pick(ids.featured), extras: pick(ids.extras), upsell: pick(ids.upsell), party, settings };
}

// ---------------------------------------------------------------------
// Carta empaquetada (respaldo sin conexión)
// ---------------------------------------------------------------------
export function bundledCatalog(): Catalog {
  return finish(
    'bundled',
    MENU,
    {
      name: 'Pollos Rokoko',
      claim: 'Calidad y sabor sin límite',
      whatsapp: config.WHATSAPP,
      address: config.ADDRESS,
      phone: config.PHONE,
      hours: config.HOURS,
      paymentMethods: [...config.PAYMENT_METHODS],
      deliveryNote: config.DELIVERY_NOTE,
      orderingEnabled: true,
    },
    {
      featured: FEATURED_IDS,
      extras: EXTRA_IDS,
      upsell: UPSELL_IDS,
      party: PARTY.flatMap((p) => p.picks.map(([slug, variantIndex]) => ({ party: p.id, slug, variantIndex }))),
    },
  );
}

// ---------------------------------------------------------------------
// Carta desde Supabase
// ---------------------------------------------------------------------
type Raw = {
  settings: SettingsRow;
  categories: CategoryRow[];
  products: ProductRow[];
  variants: VariantRow[];
  groups: OptionGroupRow[];
  choices: OptionChoiceRow[];
  productGroups: ProductOptionGroupRow[];
  party: PartyPickRow[];
};

const bySort = <T extends { sort: number; id: number }>(a: T, b: T) => a.sort - b.sort || a.id - b.id;

function parseHours(h: unknown): Hours | null {
  if (!h || typeof h !== 'object') return null;
  const out: Hours = {};
  for (const [k, v] of Object.entries(h as Record<string, unknown>)) {
    if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && typeof v[1] === 'string') out[Number(k)] = [v[0], v[1]];
  }
  return Object.keys(out).length ? out : null;
}

export function catalogFromRaw(raw: Raw, source: 'db' | 'cache'): Catalog {
  const groupById = new Map<number, OptionGroup>();
  for (const g of raw.groups) {
    groupById.set(g.id, {
      id: String(g.id),
      dbId: g.id,
      label: g.label,
      hint: g.hint ?? undefined,
      min: g.min_select,
      max: g.max_select,
      choices: raw.choices
        .filter((c) => c.group_id === g.id && c.active)
        .sort(bySort)
        .map((c) => ({ id: String(c.id), dbId: c.id, label: c.label, price: c.price || undefined, weight: c.weight > 1 ? c.weight : undefined })),
    });
  }

  const categories: Category[] = raw.categories
    .filter((c) => c.active)
    .sort(bySort)
    .map((c) => ({
      id: c.slug,
      name: c.name,
      icon: c.icon,
      note: c.note ?? undefined,
      items: raw.products
        .filter((p) => p.category_id === c.id && p.active)
        .sort(bySort)
        .flatMap((p): Item[] => {
          const variants = raw.variants
            .filter((v) => v.product_id === p.id)
            .sort(bySort)
            .map((v) => ({ label: v.label, price: v.price, dbId: v.id }));
          if (!variants.length) return []; // un plato sin precio no se puede vender
          const options = raw.productGroups
            .filter((pg) => pg.product_id === p.id)
            .sort((a, b) => a.sort - b.sort || a.group_id - b.group_id)
            .map((pg) => groupById.get(pg.group_id))
            .filter((g): g is OptionGroup => !!g && g.choices.length > 0);
          return [{
            id: p.slug,
            dbId: p.id,
            name: p.name,
            desc: p.description ?? undefined,
            tag: p.tag ?? undefined,
            icon: p.icon || c.icon,
            photo: p.photo_url ?? undefined,
            variants,
            hasSizes: variants.length > 1 || variants[0].label !== '',
            options,
            extras: c.allows_extras,
            note: p.show_category_note ? c.note ?? undefined : undefined,
            categoryId: c.slug,
            categoryName: c.name,
          }];
        }),
    }))
    .filter((c) => c.items.length > 0);

  const slugOf = new Map(raw.products.map((p) => [p.id, p.slug]));
  const active = raw.products.filter((p) => p.active);
  const s = raw.settings;
  return finish(
    source,
    categories,
    {
      name: s.name,
      claim: s.claim,
      whatsapp: s.whatsapp,
      address: s.address,
      phone: s.phone,
      hours: parseHours(s.hours),
      paymentMethods: s.payment_methods.length ? s.payment_methods : ['Efectivo'],
      deliveryNote: s.delivery_note,
      orderingEnabled: s.ordering_enabled,
    },
    {
      featured: active.filter((p) => p.featured).sort((a, b) => a.featured_sort - b.featured_sort || a.id - b.id).map((p) => p.slug),
      extras: active.filter((p) => p.is_extra).sort(bySort).map((p) => p.slug),
      upsell: active.filter((p) => p.is_upsell).sort(bySort).map((p) => p.slug),
      party: [...raw.party].sort(bySort).map((pp) => {
        const variants = raw.variants.filter((v) => v.product_id === pp.product_id).sort(bySort);
        return {
          party: pp.party,
          slug: slugOf.get(pp.product_id) ?? '',
          variantIndex: variants.findIndex((v) => v.id === pp.variant_id),
        };
      }),
    },
  );
}

export async function fetchRaw(): Promise<Raw> {
  if (!supabase) throw new Error('supabase_not_configured');
  const [settings, categories, products, variants, groups, choices, productGroups, party] = await Promise.all([
    supabase.from('settings').select('*').eq('id', 1).single(),
    supabase.from('categories').select('*'),
    supabase.from('products').select('*'),
    supabase.from('product_variants').select('*'),
    supabase.from('option_groups').select('*'),
    supabase.from('option_choices').select('*'),
    supabase.from('product_option_groups').select('*'),
    supabase.from('party_picks').select('*'),
  ]);
  for (const r of [settings, categories, products, variants, groups, choices, productGroups, party]) {
    if (r.error) throw r.error;
  }
  return {
    settings: settings.data!,
    categories: categories.data!,
    products: products.data!,
    variants: variants.data!,
    groups: groups.data!,
    choices: choices.data!,
    productGroups: productGroups.data!,
    party: party.data!,
  };
}

// ---------------------------------------------------------------------
// Estado de la carta en la app
// ---------------------------------------------------------------------
const CACHE_KEY = 'rokoko-carta-v1';

function readCache(): Catalog | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? catalogFromRaw(JSON.parse(raw), 'cache') : null;
  } catch {
    return null;
  }
}

/** Carga la carta: muestra al instante la copia guardada y la actualiza desde Supabase. */
export function useCatalogLoader(): { catalog: Catalog; refresh: () => void } {
  const [catalog, setCatalog] = useState<Catalog>(() => readCache() ?? bundledCatalog());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    fetchRaw()
      .then((raw) => {
        if (!alive) return;
        setCatalog(catalogFromRaw(raw, 'db'));
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(raw));
        } catch {
          /* sin almacenamiento: solo se pierde la carga instantánea */
        }
      })
      .catch(() => {
        /* sin conexión: se queda la copia guardada o la empaquetada */
      });
    return () => {
      alive = false;
    };
  }, [tick]);

  // Precios frescos si la persona vuelve a la pestaña después de un rato.
  useEffect(() => {
    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - last > 5 * 60_000) {
        last = Date.now();
        setTick((t) => t + 1);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  return { catalog, refresh: () => setTick((t) => t + 1) };
}

export const CatalogContext = createContext<Catalog | null>(null);

export function useCatalog(): Catalog {
  const c = useContext(CatalogContext);
  if (!c) throw new Error('useCatalog fuera de CatalogContext');
  return c;
}
