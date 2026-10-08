import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// El panel se descarga aparte: los clientes nunca bajan su código.
const AdminApp = lazy(() => import('./admin/AdminApp'));
const isAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdmin ? (
      <Suspense fallback={<div className="a-boot">Cargando panel…</div>}>
        <AdminApp />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);

// Solo en producción y fuera del panel: en desarrollo el caché estorbaría al editar.
if (import.meta.env.PROD && !isAdmin && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
