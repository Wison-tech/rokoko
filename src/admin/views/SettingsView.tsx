import { useEffect, useState } from 'react';
import type { SettingsRow } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';
import { Field, Toggle, errText, toast } from '../ui';

const DAYS = [
  [1, 'Lunes'],
  [2, 'Martes'],
  [3, 'Miércoles'],
  [4, 'Jueves'],
  [5, 'Viernes'],
  [6, 'Sábado'],
  [0, 'Domingo'],
] as const;

type DayHours = { open: boolean; from: string; to: string };

export function SettingsView() {
  const [s, setS] = useState<SettingsRow | null>(null);
  const [showHours, setShowHours] = useState(false);
  const [hours, setHours] = useState<Record<number, DayHours>>({});
  const [newPay, setNewPay] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase!
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data, error }) => {
        if (error) return toast(errText(error), 'error');
        setS(data);
        const h = (data.hours ?? null) as Record<string, [string, string]> | null;
        setShowHours(!!h);
        setHours(
          Object.fromEntries(
            DAYS.map(([d]) => {
              const v = h?.[String(d)];
              return [d, { open: !!v, from: v?.[0] ?? '11:00', to: v?.[1] ?? '21:00' }];
            }),
          ),
        );
      });
  }, []);

  if (!s) return <section className="a-view"><p className="a-muted">Cargando…</p></section>;

  const set = (patch: Partial<SettingsRow>) => setS({ ...s, ...patch });
  const waDigits = s.whatsapp.replace(/\D/g, '');

  const save = async (extra?: Partial<SettingsRow>) => {
    const next = { ...s, ...extra };
    if (next.whatsapp && !/^\d{10,15}$/.test(next.whatsapp)) return toast('El WhatsApp debe llevar el indicativo: 57 + 10 dígitos (ej. 573001234567).', 'error');
    if (!next.payment_methods.length) return toast('Deja al menos una forma de pago.', 'error');
    for (const [d, h] of Object.entries(hours)) {
      if (showHours && h.open && h.from >= h.to) {
        return toast(`Revisa el horario del ${DAYS.find(([x]) => x === Number(d))?.[1]}: la hora de cierre debe ser después de la de apertura.`, 'error');
      }
    }
    setBusy(true);
    const hoursJson = showHours
      ? Object.fromEntries(Object.entries(hours).filter(([, h]) => h.open).map(([d, h]) => [d, [h.from, h.to]]))
      : null;
    const { error } = await supabase!
      .from('settings')
      .update({
        name: next.name.trim(),
        claim: next.claim.trim(),
        whatsapp: next.whatsapp,
        address: next.address.trim(),
        phone: next.phone.trim(),
        hours: hoursJson,
        payment_methods: next.payment_methods,
        delivery_note: next.delivery_note.trim(),
        ordering_enabled: next.ordering_enabled,
      })
      .eq('id', 1);
    setBusy(false);
    if (error) return toast(errText(error), 'error');
    setS(next);
    toast('Ajustes guardados');
  };

  return (
    <section className="a-view">
      <header className="a-view__head">
        <div>
          <h1>Ajustes</h1>
          <p className="a-muted">Datos del negocio que se muestran en la carta y en los pedidos.</p>
        </div>
        <button type="button" className="a-btn a-btn--primary" onClick={() => save()} disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </header>

      <section className={`a-card a-pad a-switchcard ${s.ordering_enabled ? 'is-on' : 'is-off'}`}>
        <Toggle
          checked={s.ordering_enabled}
          onChange={(v) => void save({ ordering_enabled: v })}
          label={s.ordering_enabled ? 'Recibiendo pedidos por la página' : 'Pedidos pausados'}
          hint={s.ordering_enabled ? 'Apágalo si cerraste o estás saturado: la carta se sigue viendo, pero no deja enviar.' : 'Los clientes ven la carta pero no pueden enviar pedidos.'}
        />
      </section>

      <section className="a-card a-pad">
        <h2 className="a-h2">Negocio</h2>
        <div className="a-form-grid">
          <Field label="Nombre">
            <input className="a-input" value={s.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Frase">
            <input className="a-input" value={s.claim} onChange={(e) => set({ claim: e.target.value })} />
          </Field>
        </div>
        <Field label="WhatsApp que recibe los pedidos" hint={waDigits ? `Los pedidos llegan a +${waDigits}` : 'Indicativo + número, sin espacios. Ej: 573001234567'}>
          <input className="a-input" inputMode="numeric" value={s.whatsapp} onChange={(e) => set({ whatsapp: e.target.value.replace(/\D/g, '') })} />
        </Field>
        <div className="a-form-grid">
          <Field label="Dirección (opcional)" hint="Se muestra en el pie de la carta">
            <input className="a-input" value={s.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
          <Field label="Teléfono (opcional)">
            <input className="a-input" value={s.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
        </div>
        <Field label="Nota sobre el domicilio" hint="Se muestra al cliente cuando elige domicilio">
          <input className="a-input" value={s.delivery_note} onChange={(e) => set({ delivery_note: e.target.value })} />
        </Field>
      </section>

      <section className="a-card a-pad">
        <h2 className="a-h2">Formas de pago</h2>
        <div className="a-chips a-chips--edit">
          {s.payment_methods.map((p) => (
            <span key={p} className="a-chip">
              {p}
              <button type="button" aria-label={`Quitar ${p}`} onClick={() => set({ payment_methods: s.payment_methods.filter((x) => x !== p) })}>
                ✕
              </button>
            </span>
          ))}
        </div>
        <div className="a-row">
          <input className="a-input" placeholder="Ej: Tarjeta (datáfono)" value={newPay} onChange={(e) => setNewPay(e.target.value)} />
          <button
            type="button"
            className="a-btn"
            disabled={!newPay.trim() || s.payment_methods.includes(newPay.trim())}
            onClick={() => {
              set({ payment_methods: [...s.payment_methods, newPay.trim()] });
              setNewPay('');
            }}
          >
            ＋ Agregar
          </button>
        </div>
      </section>

      <section className="a-card a-pad">
        <h2 className="a-h2">Horario</h2>
        <Toggle checked={showHours} onChange={setShowHours} label="Mostrar horario y estado “Abierto / Cerrado”" />
        {showHours && (
          <ul className="a-hours">
            {DAYS.map(([d, name]) => {
              const h = hours[d];
              return (
                <li key={d} className={!h.open ? 'is-off' : ''}>
                  <Toggle checked={h.open} onChange={(v) => setHours({ ...hours, [d]: { ...h, open: v } })} label={name} />
                  {h.open ? (
                    <span className="a-row">
                      <input className="a-input" type="time" value={h.from} onChange={(e) => setHours({ ...hours, [d]: { ...h, from: e.target.value } })} aria-label={`${name} abre`} />
                      <span className="a-muted">a</span>
                      <input className="a-input" type="time" value={h.to} onChange={(e) => setHours({ ...hours, [d]: { ...h, to: e.target.value } })} aria-label={`${name} cierra`} />
                    </span>
                  ) : (
                    <span className="a-muted">Cerrado</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="a-row a-row--end">
        <button type="button" className="a-btn a-btn--primary" onClick={() => save()} disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </section>
  );
}
