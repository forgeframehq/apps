import type { Unit } from './types';

export const KG_PER_LB = 0.45359237;
export const toKg = (w: number, unit: Unit) => (unit === 'lb' ? w * KG_PER_LB : w);
export const fromKg = (kg: number, unit: Unit) => (unit === 'lb' ? kg / KG_PER_LB : kg);

export function trimNum(v: number, decimals = 2): string {
  const p = 10 ** decimals;
  return String(Math.round(v * p) / p);
}
/** 83.9146 kg -> "185" when the unit is lb. */
export const fmtWeight = (kg: number, unit: Unit) => trimNum(fromKg(kg, unit));
export const thousands = (n: number) => Math.round(n).toLocaleString('en-US');
export const fmtVolume = (kg: number, unit: Unit) => `${thousands(fromKg(kg, unit))} ${unit}`;

export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}
export function fmtMinutes(minutes: number): string {
  return minutes < 60 ? `${minutes}min` : `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function fmtDate(iso: string, withTime = false): string {
  const d = new Date(iso);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return withTime ? `${base}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : base;
}
export const fmtDay = (ms: number) => {
  const d = new Date(ms);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};
/** "Today", "Yesterday" or a short date. */
export function fmtRelative(iso: string): string {
  const d = new Date(iso);
  const day = (x: Date) => Math.floor(new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime() / 86400000);
  const diff = day(new Date()) - day(d);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
export function initials(text: string): string {
  const out = text.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? '').filter((c) => /[A-Z0-9]/.test(c)).slice(0, 2).join('');
  return out || '?';
}
export const cap = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const newId = () => Array.from({ length: 20 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
export const isoNow = (ms = Date.now()) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
