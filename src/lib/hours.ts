import type { Hours } from '../data/catalog';

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
export const prettyTime = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'p. m.' : 'a. m.';
  return `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''} ${suffix}`;
};

/** Estado de apertura según el horario. Devuelve null si no hay horario configurado. */
export function openStatus(hours: Hours | null, now = new Date()): { open: boolean; text: string } | null {
  if (!hours) return null;
  const day = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();
  const today = hours[day];
  if (today && mins >= toMin(today[0]) && mins < toMin(today[1])) {
    return { open: true, text: `Abierto · cierra ${prettyTime(today[1])}` };
  }
  if (today && mins < toMin(today[0])) return { open: false, text: `Cerrado · abre hoy ${prettyTime(today[0])}` };
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    const h = hours[d];
    if (h) return { open: false, text: `Cerrado · abre ${i === 1 ? 'mañana' : 'el ' + DAYS[d]} ${prettyTime(h[0])}` };
  }
  return { open: false, text: 'Cerrado' };
}
