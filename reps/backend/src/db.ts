// Data layer shared by the REST API (mobile app) and the MCP server (Claude).
// Every function is scoped to a user id, so adding more users later needs no changes here.

import LIBRARY from '../library.json';

export interface Env {
  DB: D1Database;
  ADMIN_SECRET?: string;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const KG_PER_LB = 0.45359237;
export type Unit = 'kg' | 'lb';
export const toKg = (w: number, unit: Unit) => (unit === 'lb' ? w * KG_PER_LB : w);
export const fromKg = (kg: number, unit: Unit) =>
  Math.round((unit === 'lb' ? kg / KG_PER_LB : kg) * 100) / 100;

export const MUSCLES = ['abdominals', 'abductors', 'adductors', 'biceps', 'calves', 'chest', 'forearms', 'glutes', 'hamstrings', 'lats', 'lower back', 'middle back', 'neck', 'quadriceps', 'shoulders', 'traps', 'triceps', 'cardio', 'other'];
const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'ez bar', 'medicine ball', 'exercise ball', 'foam roll', 'other'];
const SET_TYPES = ['normal', 'warmup', 'drop', 'failure'];

const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const uid = () => crypto.randomUUID();

function str(v: unknown, field: string, max = 200): string {
  if (typeof v !== 'string' || !v.trim()) throw new HttpError(400, `${field} is required`);
  return v.trim().slice(0, max);
}
function optStr(v: unknown, max = 2000): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
function num(v: unknown, field: string, min: number, max: number): number {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max)
    throw new HttpError(400, `${field} must be a number between ${min} and ${max}`);
  return n;
}
function isoDate(v: unknown, field: string): string {
  const d = new Date(typeof v === 'string' || typeof v === 'number' ? v : NaN);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, `${field} must be an ISO date/time`);
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// ---------- users & tokens ----------

export interface User { id: string; name: string; unit: Unit; created_at: string }

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function userFromToken(db: D1Database, token: string): Promise<User | null> {
  if (!token || token.length < 20) return null;
  return db
    .prepare('SELECT u.* FROM api_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ?')
    .bind(await sha256(token))
    .first<User>();
}

export async function createUser(db: D1Database, name: string, unit: Unit = 'lb') {
  const id = uid();
  const token = 'fl_' + [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('');
  await db.batch([
    db.prepare('INSERT INTO users (id, name, unit) VALUES (?, ?, ?)').bind(id, str(name, 'name', 80), unit),
    db.prepare('INSERT INTO api_tokens (token_hash, user_id) VALUES (?, ?)').bind(await sha256(token), id),
  ]);
  return { id, name, unit, token };
}

export async function updateUser(db: D1Database, user: User, patch: any): Promise<User> {
  const name = patch?.name !== undefined ? str(patch.name, 'name', 80) : user.name;
  const unit = patch?.unit !== undefined ? patch.unit : user.unit;
  if (unit !== 'kg' && unit !== 'lb') throw new HttpError(400, "unit must be 'kg' or 'lb'");
  await db.prepare('UPDATE users SET name = ?, unit = ? WHERE id = ?').bind(name, unit, user.id).run();
  return { ...user, name, unit };
}

// ---------- exercises ----------

let libraryReady = false;

/** Loads the built-in exercise library into a fresh database. Cheap after the first call. */
export async function ensureLibrary(db: D1Database) {
  if (libraryReady) return;
  const rows = LIBRARY as string[][];
  // Reload when rows are missing or the library was renamed since this database was last seeded.
  const have = await db.prepare('SELECT COUNT(*) AS n FROM exercises WHERE user_id IS NULL').first<{ n: number }>();
  const sample = await db.prepare('SELECT name FROM exercises WHERE id = ? AND user_id IS NULL').bind(rows[rows.length - 1][0]).first<{ name: string }>();
  if ((have?.n ?? 0) < rows.length || sample?.name !== rows[rows.length - 1][1]) {
    const stmts: D1PreparedStatement[] = [];
    for (let i = 0; i < rows.length; i += 25) {
      const chunk = rows.slice(i, i + 25);
      stmts.push(
        db
          .prepare(
            `INSERT INTO exercises (id, user_id, name, muscle_group, equipment) VALUES ${chunk.map(() => '(?, NULL, ?, ?, ?)').join(', ')}
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, muscle_group = excluded.muscle_group, equipment = excluded.equipment`,
          )
          .bind(...chunk.flat()),
      );
    }
    await db.batch(stmts);
  }
  libraryReady = true;
}

/** One INSERT for many rows, split so no statement exceeds D1's 100 bound parameters. */
function insertMany(db: D1Database, table: string, cols: string[], rows: unknown[][]): D1PreparedStatement[] {
  const per = Math.max(1, Math.floor(100 / cols.length));
  const out: D1PreparedStatement[] = [];
  for (let i = 0; i < rows.length; i += per) {
    const chunk = rows.slice(i, i + per);
    const one = `(${cols.map(() => '?').join(', ')})`;
    out.push(db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES ${chunk.map(() => one).join(', ')}`).bind(...chunk.flat()));
  }
  return out;
}

export interface Exercise { id: string; name: string; muscle_group: string; equipment: string; custom: boolean }

export async function listExercises(db: D1Database, userId: string, f: { query?: string; muscle_group?: string } = {}): Promise<Exercise[]> {
  let sql = 'SELECT id, name, muscle_group, equipment, user_id IS NOT NULL AS custom FROM exercises WHERE (user_id IS NULL OR user_id = ?)';
  const args: unknown[] = [userId];
  if (f.query) { sql += ' AND name LIKE ?'; args.push(`%${f.query.trim()}%`); }
  if (f.muscle_group) { sql += ' AND muscle_group = ?'; args.push(f.muscle_group.toLowerCase()); }
  const { results } = await db.prepare(sql + ' ORDER BY name').bind(...args).all<any>();
  return results.map((r) => ({ ...r, custom: !!r.custom }));
}

export async function createExercise(db: D1Database, userId: string, input: any): Promise<Exercise> {
  const name = str(input?.name, 'name', 80);
  const muscle = MUSCLES.includes(String(input?.muscle_group).toLowerCase()) ? String(input.muscle_group).toLowerCase() : 'other';
  const equipment = EQUIPMENT.includes(String(input?.equipment).toLowerCase()) ? String(input.equipment).toLowerCase() : 'other';
  const existing = await findExercise(db, userId, name);
  if (existing) return existing;
  const wanted = /^[A-Za-z0-9_-]{8,64}$/.test(String(input?.id ?? '')) ? String(input.id) : null;
  const taken = wanted ? await db.prepare('SELECT 1 FROM exercises WHERE id = ?').bind(wanted).first() : null;
  const id = wanted && !taken ? wanted : uid();
  await db.prepare('INSERT INTO exercises (id, user_id, name, muscle_group, equipment) VALUES (?, ?, ?, ?, ?)').bind(id, userId, name, muscle, equipment).run();
  return { id, name, muscle_group: muscle, equipment, custom: true };
}

async function findExercise(db: D1Database, userId: string, ref: string): Promise<Exercise | null> {
  const r = await db
    .prepare('SELECT id, name, muscle_group, equipment, user_id IS NOT NULL AS custom FROM exercises WHERE (user_id IS NULL OR user_id = ?) AND (id = ? OR name = ? COLLATE NOCASE) ORDER BY user_id IS NULL LIMIT 1')
    .bind(userId, ref, ref)
    .first<any>();
  return r ? { ...r, custom: !!r.custom } : null;
}

/**
 * Resolve an exercise by id, then by name. Unknown names become custom exercises so logging never fails;
 * when the app sends its own id for a new exercise, that id is kept so both sides agree.
 */
async function resolveExercise(db: D1Database, userId: string, item: any, created: string[]): Promise<Exercise> {
  const id = typeof item?.exercise_id === 'string' ? item.exercise_id : '';
  const name = [item?.exercise, item?.exercise_name, item?.name].find((v) => typeof v === 'string' && v.trim());
  if (!id && !name) throw new HttpError(400, 'exercise is required');
  const found = (id && (await findExercise(db, userId, id))) || (name && (await findExercise(db, userId, String(name).trim())));
  if (found) return found;
  if (!name) throw new HttpError(400, `Unknown exercise_id: ${id}`);
  const ex = await createExercise(db, userId, { id, name, muscle_group: item?.muscle_group, equipment: item?.equipment });
  created.push(ex.name);
  return ex;
}

// ---------- routines ----------

const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
/** Ids may be chosen by the app (it works offline), so validate anything that arrives from a client. */
const clientId = (v: unknown): string | null => (typeof v === 'string' && ID_RE.test(v) ? v : null);

const tombstone = (db: D1Database, userId: string, kind: 'routine' | 'workout', id: string) =>
  db.prepare('INSERT INTO deletions (user_id, kind, id, deleted_at) VALUES (?, ?, ?, ?)').bind(userId, kind, id, now());

export async function listRoutines(db: D1Database, userId: string, id?: string) {
  const { results: routines } = await db
    .prepare(`SELECT id, name, folder, notes, created_at, updated_at FROM routines WHERE user_id = ? ${id ? 'AND id = ?' : ''} ORDER BY folder, created_at`)
    .bind(...(id ? [userId, id] : [userId]))
    .all<any>();
  const { results: items } = await db
    .prepare(
      `SELECT re.routine_id, re.exercise_id, e.name AS exercise_name, e.muscle_group, e.equipment, re.position, re.target_sets, re.target_reps, re.rest_seconds, re.notes
       FROM routine_exercises re JOIN routines r ON r.id = re.routine_id JOIN exercises e ON e.id = re.exercise_id
       WHERE r.user_id = ? ${id ? 'AND r.id = ?' : ''} ORDER BY re.position`,
    )
    .bind(...(id ? [userId, id] : [userId]))
    .all<any>();
  return routines.map((r) => ({
    ...r,
    exercises: items.filter((i) => i.routine_id === r.id).map(({ routine_id, ...rest }) => rest),
  }));
}

export async function getRoutine(db: D1Database, userId: string, id: string) {
  const [r] = await listRoutines(db, userId, id);
  if (!r) throw new HttpError(404, 'Routine not found');
  return r;
}

/**
 * Create a routine, or fully replace the one with `id`.
 * With `upsert`, an unknown id is created under that id (used by the app's sync, which mints ids offline).
 */
export async function saveRoutine(db: D1Database, userId: string, input: any, id?: string, upsert = false) {
  const name = str(input?.name, 'name', 80);
  const notes = optStr(input?.notes);
  if (!Array.isArray(input?.exercises) || !input.exercises.length) throw new HttpError(400, 'exercises must be a non-empty array');
  if (input.exercises.length > 40) throw new HttpError(400, 'A routine can have at most 40 exercises');
  const existing = id ? await db.prepare('SELECT user_id, folder FROM routines WHERE id = ?').bind(id).first<any>() : null;
  if (existing && existing.user_id !== userId) throw new HttpError(404, 'Routine not found');
  if (id && !existing && !(upsert && clientId(id))) throw new HttpError(404, 'Routine not found');
  const folder = input?.folder !== undefined ? optStr(input.folder, 60) : existing?.folder ?? '';
  const created: string[] = [];
  const stmts: D1PreparedStatement[] = [];
  const rid = id ?? uid();
  if (existing) {
    stmts.push(db.prepare('UPDATE routines SET name = ?, folder = ?, notes = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(name, folder, notes, now(), rid, userId));
    stmts.push(db.prepare('DELETE FROM routine_exercises WHERE routine_id = ?').bind(rid));
  } else {
    stmts.push(db.prepare('INSERT INTO routines (id, user_id, name, folder, notes) VALUES (?, ?, ?, ?, ?)').bind(rid, userId, name, folder, notes));
  }
  const items: unknown[][] = [];
  for (const item of input.exercises) {
    const ex = await resolveExercise(db, userId, item, created);
    const sets = item.target_sets ?? item.sets;
    const reps = item.target_reps ?? item.reps;
    items.push([
      uid(), rid, ex.id, items.length,
      sets === undefined ? 3 : Math.round(num(sets, 'sets', 1, 20)),
      reps === undefined ? '8-12' : String(reps).slice(0, 20),
      item.rest_seconds === undefined ? 120 : Math.round(num(item.rest_seconds, 'rest_seconds', 0, 1800)),
      optStr(item.notes, 500),
    ]);
  }
  stmts.push(...insertMany(db, 'routine_exercises', ['id', 'routine_id', 'exercise_id', 'position', 'target_sets', 'target_reps', 'rest_seconds', 'notes'], items));
  await db.batch(stmts);
  return { routine: await getRoutine(db, userId, rid), created_exercises: created };
}

export async function deleteRoutine(db: D1Database, userId: string, id: string) {
  await getRoutine(db, userId, id);
  await db.batch([
    db.prepare('DELETE FROM routine_exercises WHERE routine_id = ?').bind(id),
    db.prepare('DELETE FROM routines WHERE id = ? AND user_id = ?').bind(id, userId),
    tombstone(db, userId, 'routine', id),
  ]);
}

// ---------- workouts ----------

export async function listWorkouts(db: D1Database, userId: string, f: { limit?: number; since?: string; until?: string } = {}) {
  const limit = Math.min(Math.max(Math.round(Number(f.limit) || 20), 1), 50);
  let where = 'w.user_id = ?';
  const args: unknown[] = [userId];
  if (f.since) { where += ' AND w.started_at >= ?'; args.push(isoDate(f.since, 'since')); }
  if (f.until) { where += ' AND w.started_at <= ?'; args.push(isoDate(f.until, 'until')); }
  const { results } = await db
    .prepare(
      `SELECT w.id, w.name, w.started_at, w.ended_at, w.notes, w.source, w.pr_count,
              COUNT(s.id) AS set_count, COALESCE(SUM(s.weight_kg * s.reps), 0) AS volume_kg
       FROM workouts w LEFT JOIN workout_sets s ON s.workout_id = w.id
       WHERE ${where} GROUP BY w.id ORDER BY w.started_at DESC LIMIT ?`,
    )
    .bind(...args, limit)
    .all<any>();
  if (!results.length) return [];
  const ids = results.map((r) => r.id);
  const { results: ex } = await db
    .prepare(
      `SELECT s.workout_id, e.name, COUNT(*) AS sets, MIN(s.exercise_position) AS pos
       FROM workout_sets s JOIN exercises e ON e.id = s.exercise_id
       WHERE s.workout_id IN (${ids.map(() => '?').join(',')}) GROUP BY s.workout_id, s.exercise_position ORDER BY pos`,
    )
    .bind(...ids)
    .all<any>();
  return results.map((w) => ({
    ...w,
    duration_minutes: Math.round((Date.parse(w.ended_at) - Date.parse(w.started_at)) / 60000),
    exercises: ex.filter((e) => e.workout_id === w.id).map((e) => ({ name: e.name, sets: e.sets })),
  }));
}

const SET_COLS = `s.workout_id, s.exercise_id, e.name AS exercise_name, e.muscle_group, e.equipment, s.exercise_position, s.set_number, s.set_type, s.weight_kg, s.reps, s.rpe, s.pr`;

/** Fold flat set rows into workouts with nested exercises and sets. */
function assemble(workouts: any[], sets: any[]) {
  const byId = new Map<string, any>();
  for (const w of workouts) {
    byId.set(w.id, {
      ...w,
      duration_minutes: Math.round((Date.parse(w.ended_at) - Date.parse(w.started_at)) / 60000),
      volume_kg: 0,
      exercises: [],
    });
  }
  for (const s of sets) {
    const w = byId.get(s.workout_id);
    if (!w) continue;
    let g = w.exercises[w.exercises.length - 1];
    if (!g || g.position !== s.exercise_position) {
      g = { position: s.exercise_position, exercise_id: s.exercise_id, exercise_name: s.exercise_name, muscle_group: s.muscle_group, equipment: s.equipment, sets: [] };
      w.exercises.push(g);
    }
    g.sets.push({ set_number: s.set_number, set_type: s.set_type, weight_kg: s.weight_kg, reps: s.reps, rpe: s.rpe, prs: s.pr ? String(s.pr).split(',') : [] });
    w.volume_kg += s.weight_kg * s.reps;
  }
  return [...byId.values()];
}

const WORKOUT_COLS = 'id, routine_id, name, started_at, ended_at, notes, source, pr_count, updated_at';

export async function getWorkout(db: D1Database, userId: string, id: string) {
  const w = await db.prepare(`SELECT ${WORKOUT_COLS} FROM workouts WHERE id = ? AND user_id = ?`).bind(id, userId).first<any>();
  if (!w) throw new HttpError(404, 'Workout not found');
  const { results } = await db
    .prepare(`SELECT ${SET_COLS} FROM workout_sets s JOIN exercises e ON e.id = s.exercise_id WHERE s.workout_id = ? ORDER BY s.exercise_position, s.set_number`)
    .bind(id)
    .all<any>();
  return assemble([w], results)[0];
}

interface SetRow { exId: string; name: string; pos: number; n: number; type: string; kg: number; reps: number; rpe: number | null; pr: string[] }

const e1rm = (kg: number, reps: number) => (reps <= 0 ? 0 : reps === 1 ? kg : kg * (1 + reps / 30)); // Epley

/** Mark the best set per exercise that beats everything logged before: heaviest weight, estimated 1RM, set volume. */
async function markRecords(db: D1Database, userId: string, rows: SetRow[], ignoreWorkoutId: string) {
  for (const exId of new Set(rows.map((r) => r.exId))) {
    const prior = await db
      .prepare(
        `SELECT COUNT(*) AS n, MAX(s.weight_kg) AS w, MAX(s.weight_kg * s.reps) AS v,
                MAX(CASE WHEN s.reps = 1 THEN s.weight_kg ELSE s.weight_kg * (1 + s.reps / 30.0) END) AS o
         FROM workout_sets s JOIN workouts wk ON wk.id = s.workout_id
         WHERE wk.user_id = ? AND s.exercise_id = ? AND s.set_type != 'warmup' AND s.reps > 0 AND wk.id != ?`,
      )
      .bind(userId, exId, ignoreWorkoutId)
      .first<any>();
    if (!prior?.n) continue; // a first session has nothing to beat
    const mine = rows.filter((r) => r.exId === exId && r.type !== 'warmup' && r.reps > 0 && r.kg > 0);
    const check = (key: string, value: (r: SetRow) => number, best: number) => {
      const top = mine.reduce<SetRow | null>((a, r) => (!a || value(r) > value(a) ? r : a), null);
      if (top && value(top) > (best ?? 0) + 1e-6) top.pr.push(key);
    };
    check('weight', (r) => r.kg, prior.w);
    check('1rm', (r) => e1rm(r.kg, r.reps), prior.o);
    check('volume', (r) => r.kg * r.reps, prior.v);
  }
}

/**
 * Save a finished workout. Set weights must already be in kg.
 * If `id` is given and already exists for this user, the workout is replaced (the app re-sends on sync).
 */
export async function createWorkout(db: D1Database, userId: string, input: any) {
  const name = str(input?.name ?? 'Workout', 'name', 80);
  const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const durMs = input?.duration_minutes !== undefined ? num(input.duration_minutes, 'duration_minutes', 0, 1440) * 60000 : 0;
  // With only a duration, assume the session just finished rather than ending in the future.
  const started = input?.started_at ? isoDate(input.started_at, 'started_at') : iso(Date.now() - (input?.ended_at ? 0 : durMs));
  const ended = input?.ended_at ? isoDate(input.ended_at, 'ended_at') : iso(Date.parse(started) + durMs);
  if (Date.parse(ended) < Date.parse(started)) throw new HttpError(400, 'ended_at is before started_at');
  if (!Array.isArray(input?.exercises) || !input.exercises.length) throw new HttpError(400, 'exercises must be a non-empty array');
  const source = input?.source === 'claude' ? 'claude' : 'app';

  const id = clientId(input?.id) ?? uid();
  const existing = await db.prepare('SELECT user_id FROM workouts WHERE id = ?').bind(id).first<any>();
  if (existing && existing.user_id !== userId) throw new HttpError(400, 'Invalid workout id');

  const created: string[] = [];
  const rows: SetRow[] = [];
  let pos = 0;
  let clientMarked = false;
  for (const item of input.exercises) {
    const ex = await resolveExercise(db, userId, item, created);
    if (!Array.isArray(item.sets) || !item.sets.length) throw new HttpError(400, `${ex.name}: sets must be a non-empty array`);
    let n = 1;
    for (const s of item.sets) {
      if (rows.length >= 400) throw new HttpError(400, 'Too many sets in one workout');
      const given = Array.isArray(s?.prs) ? s.prs.filter((x: unknown) => x === 'weight' || x === '1rm' || x === 'volume') : null;
      if (given) clientMarked = true;
      rows.push({
        exId: ex.id, name: ex.name, pos, n: n++,
        type: SET_TYPES.includes(s?.set_type) ? s.set_type : 'normal',
        kg: num(s?.weight_kg ?? 0, `${ex.name} weight`, 0, 2000),
        reps: Math.round(num(s?.reps ?? 0, `${ex.name} reps`, 0, 1000)),
        rpe: s?.rpe === undefined || s?.rpe === null ? null : num(s.rpe, `${ex.name} rpe`, 1, 10),
        pr: given ?? [],
      });
    }
    pos++;
  }
  // The app works out records on the phone and sends them; for anything else (Claude), do it here.
  if (!clientMarked) await markRecords(db, userId, rows, id);

  const stmts: D1PreparedStatement[] = [];
  if (existing) {
    stmts.push(db.prepare('DELETE FROM workout_sets WHERE workout_id = ?').bind(id));
    stmts.push(db.prepare('DELETE FROM workouts WHERE id = ? AND user_id = ?').bind(id, userId));
  }
  stmts.push(
    db.prepare('INSERT INTO workouts (id, user_id, routine_id, name, started_at, ended_at, notes, source, pr_count, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(
      id, userId, typeof input.routine_id === 'string' ? input.routine_id : null, name, started, ended, optStr(input.notes), source,
      rows.reduce((a, r) => a + r.pr.length, 0), now(),
    ),
  );
  stmts.push(
    ...insertMany(
      db, 'workout_sets',
      ['id', 'workout_id', 'exercise_id', 'exercise_position', 'set_number', 'set_type', 'weight_kg', 'reps', 'rpe', 'pr'],
      rows.map((r) => [uid(), id, r.exId, r.pos, r.n, r.type, r.kg, r.reps, r.rpe, r.pr.join(',')]),
    ),
  );
  await db.batch(stmts);
  return { workout: await getWorkout(db, userId, id), created_exercises: created };
}

export async function deleteWorkout(db: D1Database, userId: string, id: string) {
  await getWorkout(db, userId, id);
  await db.batch([
    db.prepare('DELETE FROM workout_sets WHERE workout_id = ?').bind(id),
    db.prepare('DELETE FROM workouts WHERE id = ? AND user_id = ?').bind(id, userId),
    tombstone(db, userId, 'workout', id),
  ]);
}

// ---------- sync (for the standalone app) ----------

/**
 * Everything the app needs to mirror the server: all routines and custom exercises (small),
 * plus workouts changed and items deleted since the app's last sync.
 */
export async function syncPull(db: D1Database, user: User, since?: string) {
  const serverTime = now();
  const from = since ? isoDate(since, 'since') : '1970-01-01T00:00:00Z';
  const { results: custom } = await db.prepare('SELECT id, name, muscle_group, equipment FROM exercises WHERE user_id = ? ORDER BY name').bind(user.id).all<any>();
  const { results: ws } = await db.prepare(`SELECT ${WORKOUT_COLS} FROM workouts WHERE user_id = ? AND updated_at >= ? ORDER BY started_at`).bind(user.id, from).all<any>();
  const { results: sets } = await db
    .prepare(
      `SELECT ${SET_COLS} FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises e ON e.id = s.exercise_id
       WHERE w.user_id = ? AND w.updated_at >= ? ORDER BY s.workout_id, s.exercise_position, s.set_number`,
    )
    .bind(user.id, from)
    .all<any>();
  const { results: deleted } = await db.prepare('SELECT kind, id FROM deletions WHERE user_id = ? AND deleted_at >= ?').bind(user.id, from).all<any>();
  return {
    server_time: serverTime,
    user: { name: user.name, unit: user.unit },
    exercises: custom.map((e) => ({ ...e, custom: true })),
    routines: await listRoutines(db, user.id),
    workouts: assemble(ws, sets),
    deleted,
  };
}

// ---------- history & stats ----------

export async function exerciseHistory(db: D1Database, userId: string, ref: string, limit = 10) {
  const ex = await findExercise(db, userId, ref);
  if (!ex) throw new HttpError(404, `Exercise not found: ${ref}`);
  const { results } = await db
    .prepare(
      `SELECT w.id AS workout_id, w.name AS workout_name, w.started_at, s.set_number, s.set_type, s.weight_kg, s.reps, s.rpe
       FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
       WHERE w.user_id = ? AND s.exercise_id = ? ORDER BY w.started_at DESC, s.exercise_position, s.set_number`,
    )
    .bind(userId, ex.id)
    .all<any>();
  const sessions: any[] = [];
  let best = { weight_kg: 0, reps: 0, date: null as string | null };
  let best1 = { est_1rm_kg: 0, weight_kg: 0, reps: 0, date: null as string | null };
  for (const s of results) {
    if (s.set_type !== 'warmup') {
      if (s.weight_kg > best.weight_kg || (s.weight_kg === best.weight_kg && s.reps > best.reps)) best = { weight_kg: s.weight_kg, reps: s.reps, date: s.started_at };
      const e = e1rm(s.weight_kg, s.reps);
      if (e > best1.est_1rm_kg) best1 = { est_1rm_kg: Math.round(e * 100) / 100, weight_kg: s.weight_kg, reps: s.reps, date: s.started_at };
    }
    let g = sessions[sessions.length - 1];
    if (!g || g.workout_id !== s.workout_id) {
      g = { workout_id: s.workout_id, workout_name: s.workout_name, date: s.started_at, sets: [] };
      sessions.push(g);
    }
    g.sets.push({ set_number: s.set_number, set_type: s.set_type, weight_kg: s.weight_kg, reps: s.reps, rpe: s.rpe });
  }
  const lim = Math.min(Math.max(Math.round(Number(limit) || 10), 1), 50);
  return {
    exercise: ex,
    total_sessions: sessions.length,
    heaviest_set: best.date ? best : null,
    best_estimated_1rm: best1.date ? best1 : null,
    sessions: sessions.slice(0, lim),
  };
}

export async function stats(db: D1Database, userId: string, days = 30) {
  const d = Math.min(Math.max(Math.round(Number(days) || 30), 1), 3650);
  const since = new Date(Date.now() - d * 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const totals = await db
    .prepare(
      `SELECT COUNT(DISTINCT w.id) AS workouts, COUNT(s.id) AS sets, COALESCE(SUM(s.weight_kg * s.reps), 0) AS volume_kg
       FROM workouts w LEFT JOIN workout_sets s ON s.workout_id = w.id WHERE w.user_id = ? AND w.started_at >= ?`,
    )
    .bind(userId, since)
    .first<any>();
  const dur = await db
    .prepare(`SELECT COALESCE(SUM((julianday(ended_at) - julianday(started_at)) * 1440), 0) AS minutes FROM workouts WHERE user_id = ? AND started_at >= ?`)
    .bind(userId, since)
    .first<any>();
  const { results: muscles } = await db
    .prepare(
      `SELECT e.muscle_group, COUNT(*) AS sets, COALESCE(SUM(s.weight_kg * s.reps), 0) AS volume_kg
       FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises e ON e.id = s.exercise_id
       WHERE w.user_id = ? AND w.started_at >= ? AND s.set_type != 'warmup' GROUP BY e.muscle_group ORDER BY sets DESC`,
    )
    .bind(userId, since)
    .all<any>();
  const { results: top } = await db
    .prepare(
      `SELECT e.name, COUNT(DISTINCT w.id) AS sessions, COUNT(*) AS sets, MAX(s.weight_kg) AS max_weight_kg
       FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises e ON e.id = s.exercise_id
       WHERE w.user_id = ? AND w.started_at >= ? AND s.set_type != 'warmup' GROUP BY e.id ORDER BY sets DESC LIMIT 15`,
    )
    .bind(userId, since)
    .all<any>();
  return {
    period_days: d,
    since,
    workouts: totals?.workouts ?? 0,
    workouts_per_week: Math.round(((totals?.workouts ?? 0) / d) * 7 * 10) / 10,
    total_sets: totals?.sets ?? 0,
    total_volume_kg: totals?.volume_kg ?? 0,
    total_minutes: Math.round(dur?.minutes ?? 0),
    sets_by_muscle_group: muscles,
    top_exercises: top,
  };
}
