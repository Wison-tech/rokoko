import { useMemo, useState } from 'react';
import type { ProductRow } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';
import { move, uploadPhoto, type AdminData } from '../data';
import { ConfirmButton, Drawer, Field, Toggle, errText, slugify, toast } from '../ui';

type VariantDraft = { id?: number; label: string; price: string };

export function ProductEditor({
  data,
  product,
  defaultCategoryId,
  onClose,
  onSaved,
}: {
  data: AdminData;
  product: ProductRow | null;
  defaultCategoryId?: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialVariants: VariantDraft[] = product
    ? data.variants
        .filter((v) => v.product_id === product.id)
        .sort((a, b) => a.sort - b.sort)
        .map((v) => ({ id: v.id, label: v.label, price: String(v.price) }))
    : [{ label: '', price: '' }];

  const [name, setName] = useState(product?.name ?? '');
  const [categoryId, setCategoryId] = useState<number>(product?.category_id ?? defaultCategoryId ?? data.categories[0]?.id);
  const [description, setDescription] = useState(product?.description ?? '');
  const [tag, setTag] = useState(product?.tag ?? '');
  const [icon, setIcon] = useState(product?.icon ?? '');
  const [photo, setPhoto] = useState<string | null>(product?.photo_url ?? null);
  const [active, setActive] = useState(product?.active ?? true);
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [isExtra, setIsExtra] = useState(product?.is_extra ?? false);
  const [isUpsell, setIsUpsell] = useState(product?.is_upsell ?? false);
  const [showNote, setShowNote] = useState(product?.show_category_note ?? true);
  const [variants, setVariants] = useState<VariantDraft[]>(initialVariants.length ? initialVariants : [{ label: '', price: '' }]);
  const [groups, setGroups] = useState<number[]>(
    product
      ? data.productGroups.filter((g) => g.product_id === product.id).sort((a, b) => a.sort - b.sort).map((g) => g.group_id)
      : [],
  );
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const category = data.categories.find((c) => c.id === categoryId);
  const allGroups = useMemo(() => [...data.groups].sort((a, b) => a.name.localeCompare(b.name, 'es')), [data.groups]);
  const choicesOf = (gid: number) => data.choices.filter((c) => c.group_id === gid).sort((a, b) => a.sort - b.sort);

  const sized = variants.length > 1 || variants[0]?.label.trim() !== '';

  const validate = (): string | null => {
    if (!name.trim()) return 'Ponle un nombre al plato.';
    if (!categoryId) return 'Elige una categoría.';
    if (!variants.length) return 'El plato necesita al menos un precio.';
    for (const v of variants) {
      const n = Number(v.price.replace(/\D/g, ''));
      if (!v.price.trim() || !Number.isFinite(n)) return 'Revisa los precios: todos deben tener valor.';
    }
    if (variants.length > 1 && variants.some((v) => !v.label.trim())) return 'Cuando hay varios tamaños, cada uno necesita nombre (ej: ¼, ½, Personal).';
    const labels = variants.map((v) => v.label.trim().toLowerCase());
    if (new Set(labels).size !== labels.length) return 'Hay dos tamaños con el mismo nombre.';
    return null;
  };

  const save = async () => {
    const problem = validate();
    if (problem) return toast(problem, 'error');
    setBusy(true);
    try {
      const row = {
        name: name.trim(),
        category_id: categoryId,
        description: description.trim() || null,
        tag: tag.trim() || null,
        icon: icon.trim() || null,
        photo_url: photo,
        active,
        featured,
        is_extra: isExtra,
        is_upsell: isUpsell,
        show_category_note: showNote,
      };
      let id = product?.id;
      if (product) {
        const { error } = await supabase!.from('products').update(row).eq('id', product.id);
        if (error) throw error;
      } else {
        let slug = slugify(name) || 'plato';
        if (data.products.some((p) => p.slug === slug)) slug = `${slug}-${Date.now().toString(36)}`;
        const sort = data.products.filter((p) => p.category_id === categoryId).length;
        const { data: ins, error } = await supabase!
          .from('products')
          .insert({ ...row, slug, sort, featured_sort: featured ? 99 : 0 })
          .select('id')
          .single();
        if (error) throw error;
        id = ins.id;
      }

      // Tamaños / precios
      const keep = variants.filter((v) => v.id).map((v) => v.id!);
      const existing = data.variants.filter((v) => v.product_id === id).map((v) => v.id);
      const removed = existing.filter((vid) => !keep.includes(vid));
      if (removed.length) {
        const { error } = await supabase!.from('product_variants').delete().in('id', removed);
        if (error) throw error;
      }
      // Etiquetas temporales para evitar choques con la restricción única al renombrar.
      for (const [i, v] of variants.entries()) {
        if (v.id) {
          const { error } = await supabase!.from('product_variants').update({ label: `__tmp_${i}_${Date.now()}` }).eq('id', v.id);
          if (error) throw error;
        }
      }
      for (const [i, v] of variants.entries()) {
        const vrow = { label: variants.length === 1 && !v.label.trim() ? '' : v.label.trim(), price: Number(v.price.replace(/\D/g, '')), sort: i };
        const { error } = v.id
          ? await supabase!.from('product_variants').update(vrow).eq('id', v.id)
          : await supabase!.from('product_variants').insert({ ...vrow, product_id: id! });
        if (error) throw error;
      }

      // Opciones
      const del = await supabase!.from('product_option_groups').delete().eq('product_id', id!);
      if (del.error) throw del.error;
      if (groups.length) {
        const { error } = await supabase!.from('product_option_groups').insert(groups.map((g, i) => ({ product_id: id!, group_id: g, sort: i })));
        if (error) throw error;
      }

      toast(product ? 'Plato actualizado' : 'Plato creado');
      onSaved();
    } catch (e) {
      toast(errText(e as Error), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const { error } = await supabase!.from('products').delete().eq('id', product!.id);
    if (error) return toast(errText(error), 'error');
    toast('Plato eliminado. Los pedidos anteriores conservan su nombre y precio.');
    onSaved();
  };

  const onPhoto = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    const url = await uploadPhoto(f, product?.slug ?? (slugify(name) || 'plato'));
    setUploading(false);
    if (url) setPhoto(url);
  };

  const setVariant = (i: number, patch: Partial<VariantDraft>) => setVariants((vs) => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  return (
    <Drawer
      open
      wide
      onClose={onClose}
      title={product ? `Editar: ${product.name}` : 'Nuevo plato'}
      footer={
        <div className="a-row a-row--end">
          {product && (
            <ConfirmButton onConfirm={remove} confirmLabel="¿Eliminar este plato para siempre?">
              Eliminar
            </ConfirmButton>
          )}
          <button type="button" className="a-btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="a-btn a-btn--primary" onClick={save} disabled={busy || uploading}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      }
    >
      <div className="a-editor">
        <div className="a-editor__photo">
          <div className="a-photo">
            {photo ? <img src={photo} alt="" /> : <span aria-hidden="true">{icon || category?.icon || '🍗'}</span>}
          </div>
          <label className="a-btn a-btn--block">
            {uploading ? 'Subiendo…' : photo ? 'Cambiar foto' : 'Subir foto'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
          </label>
          {photo && (
            <button type="button" className="a-link a-small" onClick={() => setPhoto(null)}>
              Quitar foto
            </button>
          )}
          <Field label="Ícono" hint="Se usa si no hay foto">
            <input className="a-input a-input--icon" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={8} placeholder={category?.icon} />
          </Field>
        </div>

        <div className="a-editor__main">
          <Field label="Nombre">
            <input className="a-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </Field>
          <div className="a-form-grid">
            <Field label="Categoría">
              <select className="a-input" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Etiqueta (opcional)" hint="Ej: De la casa, Para dos, Nuevo">
              <input className="a-input" value={tag} onChange={(e) => setTag(e.target.value)} maxLength={30} />
            </Field>
          </div>
          <Field label="Descripción (opcional)">
            <textarea className="a-input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>

          <h3 className="a-h3">Precios y tamaños</h3>
          <p className="a-muted a-small">Un solo precio: deja el nombre vacío. Varios tamaños: ¼ / ½ / 1 pollo, Personal / Familiar…</p>
          <ul className="a-variants">
            {variants.map((v, i) => (
              <li key={v.id ?? `n${i}`}>
                <input className="a-input" placeholder={sized ? 'Tamaño' : 'Precio único'} value={v.label} onChange={(e) => setVariant(i, { label: e.target.value })} aria-label="Nombre del tamaño" />
                <span className="a-money">
                  <span aria-hidden="true">$</span>
                  <input className="a-input" inputMode="numeric" value={v.price ? Number(v.price).toLocaleString('es-CO') : ''} onChange={(e) => setVariant(i, { price: e.target.value.replace(/\D/g, '') })} aria-label="Precio" placeholder="0" />
                </span>
                <button type="button" className="a-icon-btn" onClick={() => setVariants((vs) => move(vs, i, -1))} disabled={i === 0} aria-label="Subir">↑</button>
                <button type="button" className="a-icon-btn" onClick={() => setVariants((vs) => vs.filter((_, j) => j !== i))} disabled={variants.length === 1} aria-label="Quitar tamaño">✕</button>
              </li>
            ))}
          </ul>
          <button type="button" className="a-btn a-btn--sm" onClick={() => setVariants((vs) => [...vs, { label: '', price: '' }])}>
            ＋ Agregar tamaño
          </button>

          <h3 className="a-h3">Opciones que el cliente elige</h3>
          <p className="a-muted a-small">Papa, tipo de arroz, proteínas… Se crean y editan en la sección Opciones.</p>
          {groups.length > 0 && (
            <ol className="a-chosen">
              {groups.map((gid, i) => {
                const g = data.groups.find((x) => x.id === gid);
                if (!g) return null;
                return (
                  <li key={gid}>
                    <span>
                      <strong>{g.label}</strong> <small className="a-muted">{choicesOf(gid).map((c) => c.label).join(' / ')}</small>
                    </span>
                    <button type="button" className="a-icon-btn" onClick={() => setGroups((gs) => move(gs, i, -1))} disabled={i === 0} aria-label="Subir">↑</button>
                    <button type="button" className="a-icon-btn" onClick={() => setGroups((gs) => gs.filter((x) => x !== gid))} aria-label="Quitar">✕</button>
                  </li>
                );
              })}
            </ol>
          )}
          <details className="a-details">
            <summary>＋ Agregar opción</summary>
            <ul className="a-checks">
              {allGroups
                .filter((g) => !groups.includes(g.id))
                .map((g) => (
                  <li key={g.id}>
                    <button type="button" className="a-check" onClick={() => setGroups((gs) => [...gs, g.id])}>
                      <strong>{g.name}</strong>
                      <small>
                        {g.min_select === g.max_select ? `Elige ${g.max_select}` : `Elige de ${g.min_select} a ${g.max_select}`}
                      </small>
                    </button>
                  </li>
                ))}
            </ul>
          </details>

          <h3 className="a-h3">Dónde aparece</h3>
          <Toggle checked={active} onChange={setActive} label="Visible en la carta" hint="Apágalo si se agotó; no se borra nada" />
          <Toggle checked={featured} onChange={setFeatured} label="Recomendado" hint="Sale en “Los recomendados” al inicio" />
          <Toggle checked={isExtra} onChange={setIsExtra} label="Se ofrece como adicional" hint="Aparece en “Agrégale…” dentro de otros platos" />
          <Toggle checked={isUpsell} onChange={setIsUpsell} label="Sugerir en el pedido" hint="Aparece en “¿Le falta algo?” (solo si no tiene opciones)" />
          {category?.note && (
            <Toggle checked={showNote} onChange={setShowNote} label="Mostrar el acompañamiento de la categoría" hint={category.note} />
          )}
        </div>
      </div>
    </Drawer>
  );
}
