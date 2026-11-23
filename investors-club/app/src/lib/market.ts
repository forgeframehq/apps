// Where prices come from. In order: the class server (it shares one data key between everyone and keeps
// answers for a while), or the data providers directly using keys typed into Settings. With neither, the app
// still opens and shows the last prices it saw.
import { Platform } from 'react-native';

import { STOCKS } from '@/data/stocks';

import { finnhubMarkers, finnhubQuote, marketOpen, twelveHistory } from './provider';
import { commit, db, saveMarket, snapshot } from './store';
import type { HistoryPoint, Markers, Quote } from './types';

const BUILT_IN = (process.env.EXPO_PUBLIC_SERVER_URL ?? '').trim();
let sameOrigin = ''; // on the website: the address it was loaded from, once we know a server is there

const clean = (url: string) => url.trim().replace(/\/+$/, '');
/** The class server to use, or '' if there is none. A class you joined always uses its own server. */
export const serverUrl = () => clean(db.cls?.server || db.settings.server || BUILT_IN || sameOrigin);
export type Source = 'server' | 'direct' | 'none';
export const source = (): Source => (serverUrl() ? 'server' : db.settings.finnhubKey.trim() ? 'direct' : 'none');
export { marketOpen };

/** Fetches JSON with a time limit and turns failures into a sentence a child can read. */
export async function getJson(url: string, init?: RequestInit, ms = 12000): Promise<any> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      if (body?.error) throw new Error(String(body.error));
      if (res.status === 429) throw new Error('Too many requests just now. Try again in a minute.');
      if (res.status === 401 || res.status === 403) throw new Error('The market data key was not accepted. Check it in Settings.');
      throw new Error(`The server answered with an error (${res.status}).`);
    }
    return body;
  } catch (e) {
    if (e instanceof Error && e.name !== 'AbortError' && e.name !== 'TypeError') throw e;
    throw new Error('No connection. Check the internet and try again.');
  } finally {
    clearTimeout(timer);
  }
}

/** On the website, checks whether the address it was loaded from is a class server. */
export async function probe() {
  if (Platform.OS !== 'web' || BUILT_IN || db.settings.server) return;
  try {
    const origin = globalThis.location?.origin ?? '';
    const j = await getJson(`${origin}/api/health`, undefined, 4000);
    if (j?.ok) sameOrigin = origin;
  } catch {
    // not served by a class server; that is fine
  }
}

async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) await work(items[next++]);
  }));
}

let running: Promise<void> | null = null;
/** Brings every stock's price up to date. Skips the work if they were refreshed recently, unless `force`. */
export function refreshQuotes(force = false): Promise<void> {
  if (running) return running;
  const age = Date.now() - db.net.at;
  if (!force && db.net.at && age < (marketOpen() ? 60_000 : 10 * 60_000)) return Promise.resolve();
  const src = source();
  if (src === 'none') return Promise.resolve();
  db.net = { ...db.net, loading: true };
  running = (async () => {
    const symbols = STOCKS.map((s) => s.symbol);
    let error = '';
    try {
      if (src === 'server') {
        const j = await getJson(`${serverUrl()}/api/quotes?symbols=${symbols.join(',')}`);
        for (const [sym, q] of Object.entries((j?.quotes ?? {}) as Record<string, Quote>)) db.quotes[sym] = q;
      } else {
        const key = db.settings.finnhubKey.trim();
        let failed: Error | null = null;
        await pool(symbols, 4, async (sym) => {
          if (failed) return;
          try {
            const q = await finnhubQuote(getJson, key, sym);
            if (q) db.quotes[sym] = q;
          } catch (e) {
            failed = e as Error;
          }
        });
        if (failed) throw failed;
      }
    } catch (e) {
      error = (e as Error).message;
    }
    db.net = { loading: false, error, at: error ? db.net.at : Date.now() };
    snapshot();
    saveMarket();
    commit();
    running = null;
  })();
  return running;
}

/** The newest price for one stock, fetched now. Used just before a trade so it never uses a stale price. */
export async function freshQuote(symbol: string): Promise<Quote> {
  const src = source();
  if (src === 'none') throw new Error('Prices are not set up yet. Open Settings, then Market data.');
  let q: Quote | null;
  if (src === 'server') q = (await getJson(`${serverUrl()}/api/quotes?symbols=${symbol}`))?.quotes?.[symbol] ?? null;
  else q = await finnhubQuote(getJson, db.settings.finnhubKey.trim(), symbol);
  if (!q) throw new Error('There is no price for this stock right now.');
  db.quotes[symbol] = q;
  saveMarket();
  return q;
}

const DAY = 24 * 3600_000;

/** The markers for a stock (size, P/E, dividend...). Kept for a day. Returns null if they cannot be fetched. */
export async function loadMarkers(symbol: string): Promise<Markers | null> {
  const have = db.markers[symbol];
  if (have && Date.now() - have.at < DAY) return have;
  const src = source();
  if (src === 'none') return have ?? null;
  try {
    const m: Markers = src === 'server'
      ? (await getJson(`${serverUrl()}/api/markers?symbol=${symbol}`)).markers
      : await finnhubMarkers(getJson, db.settings.finnhubKey.trim(), symbol);
    db.markers[symbol] = { ...m, at: Date.now() };
    saveMarket();
    return db.markers[symbol];
  } catch {
    return have ?? null;
  }
}

/** A year of daily prices for the graph. Kept for half a day. Throws a readable Error if it cannot be fetched. */
export async function loadHistory(symbol: string): Promise<HistoryPoint[]> {
  const have = db.history[symbol];
  if (have && Date.now() - have.at < DAY / 2) return have.points;
  const src = source();
  const twelve = db.settings.twelveKey.trim();
  if (src !== 'server' && !twelve) {
    if (have) return have.points;
    throw new Error(src === 'none' ? 'Graphs need market data. Open Settings, then Market data.' : 'Graphs need a second free key. Open Settings, then Market data.');
  }
  try {
    const points: HistoryPoint[] = src === 'server'
      ? (await getJson(`${serverUrl()}/api/history?symbol=${symbol}`)).points
      : await twelveHistory(getJson, twelve, symbol);
    if (!points?.length) throw new Error('No graph data for this stock yet.');
    db.history[symbol] = { at: Date.now(), points };
    // Keep the saved file small: graphs for the 12 stocks looked at most recently.
    const keep = Object.entries(db.history).sort((a, b) => b[1].at - a[1].at).slice(0, 12);
    db.history = Object.fromEntries(keep);
    saveMarket();
    return points;
  } catch (e) {
    if (have) return have.points;
    throw e;
  }
}
