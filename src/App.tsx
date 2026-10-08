import { useCallback, useEffect, useRef, useState } from 'react';
import { CartBar } from './components/CartBar';
import { CartSheet } from './components/CartSheet';
import { Featured } from './components/Featured';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { LastOrder } from './components/LastOrder';
import { Menu } from './components/Menu';
import { PartyPicker } from './components/PartyPicker';
import { ProductSheet } from './components/ProductSheet';
import { CatalogContext, useCatalogLoader, type Catalog } from './data/catalog';
import type { Item } from './data/menu';
import { useCart, useFavorites, type PastOrder } from './hooks/useCart';
import { useOrderTracking } from './hooks/useOrderTracking';
import type { Selection } from './lib/order';

type Toast = { id: number; message: string; action?: { label: string; run: () => void } };

export default function App() {
  const { catalog, refresh } = useCatalogLoader();
  return (
    <CatalogContext.Provider value={catalog}>
      <Storefront catalog={catalog} refreshCatalog={refresh} />
    </CatalogContext.Provider>
  );
}

function Storefront({ catalog, refreshCatalog }: { catalog: Catalog; refreshCatalog: () => void }) {
  const cart = useCart(catalog);
  const { favs, toggle: toggleFav, isFav } = useFavorites(catalog);
  const tracking = useOrderTracking(cart.history);
  const last = cart.history[0];
  const lastTracked = last ? tracking[last.code] : undefined;
  const lastLive = !!lastTracked && lastTracked.status !== 'entregado' && lastTracked.status !== 'cancelado';

  const [product, setProduct] = useState<{ item: Item; variant: number; openId: number } | null>(null);
  const [productOpen, setProductOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [toastOn, setToastOn] = useState(false);
  const toastTimer = useRef<number>();
  const navRef = useRef<((id: string) => void) | null>(null);

  const showToast = useCallback((message: string, action?: Toast['action']) => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, action });
    setToastOn(true);
    toastTimer.current = window.setTimeout(() => setToastOn(false), 3200);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  // Los avisos van arriba: se ocultan al abrir una hoja para no tapar sus botones.
  const openItem = useCallback((item: Item, variant = 0) => {
    setToastOn(false);
    setProduct({ item, variant, openId: Date.now() });
    setProductOpen(true);
  }, []);

  const openCart = useCallback(() => {
    setToastOn(false);
    setCartOpen(true);
  }, []);

  const add = (sel: Selection, qty: number) => {
    cart.add(sel, qty);
    setProductOpen(false);
    const item = catalog.byId[sel.id];
    showToast(`✓ ${qty} × ${item.name}${sel.label ? ` (${sel.label})` : ''}`, { label: 'Ver pedido', run: openCart });
  };

  const repeat = (order: PastOrder) => {
    const n = cart.reorder(order);
    if (n === 0) {
      showToast('Esos platos ya no están en la carta.');
      return;
    }
    openCart();
  };

  const share = async () => {
    const data = { title: 'Pollos Rokoko', text: 'Mira la carta de Pollos Rokoko 🐔', url: window.location.origin };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
      await navigator.clipboard.writeText(data.url);
      showToast('✓ Enlace copiado. ¡Compártelo!');
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') showToast(`Comparte este enlace: ${data.url}`);
    }
  };

  const goParty = () => document.getElementById('para-cuantos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <>
      <Header count={cart.count} onCart={openCart} onNav={(id) => navRef.current?.(id)} onShare={share} />
      <main>
        {/* Un pedido en curso va arriba de todo; "Pide lo de siempre" va después de la portada. */}
        {lastLive && <LastOrder order={last!} tracked={lastTracked} onRepeat={repeat} />}
        <Hero onParty={goParty} />
        {last && !lastLive && <LastOrder order={last} tracked={lastTracked} onRepeat={repeat} />}
        <Featured onOpen={openItem} />
        <PartyPicker onOpen={openItem} />
        <Menu onOpen={openItem} favs={favs} navRef={navRef} />
      </main>
      <Footer />

      <CartBar count={cart.count} total={cart.total} hidden={cartOpen || productOpen} onOpen={openCart} />

      <ProductSheet
        item={product?.item ?? null}
        variantIndex={product?.variant ?? 0}
        openId={product?.openId ?? 0}
        open={productOpen}
        onClose={() => setProductOpen(false)}
        onAdd={add}
        isFav={!!product && isFav(product.item.id)}
        onToggleFav={() => {
          if (!product) return;
          toggleFav(product.item.id);
        }}
      />
      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        lines={cart.lines}
        total={cart.total}
        history={cart.history}
        onChange={cart.change}
        onAdd={(sel, qty) => {
          cart.add(sel, qty);
          if (navigator.vibrate) navigator.vibrate(12);
        }}
        onClear={cart.clear}
        onArchive={cart.archive}
        onRepeat={repeat}
        onForget={cart.forget}
        onRefreshCatalog={refreshCatalog}
      />

      <div className={`toast ${toastOn ? 'is-on' : ''} ${cart.count > 0 && !cartOpen ? 'has-bar' : ''}`} role="status" aria-live="polite">
        {toast && (
          <>
            <span>{toast.message}</span>
            {toast.action && (
              <button
                tabIndex={toastOn ? 0 : -1}
                type="button"
                className="toast__action"
                onClick={() => {
                  toast.action!.run();
                  setToastOn(false);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
