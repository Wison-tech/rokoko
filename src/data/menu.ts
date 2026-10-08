// Carta empaquetada de Pollos Rokoko (fuente: CARTAS ROKOKO.pdf).
// La carta "viva" se edita desde el panel /admin y vive en Supabase; esta copia
// solo se usa si Supabase no responde en la primera visita, y para generar la
// carga inicial de la base (supabase/seed.sql).
// Cada plato tiene precio fijo (`p`) o tamaños (`v`: [etiqueta, precio]).

export type Variant = { label: string; price: number; /** id en Supabase */ dbId?: number };
type Photo = 'pollo' | 'arroz';

export type Choice = {
  id: string;
  dbId?: number;
  label: string;
  /** Costo adicional sobre el precio del plato. */
  price?: number;
  /** Cuántos "cupos" ocupa en el grupo (p. ej. ¼ de pollo cuenta como 2 proteínas). */
  weight?: number;
};

export type OptionGroup = {
  id: string;
  dbId?: number;
  label: string;
  hint?: string;
  /** Cupos mínimos y máximos. min 1 / max 1 = elegir exactamente una. */
  min: number;
  max: number;
  choices: Choice[];
};

export type Item = {
  /** slug estable, p. ej. "pollo-broaster" */
  id: string;
  dbId?: number;
  name: string;
  desc?: string;
  tag?: string;
  icon: string;
  /** URL de la foto */
  photo?: string;
  /** Ordenado de menor a mayor; los platos de precio fijo tienen uno solo, con etiqueta vacía. */
  variants: Variant[];
  hasSizes: boolean;
  options: OptionGroup[];
  /** Si el plato admite adicionales ("Agrégale…"). */
  extras: boolean;
  /** Acompañamiento de la categoría que aplica a este plato. */
  note?: string;
  categoryId: string;
  categoryName: string;
};

export type Category = { id: string; name: string; icon: string; note?: string; items: Item[] };

export const PHOTOS: Record<Photo, string> = { pollo: '/img/pollo.jpg', arroz: '/img/arroz.jpg' };

// ---------- Grupos de opciones reutilizables ----------

const one = (id: string, label: string, choices: [string, string][], hint?: string): OptionGroup => ({
  id, label, hint, min: 1, max: 1, choices: choices.map(([cid, l]) => ({ id: cid, label: l })),
});

const ESTILO = one('estilo', 'Estilo', [['horno', 'Al horno'], ['frito', 'Frito']]);
const MITAD = one('mitad', 'Tu otra mitad', [['horno', 'Al horno'], ['frito', 'Frita']], 'Una mitad es broaster; la otra, ¿al horno o frita?');
const PAPA_FS = one('papa', 'Papa', [['francesa', 'Francesa'], ['salada', 'Salada']]);
const PAPA_FC = one('papa', 'Papa', [['francesa', 'Francesa'], ['criolla', 'Criolla']]);
const ACOMP = one('acomp', 'Acompañante', [['arroz', 'Arroz'], ['ensalada', 'Ensalada']]);
const POLLO_TIPO = one('pollo', 'Pollo', [['asado', 'Asado'], ['frito', 'Frito'], ['broaster', 'Broaster']]);
const ARROZ_TIPO = one('arroz', 'Tipo de arroz', [['chino', 'Chino'], ['paisa', 'Paisa']]);
const BEBIDA_COMBO = one('bebida', 'Bebida', [['gaseosa', 'Gaseosa'], ['limonada', 'Limonada']]);
const GASEOSA_JUGO = one('bebida', '¿Gaseosa o jugo?', [['gaseosa', 'Gaseosa'], ['jugo', 'Jugo']]);

const PROTEINAS: [string, string][] = [
  ['res', 'Res'], ['cerdo', 'Cerdo'], ['mojarrita', 'Mojarrita'], ['pechuga', 'Pechuga'], ['chorizo', 'Chorizo'],
];
const PROTEINA_1 = one('proteina', 'Proteína', PROTEINAS);
const PROTEINAS_PA2: OptionGroup = {
  id: 'proteinas',
  label: 'Proteínas',
  hint: 'Elige 2 individuales, o una especial: ¼ de pollo o costillitas.',
  min: 2,
  max: 2,
  choices: [
    ...PROTEINAS.map(([id, label]) => ({ id, label })),
    { id: 'cuarto-pollo', label: '¼ de pollo', weight: 2 },
    { id: 'costillitas', label: 'Costillitas', weight: 2 },
  ],
};

// ---------- Carta ----------

type RawItem = {
  id: string;
  n: string;
  d?: string;
  tag?: string;
  icon?: string;
  photo?: Photo;
  p?: number;
  v?: [string, number][];
  o?: OptionGroup[];
  noNote?: boolean;
};
type RawCategory = { id: string; name: string; icon: string; note?: string; extras: boolean; o?: OptionGroup[]; items: RawItem[] };

const RAW: RawCategory[] = [
  {
    id: 'pollo', name: 'Pollo', icon: '🍗', extras: true,
    items: [
      { id: 'pollo-horno-frito', n: 'Pollo al horno o frito', d: 'Con papa (francesa o salada) y arepa.', photo: 'pollo', o: [ESTILO, PAPA_FS],
        v: [['¼', 9500], ['½', 18500], ['1 pollo', 36000]] },
      { id: 'pollo-broaster', n: 'Pollo broaster', d: 'Crocante, con papa francesa y yuca.', photo: 'pollo',
        v: [['¼', 10500], ['½', 20000], ['1 pollo', 38000]] },
      { id: 'pollo-miti-miti', n: 'Pollo Miti-Miti', d: '½ al horno o frito + ½ broaster, con papa salada, papa francesa, yuca y arepa.', p: 37000, tag: 'Lo mejor de los dos', o: [MITAD] },
    ],
  },
  {
    id: 'combos', name: 'Combos de pollo', icon: '🍗', extras: true,
    items: [
      { id: 'combo-horno-frito', n: 'Combo pollo al horno o frito', d: 'Papa francesa o salada, arepa, plátano con queso y bocadillo + gaseosa 1.5L.', photo: 'pollo', tag: 'Para la familia', o: [ESTILO, PAPA_FS],
        v: [['1 pollo', 47000], ['1½ pollos', 65500], ['2 pollos', 83000]] },
      { id: 'combo-miti-miti', n: 'Combo Miti-Miti', d: '½ al horno o frito + ½ broaster, papa salada, papa francesa, yuca, arepa + gaseosa 1.5L.', p: 42000, o: [MITAD] },
      { id: 'combo-broaster', n: 'Combo pollo broaster', d: 'Papa francesa y yuca + gaseosa 1.5L.',
        v: [['1 pollo', 43000], ['1½ pollos', 63000], ['2 pollos', 81000]] },
    ],
  },
  {
    id: 'especiales', name: 'Especiales', icon: '🥩', extras: true, o: [ACOMP, PAPA_FC],
    note: 'Acompañados de arroz o ensalada + papa (francesa o criolla) + tajada de plátano.',
    items: [
      { id: 'tabla-rokoko', n: 'Tabla Rokoko', d: 'Res, cerdo, pechuga y chorizo.', p: 32000, tag: 'De la casa', icon: '🍖' },
      { id: 'churrasco', n: 'Churrasco', p: 32000 },
      { id: 'mojarra', n: 'Mojarra', p: 26000, icon: '🐟' },
      { id: 'pechuga', n: 'Pechuga', p: 27000, icon: '🍗' },
      { id: 'pechuga-gratinada', n: 'Pechuga gratinada', p: 30000, icon: '🧀' },
      { id: 'pechuga-milanesa', n: 'Pechuga milanesa', p: 30000, icon: '🍗' },
      { id: 'pechuga-ranchera', n: 'Pechuga ranchera', p: 32000, icon: '🌶️' },
      { id: 'costillas-bbq', n: 'Costillas BBQ', p: 29000, icon: '🍖' },
      { id: 'alas-bbq', n: 'Alas BBQ', d: 'Con papa (francesa o criolla) y tajadas de plátano.', icon: '🍗', noNote: true, o: [PAPA_FC],
        v: [['8 piezas', 18000], ['12 piezas', 25000], ['16 piezas', 32000]] },
    ],
  },
  {
    id: 'bandejas', name: 'Bandejas', icon: '🍛', extras: true, o: [PAPA_FC],
    note: 'Acompañadas de arroz + papa (francesa o criolla) + yuca + ensalada.',
    items: [
      { id: 'bandeja-pollo', n: 'Pollo asado, frito o broaster', p: 16500, icon: '🍗', o: [POLLO_TIPO, PAPA_FC] },
      { id: 'bandeja-pechuga-plancha', n: 'Pechuga a la plancha', p: 16500 },
      { id: 'bandeja-pechuga-gratinada', n: 'Pechuga gratinada', p: 19000 },
      { id: 'bandeja-pechuga-milanesa', n: 'Pechuga milanesa', p: 19000 },
      { id: 'bandeja-pechuga-ranchera', n: 'Pechuga ranchera', p: 21000 },
      { id: 'bandeja-res', n: 'Carne de res', p: 19000, icon: '🥩' },
      { id: 'bandeja-cerdo', n: 'Carne de cerdo', p: 19000, icon: '🥩' },
      { id: 'bandeja-costillitas', n: 'Costillitas BBQ', p: 19000, icon: '🍖' },
    ],
  },
  {
    id: 'arroces', name: 'Arroces', icon: '🍚', extras: true,
    items: [
      { id: 'arroz-clasico', n: 'Arroz chino o paisa clásico', d: 'Con papa francesa. El familiar grande trae gaseosa 1.5L.', photo: 'arroz', o: [ARROZ_TIPO],
        v: [['Personal', 14000], ['Familiar pequeño', 27500], ['Familiar grande', 57000]] },
      { id: 'combo-arroz', n: 'Combo arroz chino o paisa', d: 'Personal, con papa francesa + 1 proteína: res, cerdo, mojarrita, pechuga o chorizo.', p: 19500, photo: 'arroz', o: [ARROZ_TIPO, PROTEINA_1] },
      { id: 'combo-arroz-pa2', n: 'Combo arroz Pa’2 chino o paisa', d: 'Papa francesa + 2 proteínas individuales (res, cerdo, mojarrita, pechuga o chorizo) o una especial: ¼ de pollo o costillitas.', p: 26000, tag: 'Para dos', o: [ARROZ_TIPO, PROTEINAS_PA2] },
      { id: 'combo-arroz-familiar', n: 'Combo arroz familiar chino o paisa', d: 'Papa francesa + gaseosa 1.5L. El pequeño trae ½ pollo; el grande, 1 pollo entero.', o: [ARROZ_TIPO],
        v: [['Pequeño · ½ pollo', 53000], ['Grande · 1 pollo', 90000]] },
      { id: 'arroz-camaron', n: 'Arroz chino con camarón', d: 'Con papa a la francesa.', icon: '🍤',
        v: [['Personal', 26000], ['Familiar pequeño', 50000]] },
      { id: 'arroz-con-pollo', n: 'Arroz con pollo', d: 'Con papa (francesa o criolla) y ensalada.', p: 19000, o: [PAPA_FC] },
      { id: 'arroz-atollado', n: 'Arroz atollado', d: 'Con papa (francesa o criolla).', p: 24000, o: [PAPA_FC] },
    ],
  },
  {
    id: 'sopas', name: 'Sopas', icon: '🍲', extras: true,
    items: [
      { id: 'ajiaco', n: 'Ajiaco', d: 'Acompañado de arroz, presa de pollo y aguacate.', p: 11000 },
      { id: 'ajiaco-especial', n: 'Ajiaco especial', d: 'Acompañado de arroz, ¼ de pollo y aguacate.', p: 16000 },
      { id: 'menudencia', n: 'Menudencia', d: 'Acompañada de arroz.', p: 8000 },
      { id: 'sopa-pequena', n: 'Sopa pequeña', p: 5000 },
    ],
  },
  {
    id: 'rapidas', name: 'Comidas rápidas', icon: '🍔', extras: true,
    items: [
      { id: 'hamburguesa', n: 'Hamburguesa', v: [['Sencilla', 13000], ['Especial', 14000], ['Doble', 20000]] },
      { id: 'perro', n: 'Perro caliente', icon: '🌭', v: [['Sencillo', 11000], ['Especial', 13000]] },
      { id: 'choriperro', n: 'Choriperro', icon: '🌭', v: [['Sencillo', 12000], ['Especial', 14000]] },
      { id: 'salchipapa', n: 'Salchipapa', icon: '🍟', v: [['Pequeña', 12500], ['Mediana', 20000], ['Grande', 32000]] },
      { id: 'choripapa', n: 'Choripapa', icon: '🍟', v: [['Pequeña', 15000], ['Mediana', 23000], ['Grande', 35000]] },
      { id: 'mazorcada', n: 'Mazorcada', p: 20000, icon: '🌽' },
      { id: 'pataconazo', n: 'Pataconazo', p: 20000, icon: '🫓' },
      { id: 'combo-hamburguesa', n: 'Combo hamburguesa', d: 'Papa (francesa o criolla) + gaseosa o limonada.', tag: 'Combo', o: [PAPA_FC, BEBIDA_COMBO],
        v: [['Sencilla', 20000], ['Especial', 21000], ['Doble', 28000]] },
      { id: 'combo-hamburguesa-pa2', n: 'Combo hamburguesa Pa’2', d: '2 papas (francesa o criolla) + 2 gaseosas o limonadas.', tag: 'Para dos', o: [PAPA_FC, BEBIDA_COMBO],
        v: [['Sencilla', 37000], ['Especial', 39000]] },
    ],
  },
  {
    id: 'adicionales', name: 'Adicionales', icon: '🍟', extras: false,
    items: [
      { id: 'papa-francesa', n: 'Papa francesa', p: 5000 },
      { id: 'papa-criolla', n: 'Papa criolla', p: 5000, icon: '🥔' },
      { id: 'papa-salada', n: 'Papa salada', p: 3500, icon: '🥔' },
      { id: 'yuca', n: 'Yuca', p: 5000, icon: '🥔' },
      { id: 'arroz', n: 'Arroz', p: 3000, icon: '🍚' },
      { id: 'platano-queso', n: 'Plátano con queso y bocadillo', p: 6000, icon: '🍌' },
      { id: 'tajadas', n: 'Tajadas de plátano', p: 3500, icon: '🍌' },
      { id: 'huevos-codorniz', n: 'Huevos de codorniz', p: 4000, icon: '🥚' },
      { id: 'ensalada', n: 'Ensalada', p: 3500, icon: '🥗' },
    ],
  },
  {
    id: 'bebidas', name: 'Bebidas', icon: '🥤', extras: false,
    items: [
      { id: 'gaseosa-350', n: 'Gaseosa o jugo 350 ml', p: 3300, o: [GASEOSA_JUGO] },
      { id: 'gaseosa-400', n: 'Gaseosa 400 ml', p: 3300 },
      { id: 'gaseosa-1-5', n: 'Gaseosa o jugo 1.5 L', p: 7500, o: [GASEOSA_JUGO] },
      { id: 'jugo-hit', n: 'Jugo Hit 500 ml', p: 3800, icon: '🧃' },
      { id: 'jugo-agua', n: 'Jugo en agua', p: 5500, icon: '🧃' },
      { id: 'limonada', n: 'Limonada personal', p: 3300, icon: '🍋' },
      { id: 'jarrita-limonada', n: 'Jarrita de limonada', p: 5000, icon: '🍋' },
      { id: 'jarra-limonada', n: 'Jarra de limonada', p: 7500, icon: '🍋' },
      { id: 'mr-tea', n: 'Mr Tea', p: 3800, icon: '🧋' },
      { id: 'agua', n: 'Botella de agua', p: 2500, icon: '💧' },
    ],
  },
];

export const MENU: Category[] = RAW.map((c) => ({
  id: c.id,
  name: c.name,
  icon: c.icon,
  note: c.note,
  items: c.items.map((r) => ({
    id: r.id,
    name: r.n,
    desc: r.d,
    tag: r.tag,
    icon: r.icon ?? c.icon,
    photo: r.photo ? PHOTOS[r.photo] : undefined,
    variants: r.v ? r.v.map(([label, price]) => ({ label, price })) : [{ label: '', price: r.p! }],
    hasSizes: !!r.v,
    options: r.o ?? (r.noNote ? [] : c.o ?? []),
    extras: c.extras,
    note: r.noNote ? undefined : c.note,
    categoryId: c.id,
    categoryName: c.name,
  })),
}));

export const ITEMS: Item[] = MENU.flatMap((c) => c.items);
export const ITEMS_BY_ID: Record<string, Item> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

/** Adicionales que se ofrecen dentro de cada plato ("Agrégale…"). Usan el precio de la carta. */
export const EXTRA_IDS = ['papa-francesa', 'papa-criolla', 'platano-queso', 'tajadas', 'huevos-codorniz', 'yuca', 'limonada', 'gaseosa-400'];

/** Bebidas y acompañantes de un toque en "¿Le falta algo?". */
export const UPSELL_IDS = ['limonada', 'gaseosa-400', 'jugo-hit', 'papa-francesa', 'platano-queso', 'agua'];

/** Platos en "Los recomendados". */
export const FEATURED_IDS = ['pollo-horno-frito', 'pollo-broaster', 'combo-horno-frito', 'combo-arroz-pa2', 'salchipapa'];

/** Recomendaciones de "¿Para cuántos?": plato + tamaño sugerido. */
export const PARTY: { id: string; label: string; picks: [string, number][] }[] = [
  { id: '1', label: 'Solo yo', picks: [['bandeja-pollo', 0], ['pollo-horno-frito', 0], ['combo-arroz', 0], ['combo-hamburguesa', 0]] },
  { id: '2', label: 'Pa’2', picks: [['combo-arroz-pa2', 0], ['combo-hamburguesa-pa2', 0], ['pollo-broaster', 1], ['alas-bbq', 1]] },
  { id: '4', label: '3 a 4', picks: [['combo-horno-frito', 0], ['combo-miti-miti', 0], ['combo-broaster', 0], ['combo-arroz-familiar', 0]] },
  { id: '6', label: '5 o más', picks: [['combo-horno-frito', 2], ['combo-broaster', 2], ['combo-arroz-familiar', 1], ['alas-bbq', 2]] },
];


if (import.meta.env.DEV) {
  const ids = ITEMS.map((i) => i.id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) console.error('IDs de plato repetidos en menu.ts:', dup);
  const refs = [...EXTRA_IDS, ...FEATURED_IDS, ...PARTY.flatMap((p) => p.picks.map(([id]) => id))];
  const missing = refs.filter((id) => !ITEMS_BY_ID[id]);
  if (missing.length) console.error('IDs que no existen en la carta:', missing);
}
