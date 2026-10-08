import { useCatalog } from '../data/catalog';
import type { Item } from '../data/menu';
import { ItemThumb } from './ItemThumb';
import { FromPrice } from './Price';

export function Featured({ onOpen }: { onOpen: (item: Item) => void }) {
  const { featured } = useCatalog();
  if (!featured.length) return null;
  return (
    <section className="featured wrap" aria-labelledby="favTitle">
      <div className="section-head">
        <h2 id="favTitle" className="headline">
          Los <span>recomendados</span>
        </h2>
      </div>
      <div className="featured__track">
        {featured.map((item, i) => (
          <button key={item.id} className={`fcard ${i === 1 ? 'fcard--hot' : ''}`} type="button" onClick={() => onOpen(item)}>
            <ItemThumb item={item} className="fcard__img" />
            <span className="fcard__name">{item.name}</span>
            <span className="fcard__row">
              <span className="fcard__price">
                <FromPrice item={item} />
              </span>
              <span className="plus" aria-hidden="true">
                +
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
