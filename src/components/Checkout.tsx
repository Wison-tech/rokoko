import { useState } from 'react';
import { useCatalog } from '../data/catalog';
import { money, parseMoney } from '../lib/format';
import { checkoutErrors, MODE_LABEL, type Checkout as CheckoutData, type DeliveryMode } from '../lib/whatsapp';

type Props = {
  data: CheckoutData;
  onChange: (patch: Partial<CheckoutData>) => void;
  total: number;
  showErrors: boolean;
};

const MODES: { id: DeliveryMode; icon: string }[] = [
  { id: 'domicilio', icon: '🛵' },
  { id: 'recoger', icon: '🏃' },
  { id: 'local', icon: '🍽️' },
];

function Field({
  id,
  label,
  error,
  children,
  optional,
}: {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`fieldset ${error ? 'has-error' : ''}`}>
      <label htmlFor={id} className="fieldset__label">
        {label}
        {optional && <span> (opcional)</span>}
      </label>
      {children}
      {error && (
        <p className="fieldset__error" id={`${id}-err`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function CheckoutForm({ data, onChange, total, showErrors }: Props) {
  const { settings } = useCatalog();
  // Un error se muestra si ya se intentó enviar o si el campo ya se visitó.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const all = checkoutErrors(data, total);
  const err = (k: keyof CheckoutData) => (showErrors || touched[k] ? all[k] : undefined);
  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));
  const aria = (k: keyof CheckoutData) => ({ 'aria-invalid': !!err(k), 'aria-describedby': err(k) ? `co-${k}-err` : undefined });

  const cash = parseMoney(data.cashWith);

  return (
    <div className="checkout">
      <div className="group">
        <p className="group__label">¿Cómo lo quieres?</p>
        <div className="modes" role="radiogroup" aria-label="Tipo de entrega">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={data.mode === m.id}
              className={`mode ${data.mode === m.id ? 'is-on' : ''}`}
              onClick={() => onChange({ mode: m.id })}
            >
              <span className="mode__icon" aria-hidden="true">
                {m.icon}
              </span>
              {MODE_LABEL[m.id]}
            </button>
          ))}
        </div>
        {data.mode === 'domicilio' && settings.deliveryNote && <p className="group__hint">{settings.deliveryNote}</p>}
      </div>

      <Field id="co-name" label="Tu nombre" error={err('name')}>
        <input id="co-name" className="field" value={data.name} onChange={(e) => onChange({ name: e.target.value })} onBlur={blur('name')} autoComplete="name" {...aria('name')} />
      </Field>

      <Field id="co-phone" label="Tu celular" optional error={err('phone')}>
        <input id="co-phone" className="field" type="tel" inputMode="tel" value={data.phone} onChange={(e) => onChange({ phone: e.target.value })} onBlur={blur('phone')} autoComplete="tel" placeholder="Para avisarte si hay alguna novedad" {...aria('phone')} />
      </Field>

      {data.mode === 'domicilio' && (
        <>
          <Field id="co-address" label="Dirección" error={err('address')}>
            <input id="co-address" className="field" value={data.address} onChange={(e) => onChange({ address: e.target.value })} onBlur={blur('address')} autoComplete="street-address" placeholder="Calle 10 # 5-20, apto 301" {...aria('address')} />
          </Field>
          <div className="field-row">
            <Field id="co-barrio" label="Barrio" error={err('barrio')}>
              <input id="co-barrio" className="field" value={data.barrio} onChange={(e) => onChange({ barrio: e.target.value })} onBlur={blur('barrio')} {...aria('barrio')} />
            </Field>
            <Field id="co-reference" label="Referencia" optional>
              <input id="co-reference" className="field" value={data.reference} onChange={(e) => onChange({ reference: e.target.value })} placeholder="Casa esquinera…" />
            </Field>
          </div>
        </>
      )}

      {data.mode === 'local' && (
        <Field id="co-table" label="Número de mesa" optional>
          <input id="co-table" className="field" inputMode="numeric" value={data.table} onChange={(e) => onChange({ table: e.target.value })} />
        </Field>
      )}

      <div className="group">
        <p className="group__label">¿Cómo pagas?</p>
        <div className="choices">
          {settings.paymentMethods.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={data.payment === p}
              className={`choice ${data.payment === p ? 'is-on' : ''}`}
              onClick={() => onChange({ payment: p })}
            >
              <span className="choice__mark" aria-hidden="true" />
              {p}
            </button>
          ))}
        </div>
      </div>

      {data.payment === 'Efectivo' && (
        <Field id="co-cashWith" label="¿Con cuánto pagas?" optional error={err('cashWith')}>
          <div className="field-money">
            <span aria-hidden="true">$</span>
            <input
              id="co-cashWith"
              className="field"
              inputMode="numeric"
              value={data.cashWith}
              onChange={(e) => {
                const n = parseMoney(e.target.value);
                onChange({ cashWith: n ? n.toLocaleString('es-CO') : '' });
              }}
              onBlur={blur('cashWith')}
              placeholder={total.toLocaleString('es-CO')}
              {...aria('cashWith')}
            />
          </div>
          {cash >= total && cash > 0 && (
            <p className="group__hint">
              Te devuelven {money(cash - total)}
              {data.mode === 'domicilio' ? ' menos el domicilio' : ''}.
            </p>
          )}
        </Field>
      )}

      <div className="group">
        <p className="group__label">¿Para cuándo?</p>
        <div className="choices">
          <button type="button" role="radio" aria-checked={data.when === 'ya'} className={`choice ${data.when === 'ya' ? 'is-on' : ''}`} onClick={() => onChange({ when: 'ya' })}>
            <span className="choice__mark" aria-hidden="true" />
            Lo antes posible
          </button>
          <button type="button" role="radio" aria-checked={data.when === 'programar'} className={`choice ${data.when === 'programar' ? 'is-on' : ''}`} onClick={() => onChange({ when: 'programar' })}>
            <span className="choice__mark" aria-hidden="true" />
            Programar hora
          </button>
        </div>
        {data.when === 'programar' && (
          <Field id="co-time" label="Hora" error={err('time')}>
            <input id="co-time" type="time" className="field field--time" value={data.time} onChange={(e) => onChange({ time: e.target.value })} onBlur={blur('time')} {...aria('time')} />
          </Field>
        )}
      </div>

      <Field id="co-note" label="Nota para el restaurante" optional>
        <textarea id="co-note" className="field" rows={2} maxLength={200} value={data.note} onChange={(e) => onChange({ note: e.target.value })} placeholder="Ej: traer cubiertos, timbre dañado…" />
      </Field>
    </div>
  );
}
