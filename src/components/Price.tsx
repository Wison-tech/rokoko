import type { Item } from '../data/menu';
import { money } from '../lib/format';

export const minPrice = (item: Item) => Math.min(...item.variants.map((v) => v.price));

/** Precio de la tarjeta: "desde $X" cuando el plato tiene tamaños. */
export function FromPrice({ item }: { item: Item }) {
  return (
    <>
      {item.hasSizes && <small>desde </small>}
      {money(minPrice(item))}
    </>
  );
}
