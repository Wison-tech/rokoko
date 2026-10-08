import { useEffect, useRef, useState } from 'react';
import { useCatalog } from '../data/catalog';
import type { CartLine, PastOrder } from '../hooks/useCart';
import { useStored } from '../hooks/useStored';
import { money, orderCode } from '../lib/format';
import { describe, toOrderItem, type Selection } from '../lib/order';
import { rpcErrorCode, supabase } from '../lib/supabase';
import {
  buildMessage,
  checkoutErrors,
  EMPTY_CHECKOUT,
  openWhatsApp,
  ticketFromCart,
  ticketFromServer,
  whatsappUrl,
  type Checkout,
} from '../lib/whatsapp';
import { CheckoutForm } from './Checkout';
import { BackIcon, CheckIcon, CloseIcon, RepeatIcon, WhatsAppIcon } from './Icons';
import { summary } from './LastOrder';
import { Sheet } from './Sheet';

type Props = {
  open: boolean;
  onClose: () => void;
  lines: CartLine[];
  total: number;
  history: PastOrder[];
  onChange: (key: string, delta: number) => void;
  onAdd: (sel: Selection, qty: number) => void;
  onClear: () => void;
  onArchive: (order: { code: string; total: number; id?: string; token?: string }) => void;
  onRepeat: (order: PastOrder) => void;
  onForget: (code: string) => void;
  onRefreshCatalog: () => void;
};

type Step = 'cart' | 'checkout' | 'sent';
type Sent = { code: string; url: string; id?: string; token?: string; signal?: 'enviado' | 'arrepentido' };

/** Datos del cliente que se recuerdan para el próximo pedido. */
const REMEMBER: (keyof Checkout)[] = ['mode', 'name', 'phone', 'address', 'barrio', 'reference', 'payment'];
const parseCustomer = (raw: unknown): Partial<Checkout> => {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  return Object.fromEntries(REMEMBER.filter((k) => typeof r[k] === 'string').map((k) => [k, r[k]]));
};

const MENU_CHANGED = ['product_unavailable', 'invalid_variant', 'invalid_choice', 'invalid_options', 'invalid_extra', 'extras_not_allowed'];

export function CartSheet(props: Props) {
  const { open, onClose, lines, total, history, onChange, onAdd, onClear, onArchive, onRepeat, onForget, onRefreshCatalog } = props;
  const { settings, upsell, byId } = useCatalog();
  const [step, setStep] = useState<Step>('cart');
  const [customer, setCustomer] = useStored<Partial<Checkout>>('rokoko-cliente', {}, parseCustomer);
  const [form, setForm] = useState<Checkout>(() => ({ ...EMPTY_CHECKOUT, ...customer }));
  const [showErrors, setShowErrors] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmRegret, setConfirmRegret] = useState(false);
  const [signalBusy, setSignalBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Si la forma de pago guardada ya no existe en la carta, usa la primera disponible.
  useEffect(() => {
    if (!settings.paymentMethods.includes(form.payment)) setForm((f) => ({ ...f, payment: settings.paymentMethods[0] }));
  }, [settings.paymentMethods, form.payment]);

  // Cada vez que se abre, empieza en el resumen (salvo que acabe de enviar).
  useEffect(() => {
    if (open) {
      setStep((s) => (s === 'sent' ? 'sent' : 'cart'));
      setConfirmClear(false);
      setSendError(null);
    } else if (step === 'sent') {
      const t = window.setTimeout(() => {
        setStep('cart');
        setSent(null);
        setConfirmRegret(false);
      }, 400);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [step]);

  const patch = (p: Partial<Checkout>) => setForm((f) => ({ ...f, ...p }));
  const errors = checkoutErrors(form, total);
  const valid = Object.keys(errors).length === 0;

  const send = async () => {
    if (sending) return;
    if (!valid) {
      setShowErrors(true);
      const first = Object.keys(errors)[0];
      if (first) document.getElementById(`co-${first}`)?.focus();
      return;
    }
    setSending(true);
    setSendError(null);

    let order: { code: string; total: number; id?: string; token?: string; ticket: ReturnType<typeof ticketFromCart> } | null = null;

    // 1) Registrar el pedido en Supabase (el servidor recalcula precios y da el código).
    const maybe = lines.map((l) => toOrderItem(l.item, l.sel, l.qty, byId));
    const items = maybe.filter((x): x is NonNullable<typeof x> => x !== null);
    if (supabase && items.length === maybe.length) {
      const { data, error } = await supabase.rpc('create_order', {
        p: {
          customer: {
            name: form.name.trim(),
            phone: form.phone.trim(),
            mode: form.mode,
            address: form.address.trim(),
            barrio: form.barrio.trim(),
            reference: form.reference.trim(),
            table: form.table.trim(),
            payment: form.payment,
            cash_with: form.cashWith,
            scheduled_time: form.when === 'programar' ? form.time : '',
            note: form.note.trim(),
          },
          items,
        },
      });
      if (error) {
        const code = rpcErrorCode(error);
        if (code === 'ordering_disabled') {
          setSendError('En este momento el restaurante no está recibiendo pedidos por la página.');
          onRefreshCatalog();
          setSending(false);
          return;
        }
        if (MENU_CHANGED.includes(code)) {
          setSendError('La carta acaba de cambiar y algún plato ya no está igual. La actualizamos: revisa tu pedido.');
          onRefreshCatalog();
          setStep('cart');
          setSending(false);
          return;
        }
        if (code.startsWith('invalid_')) {
          setSendError('Revisa tus datos: algo no quedó bien escrito.');
          setShowErrors(true);
          setSending(false);
          return;
        }
        // Sin conexión u otro fallo: se envía por WhatsApp igual, sin registrar.
      } else if (data && typeof data === 'object' && !Array.isArray(data)) {
        const d = data as { id: string; code: string; token: string; total: number; items: Parameters<typeof ticketFromServer>[0] };
        order = { code: d.code, total: d.total, id: d.id, token: d.token, ticket: ticketFromServer(d.items) };
      }
    }
    if (!order) order = { code: orderCode(), total, ticket: ticketFromCart(lines, byId) };

    const url = whatsappUrl(settings.whatsapp, buildMessage(order.code, order.ticket, order.total, form));

    // 2) Guardar todo ANTES de abrir WhatsApp (si el navegador cambia de pestaña, no se pierde).
    setCustomer(Object.fromEntries(REMEMBER.map((k) => [k, form[k]])) as Partial<Checkout>);
    onArchive({ code: order.code, total: order.total, id: order.id, token: order.token });
    setSent({ code: order.code, url, id: order.id, token: order.token });
    setShowErrors(false);
    patch({ note: '', time: '', cashWith: '', when: 'ya' });
    setStep('sent');
    setSending(false);

    // 3) Abrir WhatsApp.
    window.setTimeout(() => openWhatsApp(url), 120);
  };

  const signal = async (s: 'enviado' | 'arrepentido') => {
    if (!sent?.id || !sent.token || !supabase) return;
    setSignalBusy(true);
    const { error } = await supabase.rpc('customer_signal', { p_id: sent.id, p_token: sent.token, p_signal: s });
    setSignalBusy(false);
    setConfirmRegret(false);
    if (!error) {
      setSent({ ...sent, signal: s });
      if (s === 'arrepentido') onForget(sent.code);
    }
  };

  const count = lines.reduce((n, l) => n + l.qty, 0);
  const title = step === 'checkout' ? 'Finalizar pedido' : step === 'sent' ? '¡Pedido listo!' : 'Mi pedido';
  const canSend = !!settings.whatsapp && settings.orderingEnabled;

  return (
    <Sheet open={open} onClose={onClose} labelledBy="cartTitle" className="sheet--cart">
      <div className="cart__head">
        {step === 'checkout' ? (
          <button className="round-btn" type="button" onClick={() => setStep('cart')} aria-label="Volver al pedido">
            <BackIcon />
          </button>
        ) : (
          <span className="cart__logo" aria-hidden="true">
            <img src="/img/logo.png" alt="" width={40} height={40} />
          </span>
        )}
        <h3 id="cartTitle">{title}</h3>
        <button className="round-btn" type="button" onClick={onClose} aria-label="Cerrar">
          <CloseIcon />
        </button>
      </div>

      {step !== 'sent' && lines.length > 0 && (
        <ol className="steps" aria-label="Pasos">
          <li className="is-done">Pedido</li>
          <li className={step === 'checkout' ? 'is-done' : ''}>Datos</li>
          <li>WhatsApp</li>
        </ol>
      )}

      <div className="cart__body" ref={bodyRef}>
        {step === 'sent' && sent && (
          <div className="sent">
            <span className={`sent__check ${sent.signal === 'arrepentido' ? 'is-cancel' : ''}`} aria-hidden="true">
              {sent.signal === 'arrepentido' ? <CloseIcon /> : <CheckIcon />}
            </span>
            <p className="sent__code">Pedido {sent.code}</p>

            {sent.signal === 'arrepentido' ? (
              <p className="sent__text">Cancelamos tu pedido. Si ya lo habías enviado por WhatsApp, avísale al restaurante.</p>
            ) : sent.signal === 'enviado' ? (
              <p className="sent__text">
                <strong>¡Gracias!</strong> Cuando el restaurante lo confirme lo verás en la página de inicio, con el estado
                de tu pedido.
              </p>
            ) : (
              <p className="sent__text">
                Abrimos WhatsApp con tu pedido escrito. <strong>Toca enviar en WhatsApp</strong> para que el restaurante lo
                reciba y te confirme el total y el tiempo de entrega.
              </p>
            )}

            {sent.signal !== 'arrepentido' && (
              <a className="btn btn--wa" href={sent.url} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon /> {sent.signal ? 'Abrir el chat' : '¿No se abrió? Abrir WhatsApp'}
              </a>
            )}

            {sent.id && !sent.signal && (
              <div className="sent__ask">
                {confirmRegret ? (
                  <>
                    <p>¿Seguro que quieres cancelar este pedido?</p>
                    <div className="sent__row">
                      <button className="btn btn--danger" type="button" disabled={signalBusy} onClick={() => signal('arrepentido')}>
                        Sí, cancelar
                      </button>
                      <button className="btn btn--ghost" type="button" onClick={() => setConfirmRegret(false)}>
                        No
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p>¿Ya enviaste el mensaje en WhatsApp?</p>
                    <div className="sent__row">
                      <button className="btn btn--white" type="button" disabled={signalBusy} onClick={() => signal('enviado')}>
                        <CheckIcon /> Sí, ya lo envié
                      </button>
                      <button className="btn btn--ghost" type="button" onClick={() => setConfirmRegret(true)}>
                        Me arrepentí
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {!sent.id && (
              <p className="sent__note">
                Sin conexión con el sistema: el pedido no quedó registrado en la página, pero el mensaje de WhatsApp lleva
                todo el detalle.
              </p>
            )}

            <button className="btn btn--ghost" type="button" onClick={onClose}>
              Volver a la carta
            </button>
          </div>
        )}

        {step === 'cart' && lines.length === 0 && (
          <div className="cart__empty">
            <p className="cart__empty-icon" aria-hidden="true">
              🐔
            </p>
            <p>Tu pedido está vacío. Toca cualquier plato de la carta para empezar.</p>
            {history.length > 0 && (
              <div className="history">
                <p className="group__label">Tus pedidos anteriores</p>
                {history.map((o) => (
                  <div className="history__row" key={o.code + o.date}>
                    <div>
                      <strong>{o.code}</strong>
                      <span>{summary(o, byId, 3)}</span>
                    </div>
                    <button className="btn btn--white btn--sm" type="button" onClick={() => onRepeat(o)}>
                      <RepeatIcon /> Repetir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'cart' && lines.length > 0 && (
          <>
            {sendError && <p className="form-alert">{sendError}</p>}
            <ul className="cart__list">
              {lines.map((l) => {
                const { options, extras } = describe(l.item, l.sel, byId);
                return (
                  <li className="line" key={l.key}>
                    <span className="line__icon" aria-hidden="true">
                      {l.item.icon}
                    </span>
                    <div className="line__info">
                      <strong>
                        {l.item.name}
                        {l.sel.label && <span className="line__size"> · {l.sel.label}</span>}
                      </strong>
                      {options.length > 0 && <span className="line__opts">{options.join(' · ')}</span>}
                      {extras.length > 0 && <span className="line__opts">+ {extras.join(', ')}</span>}
                      {l.sel.note && <span className="line__note">“{l.sel.note}”</span>}
                      <em>{money(l.unit * l.qty)}</em>
                    </div>
                    <div className="stepper stepper--sm" role="group" aria-label={`Cantidad de ${l.item.name}`}>
                      <button type="button" onClick={() => onChange(l.key, -1)} aria-label={l.qty === 1 ? 'Quitar del pedido' : 'Quitar uno'}>
                        {l.qty === 1 ? '🗑' : '−'}
                      </button>
                      <output>{l.qty}</output>
                      <button type="button" onClick={() => onChange(l.key, 1)} disabled={l.qty >= 99} aria-label="Agregar uno">
                        +
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {upsell.length > 0 && (
              <div className="upsell">
                <p className="group__label">¿Le falta algo?</p>
                <div className="upsell__track">
                  {upsell
                    .filter((u) => u.options.length === 0)
                    .map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        className="upsell__item"
                        onClick={() => onAdd({ id: u.id, label: u.variants[0].label, opts: {}, extras: [], note: '' }, 1)}
                      >
                        <span aria-hidden="true">{u.icon}</span>
                        <span className="upsell__name">{u.name}</span>
                        <span className="upsell__price">+{money(u.variants[0].price)}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div className="clear-row">
              {confirmClear ? (
                <>
                  <span>¿Vaciar todo el pedido?</span>
                  <button
                    type="button"
                    className="link-btn link-btn--danger"
                    onClick={() => {
                      onClear();
                      setConfirmClear(false);
                    }}
                  >
                    Sí, vaciar
                  </button>
                  <button type="button" className="link-btn" onClick={() => setConfirmClear(false)}>
                    No
                  </button>
                </>
              ) : (
                <button type="button" className="link-btn" onClick={() => setConfirmClear(true)}>
                  Vaciar pedido
                </button>
              )}
            </div>
          </>
        )}

        {step === 'checkout' && lines.length > 0 && (
          <>
            <CheckoutForm data={form} onChange={patch} total={total} showErrors={showErrors} />
            {sendError && <p className="form-alert">{sendError}</p>}
          </>
        )}
      </div>

      {step !== 'sent' && lines.length > 0 && (
        <div className="cart__foot">
          <div className="cart__total">
            <span>
              Total · {count} producto{count === 1 ? '' : 's'}
              {form.mode === 'domicilio' && step === 'checkout' && <small> + domicilio</small>}
            </span>
            <strong>{money(total)}</strong>
          </div>
          {!settings.orderingEnabled ? (
            <p className="setup-warning">En este momento no estamos recibiendo pedidos por la página. ¡Vuelve pronto!</p>
          ) : step === 'cart' ? (
            <button className="btn btn--red btn--block" type="button" onClick={() => setStep('checkout')}>
              Continuar
            </button>
          ) : canSend ? (
            <button className="btn btn--wa btn--block" type="button" onClick={send} disabled={sending} aria-busy={sending}>
              <WhatsAppIcon /> {sending ? 'Registrando pedido…' : 'Enviar pedido por WhatsApp'}
            </button>
          ) : (
            <p className="setup-warning">El restaurante aún no configuró su número de WhatsApp.</p>
          )}
        </div>
      )}
    </Sheet>
  );
}
