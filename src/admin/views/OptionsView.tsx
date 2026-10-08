import { useMemo, useState } from 'react';
import type { OptionGroupRow } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';
import { move, useAdminData, type AdminData } from '../data';
import { ConfirmButton, Drawer, Empty, Field, Toggle, cop, errText, toast } from '../ui';

export function OptionsView() {
  const { data, loading, reload } = useAdminData();
  const [editing, setEditing] = useState<OptionGroupRow | 'new' | null>(null);

  const groups = useMemo(() => [...(data?.groups ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'es')), [data]);

  if (loading) return <section className="a-view"><p className="a-muted">Cargando opciones…</p></section>;
  if (!data) return null;

  const usedBy = (gid: number) => data.productGroups.filter((pg) => pg.group_id === gid).map((pg) => data.products.find((p) => p.id === pg.product_id)?.name).filter(Boolean) as string[];

  return (
    <section className="a-view">
      <header className="a-view__head">
        <div>
          <h1>Opciones</h1>
          <p className="a-muted">Lo que el cliente elige dentro de un plato: papa, tipo de arroz, proteínas, bebida del combo…</p>
        </div>
        <button type="button" className="a-btn a-btn--primary" onClick={() => setEditing('new')}>
          ＋ Nuevo grupo
        </button>
      </header>

      {groups.length === 0 ? (
        <Empty icon="🧩" title="Aún no hay opciones" />
      ) : (
        <ul className="a-groups">
          {groups.map((g) => {
            const ch = data.choices.filter((c) => c.group_id === g.id).sort((a, b) => a.sort - b.sort);
            const used = usedBy(g.id);
            return (
              <li key={g.id}>
                <button type="button" className="a-card a-group" onClick={() => setEditing(g)}>
                  <span className="a-group__head">
                    <strong>{g.name}</strong>
                    <span className="a-tag">{g.min_select === g.max_select ? `Elige ${g.max_select}` : `Elige ${g.min_select}–${g.max_select}`}</span>
                  </span>
                  <span className="a-group__choices">
                    {ch.map((c) => (
                      <span key={c.id} className={`a-chip ${!c.active ? 'is-off' : ''}`}>
                        {c.label}
                        {c.price > 0 && ` +${cop(c.price)}`}
                        {c.weight > 1 && ` (×${c.weight})`}
                      </span>
                    ))}
                  </span>
                  <span className="a-muted a-small">{used.length ? `En ${used.length} plato${used.length === 1 ? '' : 's'}: ${used.slice(0, 4).join(', ')}${used.length > 4 ? '…' : ''}` : 'No está en ningún plato'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <GroupEditor
          data={data}
          group={editing === 'new' ? null : editing}
          usedBy={editing === 'new' ? [] : usedBy(editing.id)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
    </section>
  );
}

type ChoiceDraft = { id?: number; label: string; price: string; weight: number; active: boolean };

function GroupEditor({ data, group, usedBy, onClose, onSaved }: { data: AdminData; group: OptionGroupRow | null; usedBy: string[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(group?.name ?? '');
  const [label, setLabel] = useState(group?.label ?? '');
  const [hint, setHint] = useState(group?.hint ?? '');
  const [min, setMin] = useState(group?.min_select ?? 1);
  const [max, setMax] = useState(group?.max_select ?? 1);
  const [choices, setChoices] = useState<ChoiceDraft[]>(
    group
      ? data.choices
          .filter((c) => c.group_id === group.id)
          .sort((a, b) => a.sort - b.sort)
          .map((c) => ({ id: c.id, label: c.label, price: String(c.price || ''), weight: c.weight, active: c.active }))
      : [{ label: '', price: '', weight: 1, active: true }, { label: '', price: '', weight: 1, active: true }],
  );
  const [busy, setBusy] = useState(false);

  const setChoice = (i: number, p: Partial<ChoiceDraft>) => setChoices((cs) => cs.map((c, j) => (j === i ? { ...c, ...p } : c)));

  const save = async () => {
    if (!label.trim()) return toast('Escribe cómo lo ve el cliente (ej: Papa).', 'error');
    const clean = choices.filter((c) => c.label.trim());
    if (clean.length < 1) return toast('Agrega al menos una opción.', 'error');
    if (max < Math.max(min, 1)) return toast('El máximo debe ser mayor o igual al mínimo.', 'error');
    setBusy(true);
    try {
      const row = { name: name.trim() || label.trim(), label: label.trim(), hint: hint.trim() || null, min_select: min, max_select: Math.max(max, 1) };
      let gid = group?.id;
      if (group) {
        const { error } = await supabase!.from('option_groups').update(row).eq('id', group.id);
        if (error) throw error;
      } else {
        const { data: ins, error } = await supabase!.from('option_groups').insert(row).select('id').single();
        if (error) throw error;
        gid = ins.id;
      }
      const keep = clean.filter((c) => c.id).map((c) => c.id!);
      const removed = data.choices.filter((c) => c.group_id === gid && !keep.includes(c.id)).map((c) => c.id);
      if (removed.length) {
        const { error } = await supabase!.from('option_choices').delete().in('id', removed);
        if (error) throw error;
      }
      for (const [i, c] of clean.entries()) {
        const crow = { label: c.label.trim(), price: Number(c.price.replace(/\D/g, '')) || 0, weight: Math.max(1, c.weight), active: c.active, sort: i };
        const { error } = c.id
          ? await supabase!.from('option_choices').update(crow).eq('id', c.id)
          : await supabase!.from('option_choices').insert({ ...crow, group_id: gid! });
        if (error) throw error;
      }
      toast('Opciones guardadas');
      onSaved();
    } catch (e) {
      toast(errText(e as Error), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const { error } = await supabase!.from('option_groups').delete().eq('id', group!.id);
    if (error) return toast(errText(error), 'error');
    toast('Grupo eliminado');
    onSaved();
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={group ? `Editar: ${group.label}` : 'Nuevo grupo de opciones'}
      footer={
        <div className="a-row a-row--end">
          {group && (
            <ConfirmButton onConfirm={remove} confirmLabel={usedBy.length ? `¿Quitarlo de ${usedBy.length} platos y eliminar?` : '¿Eliminar?'}>
              Eliminar
            </ConfirmButton>
          )}
          <button type="button" className="a-btn a-btn--primary" onClick={save} disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      }
    >
      <div className="a-form-grid">
        <Field label="Lo que ve el cliente" hint="Ej: Papa, Tipo de arroz">
          <input className="a-input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} />
        </Field>
        <Field label="Nombre interno" hint="Para distinguir grupos parecidos aquí en el panel">
          <input className="a-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={label ? `${label} (…)` : ''} />
        </Field>
      </div>
      <Field label="Ayuda para el cliente (opcional)" hint="Ej: Elige 2 individuales, o una especial">
        <input className="a-input" value={hint} onChange={(e) => setHint(e.target.value)} />
      </Field>
      <div className="a-form-grid">
        <Field label="Mínimo a elegir" hint="0 = opcional">
          <input className="a-input" type="number" min={0} max={10} value={min} onChange={(e) => setMin(Math.max(0, Number(e.target.value)))} />
        </Field>
        <Field label="Máximo a elegir">
          <input className="a-input" type="number" min={1} max={10} value={max} onChange={(e) => setMax(Math.max(1, Number(e.target.value)))} />
        </Field>
      </div>

      <h3 className="a-h3">Opciones</h3>
      <p className="a-muted a-small">“Cupos” sirve para casos como el Pa’2: ¼ de pollo ocupa 2 cupos (cuenta como dos proteínas).</p>
      <ul className="a-choices">
        {choices.map((c, i) => (
          <li key={c.id ?? `n${i}`} className={!c.active ? 'is-off' : ''}>
            <input className="a-input" placeholder="Ej: Criolla" value={c.label} onChange={(e) => setChoice(i, { label: e.target.value })} aria-label="Opción" />
            <span className="a-money" title="Costo extra">
              <span aria-hidden="true">+$</span>
              <input className="a-input" inputMode="numeric" placeholder="0" value={c.price ? Number(c.price).toLocaleString('es-CO') : ''} onChange={(e) => setChoice(i, { price: e.target.value.replace(/\D/g, '') })} aria-label="Costo extra" />
            </span>
            <label className="a-weight" title="Cupos que ocupa">
              <span className="sr-only">Cupos</span>
              <select className="a-input" value={c.weight} onChange={(e) => setChoice(i, { weight: Number(e.target.value) })}>
                {[1, 2, 3].map((w) => (
                  <option key={w} value={w}>
                    {w} cupo{w > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </label>
            <Toggle checked={c.active} onChange={(v) => setChoice(i, { active: v })} label={c.active ? 'Disponible' : 'Agotada'} />
            <span className="a-choices__tools">
              <button type="button" className="a-icon-btn" onClick={() => setChoices((cs) => move(cs, i, -1))} disabled={i === 0} aria-label="Subir">↑</button>
              <button type="button" className="a-icon-btn" onClick={() => setChoices((cs) => cs.filter((_, j) => j !== i))} aria-label="Quitar">✕</button>
            </span>
          </li>
        ))}
      </ul>
      <button type="button" className="a-btn a-btn--sm" onClick={() => setChoices((cs) => [...cs, { label: '', price: '', weight: 1, active: true }])}>
        ＋ Agregar opción
      </button>
      {usedBy.length > 0 && <p className="a-muted a-small">Se usa en: {usedBy.join(', ')}.</p>}
    </Drawer>
  );
}
