import { money } from '../lib/format';
import { CartIcon } from './Icons';

/** Barra flotante con el pedido en curso. */
export function CartBar({ count, total, hidden, onOpen }: { count: number; total: number; hidden: boolean; onOpen: () => void }) {
  const show = count > 0 && !hidden;
  return (
    <div className={`cartbar ${show ? 'is-on' : ''}`} aria-hidden={!show}>
      <button type="button" className="cartbar__btn" onClick={onOpen} tabIndex={show ? 0 : -1}>
        <span className="cartbar__count">
          <CartIcon />
          {count}
        </span>
        <span className="cartbar__label">Ver mi pedido</span>
        <span className="cartbar__total">{money(total)}</span>
      </button>
    </div>
  );
}
