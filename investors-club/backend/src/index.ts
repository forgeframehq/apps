// Investors Club class server. Three jobs:
//   1. Prices. Holds the market data keys, answers for every student from one shared copy, and refreshes it on a timer.
//   2. Classes. Join codes, student sign-in by name + PIN (no email), portfolios, trades filled at the server's price.
//   3. The website. The same deploy serves the web version of the app (see wrangler.jsonc).
// The database tables create themselves on first use, so deploying needs no database commands.
import { STOCKS } from '../../app/src/data/stocks';
import { finnhubMarkers, finnhubQuote, marketOpen, twelveHistory, type GetJson } from '../../app/src/lib/provider';
import { applyTrade, roundShares } from '../../app/src/lib/rules';
import type { HistoryPoint, Holding, Markers, Quote, Trade } from '../../app/src/lib/types';

interface Env {
  DB: D1Database;
  FINNHUB_KEY?: string;
  TWELVE_KEY?: string;
  SCHOOL_KEY?: string;
  /** Tests only: made-up prices so the end-to-end test needs no keys or network. */
  MOCK_MARKET?: string;
}

const SYMBOLS = STOCKS.map((s) => s.symbol);
const ALLOWED = new Set(SYMBOLS);
const MAX_CLASS = 60;
const DAY = 24 * 3600_000;

class Problem extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS } });

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS classes (code TEXT PRIMARY KEY, name TEXT NOT NULL, teacher TEXT NOT NULL, teacher_hash TEXT NOT NULL, start_cash REAL NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS students (id TEXT PRIMARY KEY, class_code TEXT NOT NULL, name TEXT NOT NULL, name_key TEXT NOT NULL, pin_hash TEXT, fails INTEGER NOT NULL DEFAULT 0, cash REAL NOT NULL, stamp TEXT NOT NULL DEFAULT '', removed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS students_name ON students (class_code, name_key)`,
  `CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, student_id TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS holdings (student_id TEXT NOT NULL, symbol TEXT NOT NULL, shares REAL NOT NULL, cost REAL NOT NULL, PRIMARY KEY (student_id, symbol))`,
  `CREATE TABLE IF NOT EXISTS trades (id TEXT PRIMARY KEY, student_id TEXT NOT NULL, symbol TEXT NOT NULL, side TEXT NOT NULL, shares REAL NOT NULL, price REAL NOT NULL, at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS trades_student ON trades (student_id, at)`,
  `CREATE TABLE IF NOT EXISTS quotes (symbol TEXT PRIMARY KEY, price REAL NOT NULL, prev REAL NOT NULL, at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS cache (k TEXT PRIMARY KEY, v TEXT NOT NULL, at INTEGER NOT NULL)`,
];
let ready: Promise<unknown> | null = null;
const ensure = (env: Env) => (ready ??= env.DB.batch(SCHEMA.map((sql) => env.DB.prepare(sql))).catch((e) => { ready = null; throw e; }));

// ---------- small helpers ----------

const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
function random(length: number, alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789') {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
/** Join codes avoid letters and digits that look alike (O/0, I/1). */
const joinCode = () => random(6, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
async function sha(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
const getJson: GetJson = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Problem(res.status === 429 ? 429 : 502, res.status === 429 ? 'The price service is busy. Try again in a minute.' : 'The price service did not answer.');
  return res.json();
};

// ---------- made-up market for tests ----------

function seed(text: string) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}
const mockBase = (symbol: string) => Math.round((20 + seed(symbol) * 380) * 100) / 100;
const mockQuote = (symbol: string): Quote => {
  const base = mockBase(symbol);
  return { price: Math.round(base * (1 + (seed(symbol + 'x') - 0.4) * 0.05) * 100) / 100, prev: base, at: Date.now() };
};
function mockHistory(symbol: string): HistoryPoint[] {
  const end = mockQuote(symbol).price;
  const points: HistoryPoint[] = [];
  let price = end * (0.7 + seed(symbol + 'h') * 0.4);
  for (let i = 259; i >= 0; i--) {
    price = i === 0 ? end : price + ((end - price) / (i + 1)) + (seed(symbol + i) - 0.5) * end * 0.03;
    points.push({ d: new Date(Date.now() - i * DAY).toISOString().slice(0, 10), c: Math.round(price * 100) / 100 });
  }
  return points;
}
const mockMarkers = (symbol: string): Markers => {
  const q = mockQuote(symbol);
  return { cap: Math.round(2000 + seed(symbol + 'c') * 900000), pe: Math.round(8 + seed(symbol + 'p') * 40), div: Math.round(seed(symbol + 'd') * 30) / 10, beta: Math.round((0.5 + seed(symbol + 'b') * 1.3) * 100) / 100, hi: Math.round(q.price * 1.2 * 100) / 100, lo: Math.round(q.price * 0.7 * 100) / 100, yr: Math.round((seed(symbol + 'y') - 0.35) * 60), growth: Math.round((seed(symbol + 'g') - 0.3) * 30), at: Date.now() };
};

// ---------- prices ----------

/**
 * Current prices. Stale ones are refreshed from Finnhub, but only by one request at a time: the others get the
 * copy we already have. That keeps a class of 30 opening the app at once inside the free plan's limit.
 */
async function getQuotes(env: Env, symbols: string[], opts: { single?: boolean } = {}): Promise<Record<string, Quote>> {
  const want = symbols.filter((s) => ALLOWED.has(s));
  if (env.MOCK_MARKET) return Object.fromEntries(want.map((s) => [s, mockQuote(s)]));
  const rows = (await env.DB.prepare('SELECT symbol, price, prev, at FROM quotes').all<Quote & { symbol: string }>()).results;
  const have = new Map(rows.map((r) => [r.symbol, { price: r.price, prev: r.prev, at: r.at } as Quote]));
  const ttl = marketOpen() ? 60_000 : 15 * 60_000;
  const stale = want.filter((s) => Date.now() - (have.get(s)?.at ?? 0) > ttl);
  if (stale.length && env.FINNHUB_KEY) {
    let mayFetch = !!opts.single;
    if (!mayFetch) {
      const until = Date.now() + 20_000;
      await env.DB.prepare(`INSERT OR IGNORE INTO cache (k, v, at) VALUES ('quote-lock', '', 0)`).run();
      const claim = await env.DB.prepare(`UPDATE cache SET at = ? WHERE k = 'quote-lock' AND at < ?`).bind(until, Date.now()).run();
      mayFetch = claim.meta.changes === 1;
    }
    if (mayFetch) {
      const fresh = await Promise.allSettled(stale.map(async (s) => [s, await finnhubQuote(getJson, env.FINNHUB_KEY!, s)] as const));
      const got = fresh.flatMap((r) => (r.status === 'fulfilled' && r.value[1] ? [[r.value[0], r.value[1]] as const] : []));
      for (const [s, q] of got) have.set(s, q);
      for (let i = 0; i < got.length; i += 20) {
        const part = got.slice(i, i + 20);
        await env.DB.prepare(`INSERT INTO quotes (symbol, price, prev, at) VALUES ${part.map(() => '(?,?,?,?)').join(',')} ON CONFLICT(symbol) DO UPDATE SET price = excluded.price, prev = excluded.prev, at = excluded.at`)
          .bind(...part.flatMap(([s, q]) => [s, q.price, q.prev, q.at])).run();
      }
    }
  }
  return Object.fromEntries(want.flatMap((s) => (have.has(s) ? [[s, have.get(s)!]] : [])));
}

async function cached<T>(env: Env, key: string, ttl: number, make: () => Promise<T>): Promise<T> {
  const row = await env.DB.prepare('SELECT v, at FROM cache WHERE k = ?').bind(key).first<{ v: string; at: number }>();
  if (row && Date.now() - row.at < ttl) return JSON.parse(row.v) as T;
  try {
    const value = await make();
    await env.DB.prepare('INSERT INTO cache (k, v, at) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, at = excluded.at').bind(key, JSON.stringify(value), Date.now()).run();
    return value;
  } catch (e) {
    if (row) return JSON.parse(row.v) as T; // an old answer beats no answer
    throw e;
  }
}
function getMarkers(env: Env, symbol: string): Promise<Markers> {
  if (env.MOCK_MARKET) return Promise.resolve(mockMarkers(symbol));
  if (!env.FINNHUB_KEY) throw new Problem(503, 'Prices are not set up on the class server yet.');
  return cached(env, `m:${symbol}`, DAY, () => finnhubMarkers(getJson, env.FINNHUB_KEY!, symbol));
}
function getHistory(env: Env, symbol: string): Promise<HistoryPoint[]> {
  if (env.MOCK_MARKET) return Promise.resolve(mockHistory(symbol));
  if (!env.TWELVE_KEY) throw new Problem(503, 'Graphs are not set up on the class server yet.');
  return cached(env, `h:${symbol}`, DAY / 2, async () => {
    const points = await twelveHistory(getJson, env.TWELVE_KEY!, symbol);
    if (!points.length) throw new Problem(502, 'No graph data for this stock yet.');
    return points;
  });
}

/** Timer job: refresh prices while the market is open, and top up a few of the oldest markers and graphs. */
async function warm(env: Env) {
  await ensure(env);
  if (env.FINNHUB_KEY) await getQuotes(env, SYMBOLS);
  const rows = (await env.DB.prepare('SELECT k, at FROM cache').all<{ k: string; at: number }>()).results;
  const at = new Map(rows.map((r) => [r.k, r.at]));
  const oldest = (prefix: string, ttl: number, count: number) =>
    SYMBOLS.filter((s) => Date.now() - (at.get(prefix + s) ?? 0) > ttl).sort((a, b) => (at.get(prefix + a) ?? 0) - (at.get(prefix + b) ?? 0)).slice(0, count);
  if (env.FINNHUB_KEY) await Promise.allSettled(oldest('m:', DAY, 6).map((s) => getMarkers(env, s)));
  if (env.TWELVE_KEY) for (const s of oldest('h:', DAY / 2, 4)) await getHistory(env, s).catch(() => {});
}

// ---------- classes ----------

interface ClassRow { code: string; name: string; teacher: string; teacher_hash: string; start_cash: number }
interface StudentRow { id: string; class_code: string; name: string; cash: number; stamp: string; pin_hash: string | null; fails: number; removed: number }

const cleanName = (text: unknown, max: number) => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const nameKey = (name: string) => name.toLowerCase();
const pinHash = (code: string, name: string, pin: string) => sha(`${code}:${nameKey(name)}:${pin}`);

async function loadPortfolio(env: Env, student: StudentRow, startCash: number) {
  const [holdings, trades] = await env.DB.batch([
    env.DB.prepare('SELECT symbol, shares, cost FROM holdings WHERE student_id = ? ORDER BY symbol').bind(student.id),
    env.DB.prepare('SELECT id, symbol, side, shares, price, at FROM trades WHERE student_id = ? ORDER BY at DESC, rowid DESC LIMIT 100').bind(student.id),
  ]);
  return { start: startCash, cash: student.cash, holdings: holdings.results as unknown as Holding[], trades: trades.results as unknown as Trade[] };
}

async function studentFromToken(env: Env, req: Request): Promise<{ student: StudentRow; cls: ClassRow }> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Problem(401, 'Join your class again to continue.');
  const student = await env.DB.prepare('SELECT s.* FROM sessions x JOIN students s ON s.id = x.student_id WHERE x.token_hash = ? AND s.removed = 0').bind(await sha(token)).first<StudentRow>();
  if (!student) throw new Problem(401, 'Join your class again to continue.');
  const cls = await env.DB.prepare('SELECT * FROM classes WHERE code = ?').bind(student.class_code).first<ClassRow>();
  if (!cls) throw new Problem(401, 'That class no longer exists.');
  return { student, cls };
}
async function classFromTeacher(env: Env, req: Request): Promise<ClassRow> {
  const [code, key] = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').split('.');
  const cls = code && key ? await env.DB.prepare('SELECT * FROM classes WHERE code = ?').bind(code.toUpperCase()).first<ClassRow>() : null;
  if (!cls || cls.teacher_hash !== (await sha(`${cls.code}:${key}`))) throw new Problem(401, 'That class code and teacher key do not match.');
  return cls;
}

/** Everyone in a class, richest first. `detail` adds holdings and recent trades for the teacher view. */
async function standings(env: Env, cls: ClassRow, meId: string | null, detail: boolean) {
  const [students, holdings, counts, recent] = await env.DB.batch([
    env.DB.prepare('SELECT id, name, cash FROM students WHERE class_code = ? AND removed = 0').bind(cls.code),
    env.DB.prepare('SELECT h.student_id, h.symbol, h.shares, h.cost FROM holdings h JOIN students s ON s.id = h.student_id WHERE s.class_code = ? AND s.removed = 0').bind(cls.code),
    env.DB.prepare('SELECT t.student_id, COUNT(*) AS n FROM trades t JOIN students s ON s.id = t.student_id WHERE s.class_code = ? GROUP BY t.student_id').bind(cls.code),
    env.DB.prepare('SELECT t.student_id, t.id, t.symbol, t.side, t.shares, t.price, t.at FROM trades t JOIN students s ON s.id = t.student_id WHERE s.class_code = ? ORDER BY t.at DESC, t.rowid DESC LIMIT ?').bind(cls.code, detail ? 400 : 0),
  ]);
  const held = holdings.results as unknown as (Holding & { student_id: string })[];
  const quotes = await getQuotes(env, [...new Set(held.map((h) => h.symbol))]);
  const count = new Map((counts.results as unknown as { student_id: string; n: number }[]).map((r) => [r.student_id, r.n]));
  const list = (students.results as unknown as { id: string; name: string; cash: number }[]).map((s) => {
    const mine = held.filter((h) => h.student_id === s.id);
    const value = s.cash + mine.reduce((sum, h) => sum + (quotes[h.symbol] ? h.shares * quotes[h.symbol].price : h.cost), 0);
    return {
      id: s.id, name: s.name, cash: s.cash, value: Math.round(value * 100) / 100,
      gainPct: Math.round(((value - cls.start_cash) / cls.start_cash) * 10000) / 100,
      trades: count.get(s.id) ?? 0, companies: mine.length, me: s.id === meId || undefined,
      ...(detail ? {
        holdings: mine.map(({ symbol, shares, cost }) => ({ symbol, shares, cost })),
        recent: (recent.results as unknown as (Trade & { student_id: string })[]).filter((t) => t.student_id === s.id).slice(0, 10).map(({ student_id: _, ...t }) => t),
      } : {}),
    };
  });
  return list.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

// ---------- routes ----------

async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api/, '').replace(/\/+$/, '') || '/';
  const post = req.method === 'POST';
  const body = post ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {};
  const one = () => {
    const symbol = (url.searchParams.get('symbol') ?? '').toUpperCase();
    if (!ALLOWED.has(symbol)) throw new Problem(404, 'That stock is not in the Investors Club list.');
    return symbol;
  };

  if (path === '/health') return json({ ok: true, prices: !!(env.FINNHUB_KEY || env.MOCK_MARKET), graphs: !!(env.TWELVE_KEY || env.MOCK_MARKET), school_key: !!env.SCHOOL_KEY });
  await ensure(env);

  if (path === '/quotes') {
    const symbols = (url.searchParams.get('symbols') ?? '').toUpperCase().split(',').filter(Boolean);
    return json({ quotes: await getQuotes(env, symbols.length ? symbols : SYMBOLS, { single: symbols.length === 1 }), open: marketOpen() });
  }
  if (path === '/markers') return json({ markers: await getMarkers(env, one()) });
  if (path === '/history') return json({ points: await getHistory(env, one()) });

  if (path === '/classes' && post) {
    if (env.SCHOOL_KEY && String(body.school_key ?? '').trim() !== env.SCHOOL_KEY) throw new Problem(403, 'That school key is not right. Ask whoever set up Investors Club for your school.');
    const name = cleanName(body.name, 40);
    const teacher = cleanName(body.teacher, 30);
    const startCash = Math.round(Number(body.start_cash) || 10000);
    if (name.length < 2) throw new Problem(400, 'Give the class a name.');
    if (teacher.length < 2) throw new Problem(400, 'Enter your name.');
    if (startCash < 100 || startCash > 1_000_000) throw new Problem(400, 'Starting cash must be between $100 and $1,000,000.');
    const code = joinCode();
    const key = random(12);
    await env.DB.prepare('INSERT INTO classes (code, name, teacher, teacher_hash, start_cash, created_at) VALUES (?,?,?,?,?,?)').bind(code, name, teacher, await sha(`${code}:${key}`), startCash, now()).run();
    return json({ code, name, teacher_key: key });
  }

  if (path === '/join' && post) {
    const code = String(body.code ?? '').trim().toUpperCase();
    const name = cleanName(body.name, 20);
    const pin = String(body.pin ?? '').trim();
    const cls = await env.DB.prepare('SELECT * FROM classes WHERE code = ?').bind(code).first<ClassRow>();
    if (!cls) throw new Problem(404, 'No class has that code. Check it with your teacher.');
    if (name.length < 2 || !/^[\p{L}\p{N} .'-]+$/u.test(name)) throw new Problem(400, 'Enter your first name and last initial, like "Sam T".');
    if (!/^\d{4,8}$/.test(pin)) throw new Problem(400, 'Your PIN must be 4 to 8 digits.');
    const hash = await pinHash(code, name, pin);
    let student = await env.DB.prepare('SELECT * FROM students WHERE class_code = ? AND name_key = ?').bind(code, nameKey(name)).first<StudentRow>();
    if (student) {
      if (student.removed) throw new Problem(403, 'This name was removed from the class. Ask your teacher.');
      if (student.fails >= 10) throw new Problem(403, 'Too many wrong PINs. Ask your teacher to reset your PIN.');
      if (student.pin_hash === null) await env.DB.prepare('UPDATE students SET pin_hash = ?, fails = 0 WHERE id = ?').bind(hash, student.id).run();
      else if (student.pin_hash !== hash) {
        await env.DB.prepare('UPDATE students SET fails = fails + 1 WHERE id = ?').bind(student.id).run();
        throw new Problem(403, 'That name is already in this class and the PIN does not match. If it is someone else, add your last initial.');
      } else if (student.fails) await env.DB.prepare('UPDATE students SET fails = 0 WHERE id = ?').bind(student.id).run();
    } else {
      const size = await env.DB.prepare('SELECT COUNT(*) AS n FROM students WHERE class_code = ? AND removed = 0').bind(code).first<{ n: number }>();
      if ((size?.n ?? 0) >= MAX_CLASS) throw new Problem(403, 'This class is full.');
      student = { id: random(16), class_code: code, name, cash: cls.start_cash, stamp: '', pin_hash: hash, fails: 0, removed: 0 };
      await env.DB.prepare('INSERT INTO students (id, class_code, name, name_key, pin_hash, cash, created_at) VALUES (?,?,?,?,?,?,?)').bind(student.id, code, name, nameKey(name), hash, cls.start_cash, now()).run();
    }
    const token = random(32);
    await env.DB.prepare('INSERT INTO sessions (token_hash, student_id, created_at) VALUES (?,?,?)').bind(await sha(token), student.id, now()).run();
    return json({ token, name: student.name, class: { code: cls.code, name: cls.name }, portfolio: await loadPortfolio(env, student, cls.start_cash) });
  }

  if (path === '/me') {
    const { student, cls } = await studentFromToken(env, req);
    return json({ name: student.name, class: { code: cls.code, name: cls.name }, portfolio: await loadPortfolio(env, student, cls.start_cash) });
  }

  if (path === '/trade' && post) {
    const { student, cls } = await studentFromToken(env, req);
    const symbol = String(body.symbol ?? '').toUpperCase();
    const side = body.side === 'sell' ? 'sell' : 'buy';
    const shares = roundShares(Number(body.shares));
    if (!ALLOWED.has(symbol)) throw new Problem(404, 'That stock is not in the Investors Club list.');
    const quote = (await getQuotes(env, [symbol], { single: true }))[symbol];
    if (!quote) throw new Problem(503, 'There is no price for this stock right now. Try again in a minute.');
    const before = await loadPortfolio(env, student, cls.start_cash);
    const after = applyTrade(before, symbol, side, shares, quote.price);
    if (typeof after === 'string') throw new Problem(400, after);
    const trade = after.trades[0];
    const holding = after.holdings.find((h) => h.symbol === symbol);
    // The stamp makes the whole trade apply once or not at all, even if two requests arrive together.
    const stamp = random(12);
    const guard = '(SELECT stamp FROM students WHERE id = ?) = ?';
    const results = await env.DB.batch([
      env.DB.prepare('UPDATE students SET cash = ?, stamp = ? WHERE id = ? AND stamp = ?').bind(after.cash, stamp, student.id, student.stamp),
      holding
        ? env.DB.prepare(`INSERT INTO holdings (student_id, symbol, shares, cost) SELECT ?,?,?,? WHERE ${guard} ON CONFLICT(student_id, symbol) DO UPDATE SET shares = excluded.shares, cost = excluded.cost`).bind(student.id, symbol, holding.shares, holding.cost, student.id, stamp)
        : env.DB.prepare(`DELETE FROM holdings WHERE student_id = ? AND symbol = ? AND ${guard}`).bind(student.id, symbol, student.id, stamp),
      env.DB.prepare(`INSERT INTO trades (id, student_id, symbol, side, shares, price, at) SELECT ?,?,?,?,?,?,? WHERE ${guard}`).bind(trade.id, student.id, symbol, side, trade.shares, trade.price, trade.at, student.id, stamp),
    ]);
    if (results[0].meta.changes !== 1) throw new Problem(409, 'That did not go through. Try again.');
    return json({ trade, quote, portfolio: { ...after, trades: after.trades.slice(0, 100) } });
  }

  if (path === '/leaderboard') {
    const { student, cls } = await studentFromToken(env, req);
    return json({ class: { code: cls.code, name: cls.name }, standings: await standings(env, cls, student.id, false) });
  }

  if (path.startsWith('/teacher/')) {
    const cls = await classFromTeacher(env, req);
    if (path === '/teacher/class') return json({ class: { code: cls.code, name: cls.name, teacher: cls.teacher, start_cash: cls.start_cash }, standings: await standings(env, cls, null, true) });
    if (!post) throw new Problem(404, 'Not found.');
    if (path === '/teacher/restart') {
      const inClass = 'student_id IN (SELECT id FROM students WHERE class_code = ?)';
      await env.DB.batch([
        env.DB.prepare(`DELETE FROM holdings WHERE ${inClass}`).bind(cls.code),
        env.DB.prepare(`DELETE FROM trades WHERE ${inClass}`).bind(cls.code),
        env.DB.prepare(`UPDATE students SET cash = ?, stamp = '' WHERE class_code = ?`).bind(cls.start_cash, cls.code),
      ]);
      return json({ ok: true });
    }
    const id = String(body.student_id ?? '');
    const student = await env.DB.prepare('SELECT id FROM students WHERE id = ? AND class_code = ?').bind(id, cls.code).first();
    if (!student) throw new Problem(404, 'That student is not in this class.');
    if (path === '/teacher/remove') {
      await env.DB.batch([env.DB.prepare('UPDATE students SET removed = 1 WHERE id = ?').bind(id), env.DB.prepare('DELETE FROM sessions WHERE student_id = ?').bind(id)]);
      return json({ ok: true });
    }
    if (path === '/teacher/reset-pin') {
      await env.DB.batch([env.DB.prepare('UPDATE students SET pin_hash = NULL, fails = 0 WHERE id = ?').bind(id), env.DB.prepare('DELETE FROM sessions WHERE student_id = ?').bind(id)]);
      return json({ ok: true });
    }
  }
  throw new Problem(404, 'Not found.');
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      return await route(req, env);
    } catch (e) {
      if (e instanceof Problem) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Something went wrong on the class server.' }, 500);
    }
  },
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(warm(env));
  },
} satisfies ExportedHandler<Env>;
