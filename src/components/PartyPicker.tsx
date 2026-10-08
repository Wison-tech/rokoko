import { useState } from 'react';
import { useCatalog } from '../data/catalog';
import type { Item } from '../data/menu';
import { money } from '../lib/format';
import { ItemThumb } from './ItemThumb';

type Props = { onOpen: (item: Item, variantIndex?: number) => void };

const PEOPLE: Record<string, number> = { '1': 1, '2': 2, '4': 4, '6': 4 };

/** "¿Para cuántos es?": sugiere combos y tamaños según el número de personas. */
export function PartyPicker({ onOpen }: Props) {
  const { party } = useCatalog();
  const [sel, setSel] = useState<string>('2');
  if (!party.length) return null;
  const group = party.find((p) => p.id === sel) ?? party[0];

  return (
    <section className="party wrap" id="para-cuantos" aria-labelledby="partyTitle">
      <div className="panel party__panel">
        <h2 className="ticket" id="partyTitle">
          <span aria-hidden="true">★</span> ¿Para cuántos es? <span aria-hidden="true">★</span>
        </h2>
        <p className="party__lead">Te recomendamos lo que mejor rinde para tu grupo.</p>
        <div className="party__seg" role="radiogroup" aria-label="Número de personas">
          {party.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={p.id === group.id}
              className={p.id === group.id ? 'is-on' : ''}
              onClick={() => setSel(p.id)}
            >
              <span className="party__people" aria-hidden="true">
                {'🧑'.repeat(PEOPLE[p.id] ?? 1)}
              </span>
              {p.label}
            </button>
          ))}
        </div>
        <div className="party__list" key={group.id}>
          {group.picks.map(({ item, variantIndex }, i) => {
            const v = item.variants[variantIndex] ?? item.variants[0];
            return (
              <button
                key={item.id + i}
                type="button"
                className="pick"
                style={{ animationDelay: `${i * 50}ms` }}
                onClick={() => onOpen(item, variantIndex)}
              >
                <ItemThumb item={item} className="pick__img" />
                <span className="pick__body">
                  <span className="pick__name">{item.name}</span>
                  {v.label && <span className="pick__size">{v.label}</span>}
                </span>
                <span className="pick__price">{money(v.price)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
