import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useScrollLock } from '../hooks/useScrollLock';

const DURATION = 320;

type Props = {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  className?: string;
  children: ReactNode;
};

/** Hoja modal: entra desde abajo en móvil y como diálogo/cajón en pantallas grandes. */
export function Sheet({ open, onClose, labelledBy, className = '', children }: Props) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useScrollLock(mounted);

  useEffect(() => {
    if (open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      setMounted(true);
      // Dos frames: el panel se pinta fuera de pantalla antes de animar.
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setVisible(false);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = window.setTimeout(() => setMounted(false), reduce ? 0 : DURATION);
    returnFocus.current?.focus({ preventScroll: true });
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (visible) panelRef.current?.focus({ preventScroll: true });
  }, [visible]);

  if (!mounted) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;
    const focusables = panelRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className={`sheet ${className} ${visible ? 'is-open' : ''}`} onKeyDown={onKeyDown}>
      <div className="sheet__scrim" onClick={onClose} />
      <div
        ref={panelRef}
        className="sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}
