import type { Item } from '../data/menu';

/** Foto (con anillo punteado, como en la carta) o el ícono del plato. */
export function ItemThumb({ item, className }: { item: Item; className: string }) {
  if (item.photo) {
    return (
      <span className={`${className} ${className}--photo`}>
        <img src={item.photo} alt="" loading="lazy" />
      </span>
    );
  }
  return (
    <span className={className} aria-hidden="true">
      <span className="emoji">{item.icon}</span>
    </span>
  );
}
