import { useCatalog, type Hours } from '../data/catalog';

const DAY = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function Footer() {
  const { settings } = useCatalog();
  const { address, phone, hours } = settings;
  return (
    <footer className="footer">
      <div className="wrap footer__inner">
        <img className="footer__logo" src="/img/logo.png" alt="Rokoko" width={110} height={110} />
        <div className="footer__brand">
          <p className="footer__title">{settings.name}</p>
          <p className="footer__claim">{settings.claim}</p>
          <p>Pollo al horno, frito y broaster · arroces · comidas rápidas.</p>
        </div>
        {(address || phone || hours) && (
          <div className="footer__info">
            {address && <p>📍 {address}</p>}
            {phone && <p>📞 {phone}</p>}
            {hours && <HoursList hours={hours} />}
          </div>
        )}
      </div>
      <p className="wrap footer__fine">
        Precios en pesos colombianos (COP). Sujetos a cambio sin previo aviso. ·{' '}
        <a href="/admin" className="footer__admin">
          Administrar
        </a>
      </p>
    </footer>
  );
}

function HoursList({ hours }: { hours: Hours }) {
  return (
    <ul className="footer__hours">
      {[1, 2, 3, 4, 5, 6, 0].map((d) => {
        const h = hours[d];
        return (
          <li key={d}>
            <span>{DAY[d]}</span>
            <span>{h ? `${h[0]} – ${h[1]}` : 'Cerrado'}</span>
          </li>
        );
      })}
    </ul>
  );
}
