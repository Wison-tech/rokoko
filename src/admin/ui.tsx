import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const cop = (n: number | null | undefined) => '$' + Math.round(n ?? 0).toLocaleString('es-CO');

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Interruptor accesible (role="switch"). */
export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="a-toggle">
      <button type="button" role="switch" aria-checked={checked} className="a-toggle__sw" onClick={() => onChange(!checked)}>
        <span />
      </button>
      <span className="a-toggle__text">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

export function Field({ label, hint, children, error }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className={`a-field ${error ? 'has-error' : ''}`}>
      <span className="a-field__label">{label}</span>
      {children}
      {error ? <span className="a-field__error">{error}</span> : hint && <span className="a-field__hint">{hint}</span>}
    </label>
  );
}

/** Botón que pide confirmación en línea (sin diálogos del navegador). */
export function ConfirmButton({
  children,
  confirmLabel = '¿Seguro?',
  onConfirm,
  className = 'a-btn a-btn--ghost-danger',
  disabled,
}: {
  children: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  className?: string;
  disabled?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!asking) return;
    const t = window.setTimeout(() => setAsking(false), 5000);
    return () => window.clearTimeout(t);
  }, [asking]);
  if (asking) {
    return (
      <span className="a-confirm">
        <span>{confirmLabel}</span>
        <button
          type="button"
          className="a-btn a-btn--danger a-btn--sm"
          onClick={() => {
            setAsking(false);
            onConfirm();
          }}
        >
          Sí
        </button>
        <button type="button" className="a-btn a-btn--sm" onClick={() => setAsking(false)}>
          No
        </button>
      </span>
    );
  }
  return (
    <button type="button" className={className} disabled={disabled} onClick={() => setAsking(true)}>
      {children}
    </button>
  );
}

/** Panel lateral (escritorio) / hoja completa (celular). */
export function Drawer({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="a-drawer" role="presentation">
      <div className="a-drawer__scrim" onClick={onClose} />
      <div className={`a-drawer__panel ${wide ? 'is-wide' : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} tabIndex={-1} ref={ref}>
        <header className="a-drawer__head">
          <h2>{title}</h2>
          <button type="button" className="a-icon-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </header>
        <div className="a-drawer__body">{children}</div>
        {footer && <footer className="a-drawer__foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

type ToastMsg = { id: number; text: string; kind: 'ok' | 'error' };
let pushToast: (text: string, kind?: 'ok' | 'error') => void = () => {};
export const toast = (text: string, kind: 'ok' | 'error' = 'ok') => pushToast(text, kind);

export function Toaster() {
  const [list, setList] = useState<ToastMsg[]>([]);
  useEffect(() => {
    pushToast = (text, kind = 'ok') => {
      const id = Date.now() + Math.random();
      setList((l) => [...l, { id, text, kind }]);
      window.setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3000);
    };
    return () => {
      pushToast = () => {};
    };
  }, []);
  return (
    <div className="a-toaster" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`a-toast ${t.kind === 'error' ? 'is-error' : ''}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

/** Mensaje legible para errores de Supabase. */
export function errText(e: { message?: string; code?: string } | null | undefined): string {
  const m = e?.message ?? '';
  if (e?.code === '23505' || m.includes('duplicate key')) return 'Ya existe un registro con ese nombre o código.';
  if (e?.code === '23503' || m.includes('foreign key')) return 'No se puede: hay otros datos que dependen de este.';
  if (m.includes('row-level security') || e?.code === '42501') return 'Tu cuenta no tiene permiso para hacer esto.';
  if (m.includes('Failed to fetch')) return 'Sin conexión. Revisa el internet e inténtalo de nuevo.';
  return m || 'Algo salió mal. Inténtalo de nuevo.';
}

export function Empty({ icon = '🐔', title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return (
    <div className="a-empty">
      <span aria-hidden="true">{icon}</span>
      <p className="a-empty__title">{title}</p>
      {children && <div className="a-empty__body">{children}</div>}
    </div>
  );
}
