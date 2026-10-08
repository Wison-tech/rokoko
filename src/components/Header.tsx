import { useEffect, useRef, useState } from 'react';
import { useCatalog } from '../data/catalog';
import { openStatus } from '../lib/hours';
import { CartIcon, ShareIcon } from './Icons';

type Props = {
  count: number;
  onCart: () => void;
  onNav: (categoryId: string) => void;
  onShare: () => void;
};

export function Header({ count, onCart, onNav, onShare }: Props) {
  const { settings, categories } = useCatalog();
  // Accesos rápidos de escritorio: las primeras categorías de la carta.
  const links = categories.slice(0, 4);
  const status = openStatus(settings.hours);

  // Rebote del botón cada vez que sube el contador.
  const [bump, setBump] = useState(false);
  const prev = useRef(count);
  useEffect(() => {
    if (count > prev.current) {
      setBump(false);
      requestAnimationFrame(() => setBump(true));
    }
    prev.current = count;
  }, [count]);

  return (
    <header className="topbar" id="top">
      <div className="topbar__inner wrap">
        <a className="brand" href="#top" aria-label="Pollos Rokoko, inicio">
          <img src="/img/logo.png" alt="" width={46} height={46} />
          <span className="brand__text">
            <strong>Pollos Rokoko</strong>
            {status ? (
              <small className={`status ${status.open ? 'is-open' : ''}`}>{status.text}</small>
            ) : (
              <small>Al horno · Frito · Broaster</small>
            )}
          </span>
        </a>
        <nav className="nav" aria-label="Secciones">
          {links.map((c) => (
            <a
              key={c.id}
              href={`#cat-${c.id}`}
              onClick={(e) => {
                e.preventDefault();
                onNav(c.id);
              }}
            >
              {c.name}
            </a>
          ))}
        </nav>
        <button className="round-btn" type="button" onClick={onShare} aria-label="Compartir el menú">
          <ShareIcon />
        </button>
        <button
          className={`cart-btn ${bump ? 'bump' : ''}`}
          type="button"
          onClick={onCart}
          onAnimationEnd={() => setBump(false)}
          aria-label={count ? `Ver mi pedido, ${count} productos` : 'Ver mi pedido'}
        >
          <CartIcon />
          <span className="cart-btn__label">Mi pedido</span>
          {count > 0 && (
            <span className="badge" aria-hidden="true">
              {count}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
