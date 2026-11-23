// Classes. A teacher creates a class and gets a join code; students join with the code, a name and a PIN.
// No email addresses or real accounts. In a class, the server keeps each portfolio and fills every trade at its
// own price, so the leaderboard is fair. All of this is optional: the app works alone as a practice portfolio.
import { getJson, refreshQuotes, serverUrl } from './market';
import { db, setClass, setClassPortfolio } from './store';
import type { ClassLink, Portfolio, Standing, StudentDetail } from './types';

type ServerPortfolio = Omit<Portfolio, 'snapshots'>;

function call(server: string, path: string, body?: unknown, token?: string) {
  return getJson(`${server}/api${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const mine = (path: string, body?: unknown) => {
  if (!db.cls) throw new Error('You are not in a class.');
  return call(db.cls.server, path, body, db.cls.token);
};
function needServer(): string {
  const server = serverUrl();
  if (!server) throw new Error('This app is not connected to a class server yet. Ask your teacher, or open Settings, then Market data.');
  return server;
}

/** Joins a class, or signs back in on a new device if the name and PIN match. */
export async function joinClass(code: string, name: string, pin: string) {
  const server = needServer();
  const j = await call(server, '/join', { code: code.trim().toUpperCase(), name: name.trim(), pin: pin.trim() });
  const link: ClassLink = { server, code: j.class.code, className: j.class.name, role: 'student', token: j.token, name: j.name };
  db.cls = link;
  setClassPortfolio(j.portfolio as ServerPortfolio);
  refreshQuotes(true);
}

/** Creates a class. `schoolKey` is only needed if the server was set up to require one. */
export async function createClass(className: string, teacherName: string, startCash: number, schoolKey: string) {
  const server = needServer();
  const j = await call(server, '/classes', { name: className.trim(), teacher: teacherName.trim(), start_cash: startCash, school_key: schoolKey.trim() });
  setClass({ server, code: j.code, className: j.name, role: 'teacher', token: `${j.code}.${j.teacher_key}`, name: teacherName.trim() });
  return j as { code: string; teacher_key: string };
}

/** Opens the teacher view on another device using the class code and teacher key. */
export async function teacherSignIn(code: string, key: string) {
  const server = needServer();
  const j = await call(server, '/teacher/class', undefined, `${code.trim().toUpperCase()}.${key.trim()}`);
  setClass({ server, code: j.class.code, className: j.class.name, role: 'teacher', token: `${j.class.code}.${key.trim()}`, name: j.class.teacher });
}

export function leaveClass() {
  setClass(null);
}

/** Pulls the latest copy of your class portfolio. */
export async function syncPortfolio() {
  if (db.cls?.role !== 'student') return;
  const j = await mine('/me');
  setClassPortfolio(j.portfolio as ServerPortfolio);
}

/** Places a class trade. The server decides the price. */
export async function tradeInClass(symbol: string, side: 'buy' | 'sell', shares: number) {
  const j = await mine('/trade', { symbol, side, shares });
  if (j.quote) db.quotes[symbol] = j.quote;
  setClassPortfolio(j.portfolio as ServerPortfolio);
  return j.trade as { price: number; shares: number };
}

export async function leaderboard(): Promise<{ className: string; standings: Standing[] }> {
  const j = await mine(db.cls?.role === 'teacher' ? '/teacher/class' : '/leaderboard');
  return { className: j.class.name, standings: j.standings };
}

export async function teacherClass(): Promise<{ code: string; name: string; startCash: number; students: StudentDetail[] }> {
  const j = await mine('/teacher/class');
  return { code: j.class.code, name: j.class.name, startCash: j.class.start_cash, students: j.standings };
}
export const removeStudent = (id: string) => mine('/teacher/remove', { student_id: id });
export const resetPin = (id: string) => mine('/teacher/reset-pin', { student_id: id });
export const restartClass = () => mine('/teacher/restart', {});
