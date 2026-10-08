import { useMemo, useState } from 'react';
import type { CategoryRow, ProductRow } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';
import { move, saveOrder, useAdminData } from '../data';
import { ConfirmButton, Drawer, Empty, Field, Toggle, cop, errText, slugify, toast } from '../ui';
import { ProductEditor } from './ProductEditor';

export function MenuView() {
  const { data, loading, reload } = useAdminData();
  const [catId, setCatId] = useState<number | null>(null);
  const [editing, setEditing] = useState<ProductRow | 'new' | null>(null);
  const [catEdit, setCatEdit] = useState<CategoryRow | 'new' | null>(null);
  const [q, setQ] = useState('');

  const cats = useMemo(() => [...(data?.categories ?? [])].sort((a, b) => a.sort - b.sort || a.id - b.id), [data]);
  const current = cats.find((c) => c.id === catId) ?? cats[0];
  const products = useMemo(() => {
    const all = [...(data?.products ?? [])].sort((a, b) => a.sort - b.sort || a.id - b.id);
    const term = q.trim().toLowerCase();
    return term ? all.filter((p) => p.name.toLowerCase().includes(term)) : all.filter((p) => p.category_id === current?.id);
  }, [data, current, q]);

  if (loading) return <section className="a-view"><p className="a-muted">Cargando carta…</p></section>;
  if (!data) return null;

  const priceText = (p: ProductRow) => {
    const vs = data.variants.filter((v) => v.product_id === p.id).sort((a, b) => a.sort - b.sort);
    if (!vs.length) return 'Sin precio';
    if (vs.length === 1 && !vs[0].label) return cop(vs[0].price);
    return vs.map((v) => `${v.label} ${cop(v.price)}`).join(' · ');
  };

  const toggleProduct = async (p: ProductRow, active: boolean) => {
    const { error } = await supabase!.from('products').update({ active }).eq('id', p.id);
    if (error) return toast(errText(error), 'error');
    toast(active ? `${p.name} visible en la carta` : `${p.name} oculto (agotado)`);
    void reload();
  };

  const moveProduct = async (i: number, d: number) => {
    const list = move(products, i, d);
    if (list === products) return;
    await saveOrder('products', list.map((p) => p.id));
    void reload();
  };

  const moveCat = async (i: number, d: number) => {
    const list = move(cats, i, d);
    if (list === cats) return;
    await saveOrder('categories', list.map((c) => c.id));
    void reload();
  };

  return (
    <section className="a-view">
      <header className="a-view__head">
        <div>
          <h1>Carta</h1>
          <p className="a-muted">Los cambios se ven en la página al instante (los clientes los reciben al recargar).</p>
        </div>
        <button type="button" className="a-btn a-btn--primary" onClick={() => setEditing('new')}>
          ＋ Nuevo plato
        </button>
      </header>

      <div className="a-filters">
        <input className="a-input a-search" type="search" placeholder="Buscar plato en toda la carta" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar plato" />
      </div>

      <div className="a-split">
        <nav className="a-cats" aria-label="Categorías">
          {cats.map((c, i) => (
            <div key={c.id} className={`a-cat ${current?.id === c.id && !q ? 'is-on' : ''} ${!c.active ? 'is-off' : ''}`}>
              <button type="button" className="a-cat__main" onClick={() => { setCatId(c.id); setQ(''); }}>
                <span aria-hidden="true">{c.icon}</span>
                <span>{c.name}</span>
                <small>{data.products.filter((p) => p.category_id === c.id).length}</small>
              </button>
              <span className="a-cat__tools">
                <button type="button" className="a-icon-btn" onClick={() => moveCat(i, -1)} disabled={i === 0} aria-label={`Subir ${c.name}`}>↑</button>
                <button type="button" className="a-icon-btn" onClick={() => moveCat(i, 1)} disabled={i === cats.length - 1} aria-label={`Bajar ${c.name}`}>↓</button>
                <button type="button" className="a-icon-btn" onClick={() => setCatEdit(c)} aria-label={`Editar ${c.name}`}>✎</button>
              </span>
            </div>
          ))}
          <button type="button" className="a-btn a-btn--block" onClick={() => setCatEdit('new')}>
            ＋ Categoría
          </button>
        </nav>

        <div className="a-products">
          {q && <p className="a-muted">Resultados para “{q}” en toda la carta</p>}
          {current && !q && current.note && <p className="a-note">Acompañamiento de la categoría: {current.note}</p>}
          {products.length === 0 ? (
            <Empty icon="🍽️" title="No hay platos aquí">
              <button type="button" className="a-btn a-btn--primary" onClick={() => setEditing('new')}>
                ＋ Agregar el primero
              </button>
            </Empty>
          ) : (
            <ul className="a-plist">
              {products.map((p, i) => (
                <li key={p.id} className={!p.active ? 'is-off' : ''}>
                  <span className="a-plist__img">
                    {p.photo_url ? <img src={p.photo_url} alt="" loading="lazy" /> : <span aria-hidden="true">{p.icon || current?.icon}</span>}
                  </span>
                  <button type="button" className="a-plist__body" onClick={() => setEditing(p)}>
                    <strong>{p.name}</strong>
                    <span className="a-plist__price">{priceText(p)}</span>
                    <span className="a-plist__tags">
                      {!p.active && <span className="a-tag a-tag--off">Oculto</span>}
                      {p.featured && <span className="a-tag">⭐ Recomendado</span>}
                      {p.is_extra && <span className="a-tag">Adicional</span>}
                      {p.is_upsell && <span className="a-tag">“¿Le falta algo?”</span>}
                      {data.productGroups.some((g) => g.product_id === p.id) && <span className="a-tag">Personalizable</span>}
                    </span>
                  </button>
                  <span className="a-plist__tools">
                    {!q && (
                      <>
                        <button type="button" className="a-icon-btn" onClick={() => moveProduct(i, -1)} disabled={i === 0} aria-label={`Subir ${p.name}`}>↑</button>
                        <button type="button" className="a-icon-btn" onClick={() => moveProduct(i, 1)} disabled={i === products.length - 1} aria-label={`Bajar ${p.name}`}>↓</button>
                      </>
                    )}
                    <Toggle checked={p.active} onChange={(v) => toggleProduct(p, v)} label={p.active ? 'Visible' : 'Oculto'} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {editing && (
        <ProductEditor
          data={data}
          product={editing === 'new' ? null : editing}
          defaultCategoryId={current?.id ?? cats[0]?.id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
      {catEdit && (
        <CategoryEditor
          category={catEdit === 'new' ? null : catEdit}
          count={catEdit === 'new' ? 0 : data.products.filter((p) => p.category_id === catEdit.id).length}
          nextSort={cats.length}
          onClose={() => setCatEdit(null)}
          onSaved={(id) => {
            setCatEdit(null);
            if (id) setCatId(id);
            void reload();
          }}
        />
      )}
    </section>
  );
}

function CategoryEditor({ category, count, nextSort, onClose, onSaved }: { category: CategoryRow | null; count: number; nextSort: number; onClose: () => void; onSaved: (id?: number) => void }) {
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState(category?.icon ?? '🍗');
  const [note, setNote] = useState(category?.note ?? '');
  const [allowsExtras, setAllowsExtras] = useState(category?.allows_extras ?? true);
  const [active, setActive] = useState(category?.active ?? true);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast('Ponle un nombre a la categoría.', 'error');
    setBusy(true);
    const row = { name: name.trim(), icon: icon.trim() || '🍗', note: note.trim() || null, allows_extras: allowsExtras, active };
    const res = category
      ? await supabase!.from('categories').update(row).eq('id', category.id).select('id').single()
      : await supabase!.from('categories').insert({ ...row, slug: `${slugify(name) || 'categoria'}-${Date.now().toString(36)}`, sort: nextSort }).select('id').single();
    setBusy(false);
    if (res.error) return toast(errText(res.error), 'error');
    toast('Categoría guardada');
    onSaved(res.data?.id);
  };

  const remove = async () => {
    const { error } = await supabase!.from('categories').delete().eq('id', category!.id);
    if (error) return toast(errText(error), 'error');
    toast('Categoría eliminada');
    onSaved();
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={category ? `Editar ${category.name}` : 'Nueva categoría'}
      footer={
        <div className="a-row a-row--end">
          {category && (
            count === 0 ? (
              <ConfirmButton onConfirm={remove} confirmLabel="¿Eliminar categoría?">Eliminar</ConfirmButton>
            ) : (
              <span className="a-muted a-small">Para eliminarla, primero mueve o borra sus {count} platos.</span>
            )
          )}
          <button type="button" className="a-btn a-btn--primary" onClick={save} disabled={busy}>
            Guardar
          </button>
        </div>
      }
    >
      <div className="a-form-grid">
        <Field label="Nombre">
          <input className="a-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>
        <Field label="Ícono" hint="Un emoji">
          <input className="a-input a-input--icon" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={8} />
        </Field>
      </div>
      <Field label="Acompañamiento (opcional)" hint="Se muestra arriba de la categoría y dentro de cada plato. Ej: Acompañados de arroz + papa…">
        <textarea className="a-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Toggle checked={allowsExtras} onChange={setAllowsExtras} label="Permite adicionales" hint="Muestra “Agrégale…” en los platos de esta categoría" />
      <Toggle checked={active} onChange={setActive} label="Visible en la carta" />
    </Drawer>
  );
}
