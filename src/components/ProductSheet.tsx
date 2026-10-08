import { useRef, useState } from 'react';
import { useCatalog } from '../data/catalog';
import type { Item, OptionGroup } from '../data/menu';
import { money } from '../lib/format';
import { groupStatus, missingGroups, toggleChoice, unitPrice, type Selection } from '../lib/order';
import { CloseIcon, HeartIcon } from './Icons';
import { Sheet } from './Sheet';

type Props = {
  item: Item | null;
  /** Tamaño preseleccionado (p. ej. desde "¿Para cuántos es?"). */
  variantIndex: number;
  /** Cambia en cada apertura para reiniciar las elecciones. */
  openId: number;
  open: boolean;
  onClose: () => void;
  onAdd: (sel: Selection, qty: number) => void;
  isFav: boolean;
  onToggleFav: () => void;
};

export function ProductSheet({ item, variantIndex, openId, open, onClose, onAdd, isFav, onToggleFav }: Props) {
  return (
    <Sheet open={open && !!item} onClose={onClose} labelledBy="sheetName" className="sheet--product">
      {item && (
        <ProductBody
          key={openId}
          item={item}
          initialVariant={variantIndex}
          onClose={onClose}
          onAdd={onAdd}
          isFav={isFav}
          onToggleFav={onToggleFav}
        />
      )}
    </Sheet>
  );
}

function groupHint(g: OptionGroup) {
  if (g.hint) return g.hint;
  if (g.min === 1 && g.max === 1) return 'Elige una';
  return `Elige ${g.max}`;
}

function ProductBody({
  item,
  initialVariant,
  onClose,
  onAdd,
  isFav,
  onToggleFav,
}: Omit<Props, 'item' | 'variantIndex' | 'openId' | 'open'> & { item: Item; initialVariant: number }) {
  const { extras: EXTRAS, byId } = useCatalog();
  const [vi, setVi] = useState(Math.min(initialVariant, item.variants.length - 1));
  const [opts, setOpts] = useState<Record<string, string[]>>({});
  const [extras, setExtras] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [qty, setQty] = useState(1);
  const [flash, setFlash] = useState<string | null>(null);
  const groupRefs = useRef<Record<string, HTMLFieldSetElement | null>>({});

  const variant = item.variants[vi];
  const sel: Selection = { id: item.id, label: variant.label, opts, extras, note: note.trim() };
  const unit = unitPrice(item, sel, byId);
  const missing = missingGroups(item, opts);

  const submit = () => {
    if (missing.length) {
      const g = missing[0];
      groupRefs.current[g.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFlash(null);
      requestAnimationFrame(() => setFlash(g.id));
      return;
    }
    if (navigator.vibrate) navigator.vibrate(18);
    onAdd(sel, qty);
  };

  return (
    <>
      <div className="pmedia" style={item.photo ? { backgroundImage: `url(${item.photo})` } : undefined}>
        {!item.photo && (
          <span className="pmedia__emoji" aria-hidden="true">
            {item.icon}
          </span>
        )}
        <div className="pmedia__bar">
          <button className="round-btn round-btn--glass" type="button" onClick={onClose} aria-label="Cerrar">
            <CloseIcon />
          </button>
          <button
            className={`round-btn round-btn--glass ${isFav ? 'is-fav' : ''}`}
            type="button"
            onClick={onToggleFav}
            aria-pressed={isFav}
            aria-label={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
          >
            <HeartIcon filled={isFav} />
          </button>
        </div>
        {item.tag && <span className="pmedia__tag">✦ {item.tag}</span>}
      </div>

      <div className="pbody">
        <p className="pbody__cat">{item.categoryName}</p>
        <h3 className="pbody__name" id="sheetName">
          {item.name}
        </h3>
        {item.desc && <p className="pbody__desc">{item.desc}</p>}
        {item.note && (
          <p className="pbody__note">
            <span aria-hidden="true">✦</span> {item.note}
          </p>
        )}

        {item.hasSizes && (
          <fieldset className="group">
            <legend className="group__head">
              <span className="group__label">Tamaño</span>
              <span className="pill-tag is-done">Elige uno</span>
            </legend>
            <div className="sizes">
              {item.variants.map((v, i) => (
                <button key={v.label} type="button" aria-pressed={i === vi} onClick={() => setVi(i)}>
                  {v.label}
                  <small>{money(v.price)}</small>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {item.options.map((g) => {
          const chosen = opts[g.id] ?? [];
          const { done } = groupStatus(g, chosen);
          const multi = g.max > 1;
          return (
            <fieldset
              key={g.id}
              ref={(el) => (groupRefs.current[g.id] = el)}
              className={`group ${flash === g.id ? 'is-flash' : ''}`}
              onAnimationEnd={() => setFlash(null)}
            >
              <legend className="group__head">
                <span className="group__label">{g.label}</span>
                <span className={`pill-tag ${done ? 'is-done' : ''}`}>{done ? '✓ Listo' : 'Obligatorio'}</span>
              </legend>
              <p className="group__hint">{groupHint(g)}</p>
              <div className="choices">
                {g.choices.map((c) => {
                  const on = chosen.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role={multi ? 'checkbox' : 'radio'}
                      aria-checked={on}
                      className={`choice ${on ? 'is-on' : ''} ${c.weight && c.weight > 1 ? 'choice--wide' : ''}`}
                      onClick={() => setOpts((o) => ({ ...o, [g.id]: toggleChoice(g, o[g.id] ?? [], c.id) }))}
                    >
                      <span className={`choice__mark ${multi ? 'is-box' : ''}`} aria-hidden="true" />
                      {c.label}
                      {c.price ? <small>+{money(c.price)}</small> : null}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}

        {item.extras && EXTRAS.length > 0 && (
          <fieldset className="group">
            <legend className="group__head">
              <span className="group__label">Agrégale</span>
              <span className="pill-tag">Opcional</span>
            </legend>
            <div className="extras">
              {EXTRAS.map((x) => {
                const on = extras.includes(x.id);
                return (
                  <button
                    key={x.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    className={`extra ${on ? 'is-on' : ''}`}
                    onClick={() => setExtras((e) => (on ? e.filter((id) => id !== x.id) : [...e, x.id]))}
                  >
                    <span className="extra__icon" aria-hidden="true">
                      {on ? '✓' : x.icon}
                    </span>
                    <span className="extra__name">{x.name}</span>
                    <span className="extra__price">+{money(x.variants[0].price)}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <div className="group">
          <label className="group__label" htmlFor="itemNote">
            ¿Alguna indicación?
          </label>
          <textarea
            id="itemNote"
            className="field"
            rows={2}
            maxLength={140}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej: bien dorado, sin ensalada, salsas aparte…"
          />
        </div>
      </div>

      <div className="pfoot">
        <div className="stepper" role="group" aria-label="Cantidad">
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Quitar uno">
            −
          </button>
          <output aria-live="polite">{qty}</output>
          <button type="button" onClick={() => setQty((q) => Math.min(99, q + 1))} disabled={qty >= 99} aria-label="Agregar uno">
            +
          </button>
        </div>
        <button className={`btn btn--red btn--add ${missing.length ? 'is-pending' : ''}`} type="button" onClick={submit}>
          {missing.length ? (
            <span>Elige {missing.map((g) => g.label.toLowerCase()).join(' y ')}</span>
          ) : (
            <>
              <span>Agregar</span>
              <span className="btn--add__price">{money(unit * qty)}</span>
            </>
          )}
        </button>
      </div>
    </>
  );
}
