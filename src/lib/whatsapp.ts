import type { CartLine } from '../hooks/useCart';
import type { Item } from '../data/menu';
import { money, parseMoney } from './format';
import { describe } from './order';

export type DeliveryMode = 'domicilio' | 'recoger' | 'local';

export type Checkout = {
  mode: DeliveryMode;
  name: string;
  phone: string;
  address: string;
  barrio: string;
  reference: string;
  table: string;
  payment: string;
  cashWith: string;
  when: 'ya' | 'programar';
  time: string;
  note: string;
};

export const EMPTY_CHECKOUT: Checkout = {
  mode: 'domicilio',
  name: '',
  phone: '',
  address: '',
  barrio: '',
  reference: '',
  table: '',
  payment: 'Efectivo',
  cashWith: '',
  when: 'ya',
  time: '',
  note: '',
};

export const MODE_LABEL: Record<DeliveryMode, string> = {
  domicilio: 'Domicilio',
  recoger: 'Recoger en el local',
  local: 'Comer en el local',
};

/** Campos obligatorios que faltan, en el orden en que aparecen en el formulario. */
export function checkoutErrors(c: Checkout, total: number): Partial<Record<keyof Checkout, string>> {
  const e: Partial<Record<keyof Checkout, string>> = {};
  if (!c.name.trim()) e.name = 'Escribe tu nombre';
  const digits = c.phone.replace(/\D/g, '');
  if (c.phone.trim() && (digits.length < 7 || digits.length > 15)) e.phone = 'Revisa el número';
  if (c.mode === 'domicilio') {
    if (!c.address.trim()) e.address = 'Escribe la dirección';
    if (!c.barrio.trim()) e.barrio = 'Escribe el barrio';
  }
  if (c.payment === 'Efectivo' && c.cashWith && parseMoney(c.cashWith) < total) {
    e.cashWith = `Debe ser al menos ${money(total)}`;
  }
  if (c.when === 'programar' && !c.time) e.time = 'Elige la hora';
  return e;
}

/** Una línea del mensaje, venga del servidor o de la carta local. */
export type TicketLine = {
  qty: number;
  name: string;
  variant: string;
  line: number;
  options: string[];
  extras: string[];
  note: string;
};

export function ticketFromCart(lines: CartLine[], byId: Record<string, Item>): TicketLine[] {
  return lines.map((l) => {
    const { options, extras } = describe(l.item, l.sel, byId);
    return { qty: l.qty, name: l.item.name, variant: l.sel.label, line: l.unit * l.qty, options, extras, note: l.sel.note };
  });
}

type ServerItem = {
  qty: number;
  name: string;
  variant: string;
  line: number;
  note: string | null;
  options: { group: string; choice: string }[];
  extras: { name: string }[];
};

export function ticketFromServer(items: ServerItem[]): TicketLine[] {
  return items.map((it) => {
    const groups = new Map<string, string[]>();
    for (const o of it.options) groups.set(o.group, [...(groups.get(o.group) ?? []), o.choice]);
    return {
      qty: it.qty,
      name: it.name,
      variant: it.variant,
      line: it.line,
      options: [...groups].map(([g, cs]) => `${g}: ${cs.join(' + ')}`),
      extras: it.extras.map((x) => x.name),
      note: it.note ?? '',
    };
  });
}

const LINE = '━━━━━━━━━━━━━━';

export function buildMessage(code: string, lines: TicketLine[], total: number, c: Checkout): string {
  // Sin emojis: WhatsApp (sobre todo el de PC) los convierte en "�" al llegar por wa.me.
  // Solo se usan caracteres de texto normales (━, ×, •, tildes), que sí llegan bien.
  const out: string[] = [];
  out.push('*NUEVO PEDIDO · ROKOKO*', `Pedido: *${code}*`, LINE);

  for (const l of lines) {
    out.push(`*${l.qty}× ${l.name}*${l.variant ? ` (${l.variant})` : ''} — ${money(l.line)}`);
    l.options.forEach((o) => out.push(`   • ${o}`));
    l.extras.forEach((x) => out.push(`   + ${x}`));
    if (l.note.trim()) out.push(`   Nota: _${l.note.trim()}_`);
  }

  out.push(LINE);
  const count = lines.reduce((n, l) => n + l.qty, 0);
  out.push(`Productos: ${count}`);
  out.push(`*TOTAL: ${money(total)}*${c.mode === 'domicilio' ? ' + domicilio' : ''}`);
  out.push(LINE);

  out.push(`*Cliente:* ${c.name.trim()}`);
  if (c.phone.trim()) out.push(`*Celular:* ${c.phone.trim()}`);
  if (c.mode === 'domicilio') {
    out.push('*Entrega:* Domicilio');
    out.push(`*Dirección:* ${c.address.trim()}, ${c.barrio.trim()}`);
    if (c.reference.trim()) out.push(`*Referencia:* ${c.reference.trim()}`);
  } else if (c.mode === 'recoger') {
    out.push('*Entrega:* Paso a recogerlo');
  } else {
    out.push(`*Entrega:* Para comer en el local${c.table.trim() ? ` · Mesa ${c.table.trim()}` : ''}`);
  }

  let pay = `*Pago:* ${c.payment}`;
  if (c.payment === 'Efectivo' && parseMoney(c.cashWith) > 0) {
    const cash = parseMoney(c.cashWith);
    pay += ` · pago con ${money(cash)}`;
    if (c.mode !== 'domicilio') pay += ` (cambio ${money(cash - total)})`;
  }
  out.push(pay);
  out.push(`*Hora:* ${c.when === 'ya' ? 'Lo antes posible' : `Para las ${c.time}`}`);
  if (c.note.trim()) out.push(`*Nota:* ${c.note.trim()}`);
  if (c.mode === 'domicilio') out.push('', '_Valor del domicilio: por confirmar_');

  return out.join('\n');
}

export const whatsappUrl = (number: string, text: string) =>
  `https://wa.me/${number.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

/** Abre WhatsApp. Si el navegador bloquea la ventana nueva, navega en la misma pestaña. */
export function openWhatsApp(url: string) {
  const w = window.open(url, '_blank');
  if (w) {
    try {
      w.opener = null;
    } catch {
      /* algunos navegadores no lo permiten; no pasa nada */
    }
  } else {
    window.location.href = url;
  }
}
