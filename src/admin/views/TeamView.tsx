import { useCallback, useEffect, useState } from 'react';
import type { AdminRow } from '../../lib/database.types';
import { rpcErrorCode, supabase } from '../../lib/supabase';
import { ConfirmButton, Field, errText, toast } from '../ui';

export function TeamView() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: u }, { data, error }] = await Promise.all([supabase!.auth.getUser(), supabase!.from('admins').select('*').order('created_at')]);
    setMe(u.user?.id ?? null);
    if (error) return toast(errText(error), 'error');
    setAdmins(data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase!.rpc('add_admin', { p_email: email.trim() });
    setBusy(false);
    if (error) {
      return toast(
        rpcErrorCode(error) === 'user_not_found'
          ? 'Ese correo aún no tiene cuenta. Pídele que entre a /admin y toque “Crear cuenta” primero.'
          : errText(error),
        'error',
      );
    }
    toast(`${email.trim()} ahora es administrador`);
    setEmail('');
    void load();
  };

  const remove = async (a: AdminRow) => {
    const { error } = await supabase!.from('admins').delete().eq('user_id', a.user_id);
    if (error) return toast(errText(error), 'error');
    toast(`${a.email} ya no tiene acceso`);
    void load();
  };

  return (
    <section className="a-view">
      <header className="a-view__head">
        <div>
          <h1>Equipo</h1>
          <p className="a-muted">Personas que pueden ver pedidos y editar la carta.</p>
        </div>
      </header>

      <section className="a-card a-pad">
        <ul className="a-team">
          {admins.map((a) => (
            <li key={a.user_id}>
              <span className="a-team__avatar" aria-hidden="true">
                {a.email.slice(0, 1).toUpperCase()}
              </span>
              <span className="a-team__body">
                <strong>{a.email}</strong>
                <small className="a-muted">Desde {new Date(a.created_at).toLocaleDateString('es-CO')}</small>
              </span>
              {a.user_id === me ? (
                <span className="a-tag">Tú</span>
              ) : (
                <ConfirmButton onConfirm={() => remove(a)} confirmLabel="¿Quitar acceso?">
                  Quitar
                </ConfirmButton>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="a-card a-pad">
        <h2 className="a-h2">Agregar a alguien</h2>
        <ol className="a-steps-list">
          <li>
            La persona abre <strong>{window.location.origin}/admin</strong>, toca <strong>Crear cuenta</strong> y confirma su correo.
          </li>
          <li>Tú escribes su correo aquí.</li>
        </ol>
        <form className="a-row" onSubmit={add}>
          <Field label="Correo">
            <input className="a-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <button type="submit" className="a-btn a-btn--primary" disabled={busy || !email.trim()}>
            Dar acceso
          </button>
        </form>
      </section>
    </section>
  );
}
