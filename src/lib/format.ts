export const money = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

/** Minúsculas y sin tildes, para buscar "pequena" y encontrar "pequeña". */
export const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Código corto de pedido, p. ej. RK-7Q3F. */
export function orderCode() {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < 4; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `RK-${s}`;
}

/** Solo dígitos de un texto de dinero: "50.000" → 50000. */
export const parseMoney = (s: string) => Number(s.replace(/\D/g, '')) || 0;
