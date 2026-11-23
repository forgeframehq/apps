const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const group = (n: string) => n.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** 1234.5 -> "$1,234.50". Whole dollars only when `cents` is false. */
export function money(v: number, cents = true): string {
  const neg = v < 0;
  const abs = Math.abs(v);
  const text = cents ? abs.toFixed(2) : String(Math.round(abs));
  const [whole, frac] = text.split('.');
  return `${neg ? '-' : ''}$${group(whole)}${frac ? `.${frac}` : ''}`;
}
/** Short axis label: $950, $1.2k, $15k. */
export function moneyShort(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 10000) return `$${Math.round(v / 1000)}k`;
  if (abs >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return abs >= 100 ? `$${Math.round(v)}` : `$${v.toFixed(abs >= 10 ? 1 : 2)}`;
}
export function signedMoney(v: number): string {
  const c = Math.round(v * 100) / 100;
  return c === 0 ? money(0) : `${c > 0 ? '+' : '-'}${money(Math.abs(c))}`;
}
export const pct = (v: number) => `${v >= 0 ? '+' : '-'}${Math.abs(v).toFixed(2)}%`;

/** Up to 4 decimals with no trailing zeros: 2, 0.5, 1.2346. */
export function trimNum(v: number, decimals = 4): string {
  const p = 10 ** decimals;
  return String(Math.round(v * p) / p);
}
export const fmtShares = (n: number) => `${trimNum(n)} ${Math.abs(n - 1) < 1e-9 ? 'share' : 'shares'}`;

export function fmtDate(iso: string, withTime = false): string {
  const d = new Date(iso);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return withTime ? `${base}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : base;
}
/** "2026-11-23" -> "Nov 23". */
export function fmtDayKey(key: string): string {
  const [, m, d] = key.split('-').map(Number);
  return `${MONTHS[(m || 1) - 1]} ${d}`;
}
/** Today's date on this device as YYYY-MM-DD. */
export function dayKey(ms = Date.now()): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function ago(ms: number): string {
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

export function initials(text: string): string {
  const out = text.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? '').filter((c) => /[A-Z0-9]/.test(c)).slice(0, 2).join('');
  return out || '?';
}
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const newId = () => Array.from({ length: 20 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
export const isoNow = (ms = Date.now()) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
/** Reads a number a child typed: "1,000", "$50", " 2.5 ". Returns NaN if it is not a number. */
export const parseNum = (text: string) => (text.trim() ? Number(text.replace(/[$,\s]/g, '')) : NaN);
