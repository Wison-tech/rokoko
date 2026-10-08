import { useEffect } from 'react';

let locks = 0;

/** Bloquea el scroll de la página mientras `active` sea true, sin saltos por la barra de scroll. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    if (locks++ === 0) {
      const gap = window.innerWidth - html.clientWidth;
      html.style.overflow = 'hidden';
      if (gap > 0) html.style.paddingRight = `${gap}px`;
    }
    return () => {
      if (--locks === 0) {
        html.style.overflow = '';
        html.style.paddingRight = '';
      }
    };
  }, [active]);
}
