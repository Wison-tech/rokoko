import { useCatalog } from '../data/catalog';
import { money } from '../lib/format';
import { ArrowDownIcon } from './Icons';

export function Hero({ onParty }: { onParty: () => void }) {
  const { items, settings } = useCatalog();
  const cheapest = Math.min(...items.flatMap((i) => i.variants.map((v) => v.price)));
  return (
    <section className="hero" aria-labelledby="heroTitle">
      <div className="hero__inner wrap">
        <div className="hero__art">
          <div className="hero__photo">
            <img src="/img/pollo.jpg" alt="Pierna de pollo frito crocante" width={677} height={461} />
          </div>
          <span className="hero__sticker" aria-hidden="true">
            <small>desde</small>
            {money(cheapest)}
          </span>
        </div>

        <div className="hero__panel">
          <img className="hero__logo" src="/img/logo.png" alt="" width={140} height={140} />
          <h1 className="hero__title" id="heroTitle">
            <span className="hero__big">Pollos</span>
            <span className="hero__sub">Al horno, frito y broaster</span>
            <span className="hero__claim">{settings.claim}</span>
          </h1>
          <p className="hero__lead">
            Arma tu pedido como te gusta —horno o frito, chino o paisa, con la proteína que quieras— y envíalo directo
            por WhatsApp.
          </p>
          <div className="hero__ctas">
            <a className="btn btn--red" href="#menu">
              Ver la carta <ArrowDownIcon />
            </a>
            <button className="btn btn--ghost" type="button" onClick={onParty}>
              ¿Para cuántos es?
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
