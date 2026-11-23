// Everything the app remembers lives here and is saved on the device: your practice portfolio, what you have
// learned, the last prices seen, and (if you joined one) your class. Prices themselves come from lib/market.ts.
import { useSyncExternalStore } from 'react';

import { LESSONS } from '@/data/lessons';
import { STOCKS } from '@/data/stocks';
import { TERMS } from '@/data/glossary';

import { dayKey } from './format';
import { applyTrade } from './rules';
import { readJson, writeJson } from './storage';
import { applyAccent } from './theme';
import type { ClassLink, HistoryPoint, Holding, Learned, Markers, Portfolio, Quote, Settings, Stock } from './types';

export const START_CASH = 10000;
export const newPortfolio = (start = START_CASH): Portfolio => ({ start, cash: start, holdings: [], trades: [], snapshots: [] });

export const db = {
  ready: false,
  settings: { name: '', level: 'simple', finnhubKey: '', twelveKey: '', server: '' } as Settings,
  /** Practice portfolio, kept only on this device. */
  solo: newPortfolio(),
  /** The class this device belongs to, and a copy of the portfolio the class server keeps. */
  cls: null as ClassLink | null,
  classPortfolio: null as Portfolio | null,
  watch: [] as string[],
  learned: { terms: [], lessons: {} } as Learned,
  quotes: {} as Record<string, Quote>,
  markers: {} as Record<string, Markers>,
  history: {} as Record<string, { at: number; points: HistoryPoint[] }>,
  /** State of the last price refresh, for the banner on the Market tab. */
  net: { loading: false, error: '', at: 0 },
};

const bySymbol = new Map(STOCKS.map((s) => [s.symbol, s]));
export const stock = (symbol: string): Stock => bySymbol.get(symbol) ?? { symbol, name: symbol, sector: 'Tech', about: '' };

// ---------- change notifications ----------

let version = 0;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));
export function bump() {
  version++;
  listeners.forEach((l) => l());
}
/** Re-renders the calling component whenever anything in the store changes. */
export function useStore() {
  useSyncExternalStore(subscribe, () => version, () => version);
  return db;
}

function save() {
  writeJson('data', { settings: db.settings, solo: db.solo, cls: db.cls, classPortfolio: db.classPortfolio, watch: db.watch, learned: db.learned });
}
export function commit() {
  save();
  bump();
}
/** Prices are saved separately so the last known ones show straight away next time, even with no signal. */
export function saveMarket() {
  writeJson('market', { quotes: db.quotes, markers: db.markers, history: db.history });
  bump();
}

export async function load() {
  const data = await readJson<Partial<typeof db>>('data');
  if (data) {
    Object.assign(db.settings, data.settings ?? {});
    if (data.solo) db.solo = { ...newPortfolio(), ...data.solo };
    db.cls = data.cls ?? null;
    db.classPortfolio = data.classPortfolio ?? null;
    db.watch = data.watch ?? [];
    db.learned = { terms: data.learned?.terms ?? [], lessons: data.learned?.lessons ?? {} };
  }
  const market = await readJson<Pick<typeof db, 'quotes' | 'markers' | 'history'>>('market');
  if (market) {
    db.quotes = market.quotes ?? {};
    db.markers = market.markers ?? {};
    db.history = market.history ?? {};
  }
  applyAccent(db.settings.accent);
  db.ready = true;
  bump();
}

// ---------- settings ----------

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  db.settings[key] = value;
  if (key === 'accent') applyAccent(value as string);
  commit();
}

// ---------- portfolio maths ----------

/** The portfolio on screen: the class one once you have joined a class as a student, otherwise practice. */
export const inClass = () => db.cls?.role === 'student' && !!db.classPortfolio;
export const portfolio = (): Portfolio => (inClass() ? db.classPortfolio! : db.solo);

export const priceOf = (symbol: string): number | null => db.quotes[symbol]?.price ?? null;
export const holdingOf = (p: Portfolio, symbol: string): Holding | undefined => p.holdings.find((h) => h.symbol === symbol);

/** What a holding is worth now. Falls back to what was paid when no price has been seen yet. */
export const holdingValue = (h: Holding) => {
  const price = priceOf(h.symbol);
  return price === null ? h.cost : h.shares * price;
};
export const investedValue = (p: Portfolio) => p.holdings.reduce((sum, h) => sum + holdingValue(h), 0);
export const totalValue = (p: Portfolio) => p.cash + investedValue(p);
export const gainPct = (p: Portfolio) => (p.start ? ((totalValue(p) - p.start) / p.start) * 100 : 0);
export const dayChangePct = (q: Quote | undefined) => (q && q.prev ? ((q.price - q.prev) / q.prev) * 100 : 0);

/** Records a practice trade on this device. Returns an error sentence, or '' when it went through. */
export function tradeSolo(symbol: string, side: 'buy' | 'sell', shares: number, price: number): string {
  const next = applyTrade(db.solo, symbol, side, shares, price);
  if (typeof next === 'string') return next;
  db.solo = next;
  snapshot();
  commit();
  return '';
}

/** Notes today's total value so the portfolio graph has one point per day. */
export function snapshot() {
  for (const p of inClass() ? [db.solo, db.classPortfolio!] : [db.solo]) {
    if (p.holdings.some((h) => priceOf(h.symbol) === null)) continue; // wait until every holding has a price
    const d = dayKey();
    const v = Math.round(totalValue(p) * 100) / 100;
    const last = p.snapshots[p.snapshots.length - 1];
    if (last?.d === d) last.v = v;
    else p.snapshots.push({ d, v });
    if (p.snapshots.length > 400) p.snapshots.splice(0, p.snapshots.length - 400);
  }
}

export function resetSolo() {
  db.solo = newPortfolio();
  commit();
}

export function toggleWatch(symbol: string) {
  db.watch = db.watch.includes(symbol) ? db.watch.filter((s) => s !== symbol) : [...db.watch, symbol];
  commit();
}

// ---------- class ----------

/** Replaces the local copy of the class portfolio with what the server says, keeping the daily graph points. */
export function setClassPortfolio(server: Omit<Portfolio, 'snapshots'>) {
  db.classPortfolio = { ...server, snapshots: db.classPortfolio?.snapshots ?? [] };
  snapshot();
  commit();
}
export function setClass(link: ClassLink | null) {
  db.cls = link;
  if (!link || link.role !== 'student') db.classPortfolio = null;
  commit();
}

// ---------- learning, badges and levels ----------

export function markTerm(id: string) {
  if (db.learned.terms.includes(id)) return;
  db.learned.terms.push(id);
  commit();
}
export function finishLesson(id: string, score: number) {
  db.learned.lessons[id] = Math.max(score, db.learned.lessons[id] ?? 0);
  commit();
}

export interface Badge { id: string; title: string; how: string; icon: string; earned: boolean }

/** Badges reward learning and sensible habits. None of them rewards trading often. */
export function badges(): Badge[] {
  const p = portfolio();
  const sectors = new Set(p.holdings.map((h) => stock(h.symbol).sector));
  const lessonsDone = LESSONS.filter((l) => (db.learned.lessons[l.id] ?? 0) >= l.quiz.length).length;
  const oldestHeld = p.holdings.length
    ? Math.min(...p.holdings.map((h) => {
        const buys = p.trades.filter((t) => t.symbol === h.symbol && t.side === 'buy');
        return buys.length ? new Date(buys[buys.length - 1].at).getTime() : Date.now();
      }))
    : Date.now();
  const b = (id: string, title: string, how: string, icon: string, earned: boolean): Badge => ({ id, title, how, icon, earned });
  return [
    b('first-trade', 'First Trade', 'Buy your first stock', 'rocket-outline', p.trades.length > 0),
    b('first-lesson', 'Quick Learner', 'Pass a lesson quiz with full marks', 'school-outline', lessonsDone >= 1),
    b('word-10', 'Word Collector', 'Read 10 words in the glossary', 'book-outline', db.learned.terms.length >= 10),
    b('three-baskets', 'Three Baskets', 'Own stocks from 3 different groups', 'grid-outline', sectors.size >= 3),
    b('five-companies', 'Team Builder', 'Own 5 different stocks', 'people-outline', p.holdings.length >= 5),
    b('fund', 'Whole Market', 'Own a fund', 'globe-outline', p.holdings.some((h) => stock(h.symbol).sector === 'Funds')),
    b('local', 'Island Investor', 'Own a Bermuda company', 'boat-outline', p.holdings.some((h) => stock(h.symbol).sector === 'Bermuda')),
    b('green', 'In the Green', 'Have your portfolio worth more than you started with', 'trending-up-outline', p.trades.length > 0 && totalValue(p) > p.start),
    b('patient', 'Patient Investor', 'Hold a stock for 30 days', 'hourglass-outline', p.holdings.length > 0 && Date.now() - oldestHeld >= 30 * 86400000),
    b('word-all', 'Dictionary', 'Read every word in the glossary', 'library-outline', db.learned.terms.length >= TERMS.length),
    b('graduate', 'Graduate', 'Pass every lesson quiz with full marks', 'ribbon-outline', lessonsDone >= LESSONS.length),
  ];
}

const LEVELS = ['Rookie', 'Saver', 'Analyst', 'Strategist', 'Fund Manager', 'Tycoon'];
/** Investor level from points: 10 per word read, 50 per lesson passed, 100 per badge. */
export function level() {
  const lessonsDone = LESSONS.filter((l) => (db.learned.lessons[l.id] ?? 0) >= l.quiz.length).length;
  const points = db.learned.terms.length * 10 + lessonsDone * 50 + badges().filter((x) => x.earned).length * 100;
  const steps = [0, 150, 400, 800, 1300, 1900];
  let i = 0;
  while (i < steps.length - 1 && points >= steps[i + 1]) i++;
  const next = steps[i + 1] ?? null;
  return { name: LEVELS[i], number: i + 1, points, next, progress: next ? (points - steps[i]) / (next - steps[i]) : 1 };
}
