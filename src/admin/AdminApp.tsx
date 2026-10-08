import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import './admin.css';
import { Toaster, errText } from './ui';
import { MenuView } from './views/MenuView';
import { MetricsView } from './views/MetricsView';
import { OptionsView } from './views/OptionsView';
import { OrdersView } from './views/OrdersView';
import { PromosView } from './views/PromosView';
import { SettingsView } from './views/SettingsView';
import { TeamView } from './views/TeamView';

const SECTIONS = [
  { id: 'pedidos', label: 'Pedidos', icon: '🧾' },
  { id: 'metricas', label: 'Métricas', icon: '📊' },
  { id: 'carta', label: 'Carta', icon: '🍗' },
  { id: 'opciones', label: 'Opciones', icon: '🧩' },
  { id: 'promos', label: 'Destacados', icon: '⭐' },
  { id: 'ajustes', label: 'Ajustes', icon: '⚙️' },
  { id: 'equipo', label: 'Equipo', icon: '👥' },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];

const readHash = (): SectionId => {
  const h = window.location.hash.replace('#', '');
  return (SECTIONS.find((s) => s.id === h)?.id ?? 'pedidos') as SectionId;
};

type Access = 'loading' | 'signed-out' | 'admin' | 'setup' | 'denied';

export default function AdminApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<Access>('loading');

  const check = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s || !supabase) return setAccess('signed-out');
    const { data } = await supabase.from('admins').select('user_id').eq('user_id', s.user.id).maybeSingle();
    if (data) return setAccess('admin');
    const { data: needed } = await supabase.rpc('admin_setup_needed');
    setAccess(needed ? 'setup' : 'denied');
  }, []);

  useEffect(() => {
    document.body.classList.add('admin');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0E0D0D');
    return () => document.body.classList.remove('admin');
  }, []);

  useEffect(() => {
    document.title = 'Panel · Pollos Rokoko';
    if (!supabase) return setAccess('signed-out');
    supabase.auth.getSession().then(({ data }) => check(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') void check(s);
      else setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [check]);

  if (!supabase) {
    return (
      <AuthShell>
        <p className="a-alert">Falta configurar Supabase (VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en .env.local).</p>
      </AuthShell>
    );
  }
  if (access === 'loading') return <AuthShell><p className="a-muted">Cargando…</p></AuthShell>;
  if (access === 'signed-out') return <Login />;
  if (access === 'setup') return <Setup email={session?.user.email ?? ''} onDone={() => check(session)} />;
  if (access === 'denied') return <Denied email={session?.user.email ?? ''} />;
  return <Panel email={session?.user.email ?? ''} />;
}

// ---------------------------------------------------------------------
function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="a-auth">
      <div className="a-auth__card">
        <img src="/img/logo.png" alt="" width={84} height={84} />
        <h1>Panel ROKOKO</h1>
        {children}
        <a href="/" className="a-link">
          ← Volver a la carta
        </a>
      </div>
      <Toaster />
    </div>
  );
}

function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMsg(null);
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setMsg({
          kind: 'error',
          text: error.message.includes('Email not confirmed')
            ? 'Primero confirma tu correo: revisa la bandeja de entrada (y spam).'
            : error.message.includes('Invalid login')
              ? 'Correo o contraseña incorrectos.'
              : errText(error),
        });
      }
    } else {
      if (password.length < 8) {
        setBusy(false);
        return setMsg({ kind: 'error', text: 'La contraseña debe tener al menos 8 caracteres.' });
      }
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/admin` },
      });
      if (error) setMsg({ kind: 'error', text: errText(error) });
      else if (!data.session)
        setMsg({ kind: 'ok', text: 'Cuenta creada. Te enviamos un correo para confirmarla; después vuelve aquí e inicia sesión.' });
    }
    setBusy(false);
  };

  return (
    <AuthShell>
      <div className="a-tabs" role="tablist">
        <button role="tab" aria-selected={mode === 'login'} onClick={() => setMode('login')} type="button">
          Iniciar sesión
        </button>
        <button role="tab" aria-selected={mode === 'signup'} onClick={() => setMode('signup')} type="button">
          Crear cuenta
        </button>
      </div>
      <form className="a-form" onSubmit={submit}>
        <label className="a-field">
          <span className="a-field__label">Correo</span>
          <input className="a-input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="a-field">
          <span className="a-field__label">Contraseña</span>
          <input
            className="a-input"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'signup' ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {msg && <p className={msg.kind === 'error' ? 'a-alert' : 'a-success'}>{msg.text}</p>}
        <button className="a-btn a-btn--primary a-btn--block" disabled={busy} type="submit">
          {busy ? 'Un momento…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </button>
      </form>
      {mode === 'signup' && (
        <p className="a-muted a-small">
          Una cuenta nueva no tiene permisos hasta que un administrador la agregue en <strong>Equipo</strong>. La primera cuenta del
          negocio se vuelve la administradora principal.
        </p>
      )}
    </AuthShell>
  );
}

function Setup({ email, onDone }: { email: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const claim = async () => {
    setBusy(true);
    const { error } = await supabase!.rpc('claim_first_admin');
    setBusy(false);
    if (error) setErr(errText(error));
    else onDone();
  };
  return (
    <AuthShell>
      <p>
        Bienvenido. Todavía no hay ningún administrador. ¿Quieres que <strong>{email}</strong> sea la cuenta principal de ROKOKO?
      </p>
      {err && <p className="a-alert">{err}</p>}
      <button className="a-btn a-btn--primary a-btn--block" disabled={busy} onClick={claim} type="button">
        Sí, ser el administrador principal
      </button>
      <button className="a-btn a-btn--block" type="button" onClick={() => supabase!.auth.signOut()}>
        Salir
      </button>
    </AuthShell>
  );
}

function Denied({ email }: { email: string }) {
  return (
    <AuthShell>
      <p>
        La cuenta <strong>{email}</strong> todavía no tiene permisos. Pídele al administrador que te agregue en <strong>Equipo</strong>{' '}
        con este correo.
      </p>
      <button className="a-btn a-btn--block" type="button" onClick={() => supabase!.auth.signOut()}>
        Salir
      </button>
    </AuthShell>
  );
}

// ---------------------------------------------------------------------
function Panel({ email }: { email: string }) {
  const [section, setSection] = useState<SectionId>(readHash);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const onHash = () => setSection(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Contador de pedidos pendientes en la pestaña del navegador.
  useEffect(() => {
    document.title = pending ? `(${pending}) Pedidos · Rokoko` : 'Panel · Pollos Rokoko';
  }, [pending]);

  // Menú lateral (drawer) en celular.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const isMobile = () => window.matchMedia('(max-width: 899px)').matches;

  useEffect(() => {
    if (!menuOpen) return;
    navRef.current?.querySelector<HTMLButtonElement>('button[aria-current="page"]')?.focus();
    document.documentElement.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeMenu();
    const onResize = () => !isMobile() && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.documentElement.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
    menuBtn.current?.focus();
  };

  const go = (id: SectionId) => {
    window.location.hash = id;
    window.scrollTo(0, 0);
    if (menuOpen) closeMenu();
  };

  const current = SECTIONS.find((s) => s.id === section)!;

  return (
    <div className="a-shell">
      {/* Barra superior en celular: ☰ · sección actual · pedidos pendientes */}
      <header className="a-mobilebar">
        <button
          ref={menuBtn}
          type="button"
          className="a-mobilebar__btn"
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
          aria-controls="admin-menu"
          onClick={() => setMenuOpen(true)}
        >
          <span className="a-burger" aria-hidden="true" />
        </button>
        <span className="a-mobilebar__title">
          <img src="/img/logo.png" alt="" width={30} height={30} />
          {current.label}
        </span>
        <button
          type="button"
          className="a-mobilebar__btn"
          aria-label={pending ? `Pedidos: ${pending} por confirmar` : 'Pedidos'}
          onClick={() => go('pedidos')}
        >
          <span aria-hidden="true">🧾</span>
          {pending > 0 && <span className="a-badge a-badge--float">{pending}</span>}
        </button>
      </header>

      <div className={`a-scrim ${menuOpen ? 'is-open' : ''}`} onClick={closeMenu} aria-hidden="true" />
      <aside id="admin-menu" className={`a-side ${menuOpen ? 'is-open' : ''}`} aria-label="Menú del panel">
        <button type="button" className="a-side__close" onClick={closeMenu} aria-label="Cerrar menú">
          ✕
        </button>
        <a href="/" className="a-brand" title="Ver la carta">
          <img src="/img/logo.png" alt="" width={40} height={40} />
          <span>
            <strong>Rokoko</strong>
            <small>Panel</small>
          </span>
        </a>
        <nav className="a-nav" aria-label="Secciones del panel" ref={navRef}>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={section === s.id ? 'is-on' : ''}
              aria-current={section === s.id ? 'page' : undefined}
              onClick={() => go(s.id)}
            >
              <span aria-hidden="true">{s.icon}</span>
              <span className="a-nav__label">{s.label}</span>
              {s.id === 'pedidos' && pending > 0 && <span className="a-badge">{pending}</span>}
            </button>
          ))}
        </nav>
        <div className="a-side__foot">
          <span className="a-side__email" title={email}>
            {email}
          </span>
          <button type="button" className="a-link" onClick={() => supabase!.auth.signOut()}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="a-main">
        {section === 'pedidos' && <OrdersView onPendingChange={setPending} />}
        {section === 'metricas' && <MetricsView />}
        {section === 'carta' && <MenuView />}
        {section === 'opciones' && <OptionsView />}
        {section === 'promos' && <PromosView />}
        {section === 'ajustes' && <SettingsView />}
        {section === 'equipo' && <TeamView />}
      </main>
      {/* Mientras no estás en Pedidos igual se cuentan los pendientes y suena la alerta. */}
      {section !== 'pedidos' && <OrdersView onPendingChange={setPending} background />}
      <Toaster />
    </div>
  );
}
