import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useCatalog } from '../data/catalog';
import type { Category, Item } from '../data/menu';
import { useActiveSection } from '../hooks/useActiveSection';
import { normalize } from '../lib/format';
import { CloseIcon, HeartIcon, SearchIcon } from './Icons';
import { ItemThumb } from './ItemThumb';
import { FromPrice } from './Price';

type Props = {
  onOpen: (item: Item) => void;
  favs: string[];
  navRef: React.MutableRefObject<((id: string) => void) | null>;
};

export function Menu({ onOpen, favs, navRef }: Props) {
  const { categories, byId } = useCatalog();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);

  // Texto de búsqueda precalculado por plato.
  const haystack = useMemo(
    () =>
      new Map(
        categories.flatMap((c) =>
          c.items.map((i) => [
            i.id,
            normalize(
              [c.name, i.name, i.desc, i.tag, ...i.variants.map((v) => v.label), ...i.options.flatMap((g) => g.choices.map((ch) => ch.label))].join(' '),
            ),
          ]),
        ),
      ),
    [categories],
  );

  const sections: Category[] = useMemo(() => {
    const favCat: Category[] = favs.length
      ? [{ id: 'favoritos', name: 'Tus favoritos', icon: '❤️', items: favs.map((id) => byId[id]).filter(Boolean) }]
      : [];
    const all = [...favCat, ...categories];
    const words = normalize(deferred.trim()).split(/\s+/).filter(Boolean);
    if (!words.length) return all;
    return all
      .filter((c) => c.id !== 'favoritos')
      .map((c) => ({ ...c, items: c.items.filter((i) => words.every((w) => (haystack.get(i.id) ?? '').includes(w))) }))
      .filter((c) => c.items.length > 0);
  }, [deferred, favs, categories, byId, haystack]);

  const ids = useMemo(() => sections.map((c) => c.id), [sections]);
  const { active, goTo } = useActiveSection(ids);

  // El encabezado y otras secciones también navegan a las categorías.
  useEffect(() => {
    navRef.current = (id) => {
      if (!ids.includes(id)) setQuery('');
      requestAnimationFrame(() => goTo(id));
    };
  }, [ids, goTo, navRef]);

  // Centra el chip activo dentro de su fila, sin mover la página.
  const chipsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = chipsRef.current;
    const chip = row?.querySelector<HTMLElement>(`[data-cat="${active}"]`);
    if (!row || !chip || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({ left: chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2, behavior: 'smooth' });
  }, [active]);

  const searching = deferred.trim().length > 0;

  return (
    <section className="menu" id="menu" aria-labelledby="menuTitle">
      <div className="wrap">
        <div className="menu__head">
          <h2 id="menuTitle" className="display">
            Nuestra <span>carta</span>
          </h2>
          <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
            <SearchIcon />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
              placeholder="Busca pollo, mojarra, salchipapa…"
              autoComplete="off"
              enterKeyHint="search"
              aria-label="Buscar en la carta"
            />
            {query && (
              <button type="button" className="search__clear" onClick={() => setQuery('')} aria-label="Borrar búsqueda">
                <CloseIcon />
              </button>
            )}
          </form>
        </div>
      </div>

      <div className="chips-bar">
        <nav className="chips wrap" ref={chipsRef} aria-label="Categorías">
          {sections.map((c) => (
            <a
              key={c.id}
              href={`#cat-${c.id}`}
              data-cat={c.id}
              className={`chip ${c.id === active ? 'is-active' : ''}`}
              aria-current={c.id === active ? 'true' : undefined}
              onClick={(e) => {
                e.preventDefault();
                goTo(c.id);
              }}
            >
              <span aria-hidden="true">{c.icon}</span>
              {c.id === 'favoritos' ? 'Favoritos' : c.name}
              {searching && <span className="chip__count">{c.items.length}</span>}
            </a>
          ))}
        </nav>
      </div>

      <div className="wrap">
        {sections.map((c) => (
          <section className={`cat panel ${c.id === 'favoritos' ? 'cat--fav' : ''}`} id={`cat-${c.id}`} key={c.id} aria-labelledby={`h-${c.id}`}>
            <h3 className="ticket" id={`h-${c.id}`}>
              <span aria-hidden="true">★</span> {c.name} <span aria-hidden="true">★</span>
            </h3>
            {c.note && <p className="cat__note">{c.note}</p>}
            <ul className="rows">
              {c.items.map((item) => (
                <li key={item.id}>
                  <button className="row" type="button" onClick={() => onOpen(item)}>
                    <ItemThumb item={item} className="row__img" />
                    <span className="row__body">
                      {item.tag && <span className="row__tag">{item.tag}</span>}
                      <span className="row__name">
                        {item.name}
                        {c.id !== 'favoritos' && favs.includes(item.id) && <HeartIcon className="row__fav" filled />}
                      </span>
                      {item.desc && <span className="row__desc">{item.desc}</span>}
                      {(item.hasSizes || item.options.length > 0) && (
                        <span className="row__meta">
                          {item.variants.length > 1 && item.variants.map((v) => <span key={v.label}>{v.label}</span>)}
                          {item.options.length > 0 && <span className="row__custom">✦ Personalizable</span>}
                        </span>
                      )}
                    </span>
                    {/* Precio y "+" siempre en la misma columna: todas las tarjetas quedan alineadas. */}
                    <span className="row__side">
                      <span className="row__price">
                        <FromPrice item={item} />
                      </span>
                      <span className="plus" aria-hidden="true">
                        +
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {sections.length === 0 && (
          <div className="empty panel">
            <p>
              No encontramos “{deferred}” en la carta.
            </p>
            <button type="button" className="btn btn--white" onClick={() => setQuery('')}>
              Ver toda la carta
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
