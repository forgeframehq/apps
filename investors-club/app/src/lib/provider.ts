// Talks to the market data providers. Shared by the app (when it fetches prices itself) and the class server.
// Keep this file free of React Native imports: the server bundles it too.
//   Finnhub      - current price and the markers. Free key: 60 requests a minute.
//   Twelve Data  - daily price history for the graphs. Free key: 8 requests a minute, 800 a day.
// Both free plans are for personal use. Selling this to schools needs a paid data licence (see the README).
import type { HistoryPoint, Markers, Quote } from './types';

/** Fetches a URL and returns its JSON, or throws an Error with a sentence a user can read. */
export type GetJson = (url: string) => Promise<any>;

const FINNHUB = 'https://finnhub.io/api/v1';
const TWELVE = 'https://api.twelvedata.com';
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

export async function finnhubQuote(get: GetJson, key: string, symbol: string): Promise<Quote | null> {
  const j = await get(`${FINNHUB}/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(key)}`);
  const price = num(j?.c);
  if (!price) return null; // Finnhub answers 0 for a symbol it does not know
  return { price, prev: num(j.pc) || price, at: Date.now() };
}

export async function finnhubMarkers(get: GetJson, key: string, symbol: string): Promise<Markers> {
  const j = await get(`${FINNHUB}/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${encodeURIComponent(key)}`);
  const m = (j?.metric ?? {}) as Record<string, unknown>;
  const first = (...names: string[]) => names.map((n) => num(m[n])).find((v) => v !== undefined);
  const out: Markers = { at: Date.now() };
  const set = <K extends keyof Markers>(k: K, v: number | undefined) => { if (v !== undefined) out[k] = v; };
  set('cap', first('marketCapitalization'));
  set('pe', first('peTTM', 'peBasicExclExtraTTM', 'peExclExtraTTM', 'peNormalizedAnnual', 'peAnnual'));
  set('div', first('dividendYieldIndicatedAnnual', 'currentDividendYieldTTM'));
  set('beta', first('beta'));
  set('hi', first('52WeekHigh'));
  set('lo', first('52WeekLow'));
  set('yr', first('52WeekPriceReturnDaily'));
  set('growth', first('revenueGrowthTTMYoy', 'revenueGrowthQuarterlyYoy'));
  return out;
}

/** About a year of daily closing prices, oldest first. */
export async function twelveHistory(get: GetJson, key: string, symbol: string): Promise<HistoryPoint[]> {
  const j = await get(`${TWELVE}/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=260&apikey=${encodeURIComponent(key)}`);
  if (j?.status === 'error') throw new Error(j.code === 429 ? 'The graph service is busy. Try again in a minute.' : String(j.message || 'No graph data for this stock.'));
  const values = Array.isArray(j?.values) ? j.values : [];
  const points: HistoryPoint[] = [];
  for (const v of values) {
    const c = Number(v?.close);
    const d = String(v?.datetime ?? '').slice(0, 10);
    if (d && Number.isFinite(c) && c > 0) points.push({ d, c });
  }
  return points.reverse();
}

/** True during US trading hours (9:30 am to 4 pm New York time, Monday to Friday). Does not know about holidays. */
export function marketOpen(now = new Date()): boolean {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const day = get('weekday');
    const minutes = (Number(get('hour')) % 24) * 60 + Number(get('minute'));
    return day !== 'Sat' && day !== 'Sun' && minutes >= 570 && minutes < 960;
  } catch {
    const day = now.getUTCDay();
    const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    return day >= 1 && day <= 5 && minutes >= 870 && minutes < 1260; // winter hours; an hour out in summer
  }
}
