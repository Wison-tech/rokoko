import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Altura que ocupan arriba la barra superior y la de categorías cuando están pegadas.
 * No se usa la posición actual de la barra: antes de pegarse está más abajo.
 */
export function stickyOffset() {
  const bar = document.querySelector<HTMLElement>('.chips-bar');
  if (!bar) return 0;
  return parseFloat(getComputedStyle(bar).top) + bar.offsetHeight;
}

/**
 * Sigue qué categoría está en pantalla. `ids` debe listar solo las secciones
 * renderizadas (cambia al buscar), para volver a observarlas.
 */
export function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  const lockUntil = useRef(0);
  const key = ids.join('|');

  useEffect(() => {
    const onScroll = () => {
      if (Date.now() < lockUntil.current) return;
      const line = stickyOffset() + 24;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(`cat-${id}`);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      // Al llegar al final, la última sección corta nunca cruza la línea.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = ids[ids.length - 1];
      }
      if (current) setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const goTo = useCallback((id: string) => {
    const el = document.getElementById(`cat-${id}`);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - stickyOffset() - 8;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setActive(id);
    lockUntil.current = Date.now() + (reduce ? 0 : 900);
    window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
  }, []);

  return { active, goTo };
}
