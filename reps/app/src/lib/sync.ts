// Optional: keep the phone and the server Claude talks to in step.
// The phone is the original for workouts it logged; the server holds a copy so Claude can read history.
// Routines and workouts Claude creates are pulled down; deletions travel both ways.
import { AppState } from 'react-native';

import { ENERGY, FEEL } from './coach';
import { bump, commit, db, emptyLink, exercise, isLinked, onCommit, routine, saveData, unit, workout } from './store';
import type { Exercise, Routine, Workout } from './types';

interface Reply { ok: boolean; status: number; data: any; error: string }

export async function request(path: string, method = 'GET', body?: unknown, baseUrl = db.link.base_url, token = db.link.token): Promise<Reply> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(baseUrl + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, status: res.status, data, error: res.status === 401 ? 'The token was not accepted.' : data?.error ?? `Request failed (${res.status})` };
    return { ok: true, status: res.status, data, error: '' };
  } catch {
    return { ok: false, status: 0, data: null, error: "Can't reach the server. Check your connection." };
  } finally {
    clearTimeout(timer);
  }
}

/** Connects and uploads everything already on the phone. */
export async function connectClaude(baseUrl: string, token: string): Promise<Reply> {
  let url = baseUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const res = await request('/api/me', 'GET', undefined, url, token.trim());
  if (!res.ok) return res;
  db.link = { ...emptyLink(), base_url: url, token: token.trim(), push_unit: true };
  db.deleted = [];
  for (const r of db.routines) r.dirty = true;
  for (const w of db.workouts) w.dirty = true;
  saveData();
  bump();
  const s = await syncNow();
  return { ok: s.ok, status: 200, data: null, error: s.error };
}

/** Stops syncing. Everything stays on the phone. */
export function disconnectClaude() {
  db.link = emptyLink();
  db.deleted = [];
  saveData();
  bump();
}

let running: Promise<{ ok: boolean; error: string }> | null = null;
export function syncNow(): Promise<{ ok: boolean; error: string }> {
  if (!isLinked()) return Promise.resolve({ ok: false, error: 'Not connected' });
  if (running) return running;
  db.syncing = true;
  bump();
  running = run()
    .catch(() => 'Sync failed unexpectedly.')
    .then((error) => {
      db.syncing = false;
      db.link.error = error;
      if (!error) db.link.last_sync = Date.now();
      running = null;
      saveData();
      bump();
      return { ok: !error, error };
    });
  return running;
}

const fatal = (r: Reply) => r.status === 0 || r.status === 401 || r.status >= 500;
const ref = (id: string, fallback: string) => {
  const e = exercise(id);
  return { exercise_id: id, name: e?.name ?? fallback, muscle_group: e?.muscle_group ?? 'other', equipment: e?.equipment ?? 'other' };
};

/** The server has one notes field, so the check-in travels as a line of text an assistant can read. */
function notesWithCheckin(w: Workout): string {
  if (!w.checkin) return w.notes;
  const line = `Check-in: felt ${FEEL[w.checkin.feel - 1] ?? 'OK'}, energy ${ENERGY[w.checkin.energy - 1] ?? 'Normal'}.${w.checkin.note ? ` ${w.checkin.note}` : ''}`;
  return [w.notes, line].filter(Boolean).join('\n');
}

async function run(): Promise<string> {
  let res: Reply;
  if (db.link.push_unit) {
    res = await request('/api/me', 'PATCH', { unit: unit() });
    if (!res.ok) return res.error;
    db.link.push_unit = false;
  }
  for (const d of [...db.deleted]) {
    res = await request(`/api/${d.kind}s/${d.id}`, 'DELETE');
    if (fatal(res)) return res.error;
    db.deleted = db.deleted.filter((x) => x !== d); // gone, or was never there
  }
  for (const r of db.routines) {
    if (!r.dirty || !r.exercises.length) continue;
    res = await request(`/api/routines/${r.id}`, 'PUT', {
      name: r.name, folder: r.folder, notes: r.notes,
      exercises: r.exercises.map((e) => ({ ...ref(e.exercise_id, e.exercise_name), target_sets: e.target_sets, target_reps: e.target_reps, rest_seconds: e.rest_seconds, notes: e.notes })),
    });
    if (fatal(res)) return res.error;
    if (res.ok) r.dirty = false;
  }
  for (const w of db.workouts) {
    if (!w.dirty) continue;
    res = await request('/api/workouts', 'POST', {
      id: w.id, name: w.name, routine_id: w.routine_id, started_at: w.started_at, ended_at: w.ended_at, notes: notesWithCheckin(w), source: w.source,
      exercises: w.exercises.map((e) => ({ ...ref(e.exercise_id, e.exercise_name), sets: e.sets })),
    });
    if (fatal(res)) return res.error;
    if (res.ok) w.dirty = false;
  }
  res = await request('/api/sync' + (db.link.cursor ? `?since=${encodeURIComponent(db.link.cursor)}` : ''));
  if (!res.ok || !res.data) return res.error || 'Unexpected reply from the server.';
  merge(res.data);
  db.link.cursor = String(res.data.server_time ?? '');
  commitQuietly();
  return '';
}

let quiet = false;
function commitQuietly() {
  quiet = true; // the pull itself must not schedule another sync
  commit();
  quiet = false;
}

function merge(data: any) {
  // Custom exercises: add any created on the server side (for example by Claude).
  for (const e of (data.exercises ?? []) as Exercise[]) {
    if (!exercise(e.id)) db.customExercises.push({ ...e, secondary: [], instructions: [], custom: true });
  }
  // Routines: the server's copy wins (Claude may have edited it); unsent local edits are kept.
  const serverIds = new Set<string>();
  const merged: Routine[] = [];
  for (const r of data.routines ?? []) {
    serverIds.add(r.id);
    const local = routine(r.id);
    if (local?.dirty) { merged.push(local); continue; }
    merged.push({
      id: r.id, name: r.name, folder: r.folder ?? '', notes: r.notes ?? '', updated_at: r.updated_at,
      exercises: r.exercises.map((e: any) => ({
        exercise_id: e.exercise_id, exercise_name: exercise(e.exercise_id)?.name ?? e.exercise_name,
        target_sets: e.target_sets, target_reps: String(e.target_reps), rest_seconds: e.rest_seconds, notes: e.notes ?? '',
      })),
    });
  }
  for (const r of db.routines) if (!serverIds.has(r.id) && (r.dirty || !r.exercises.length)) merged.push(r);
  db.routines = merged;
  // Workouts: only ones the phone has never seen (the phone's own copy is the original).
  let added = false;
  for (const w of data.workouts ?? []) {
    if (workout(w.id)) continue;
    const fresh: Workout = {
      id: w.id, name: w.name, routine_id: w.routine_id ?? null, started_at: w.started_at, ended_at: w.ended_at, notes: w.notes ?? '', source: w.source ?? 'app',
      exercises: w.exercises.map((e: any) => ({
        exercise_id: e.exercise_id, exercise_name: e.exercise_name, muscle_group: e.muscle_group ?? 'other',
        sets: e.sets.map((s: any) => ({ set_type: s.set_type, weight_kg: s.weight_kg, reps: s.reps, rpe: s.rpe ?? null, prs: s.prs ?? [] })),
      })),
    };
    db.workouts.push(fresh);
    added = true;
  }
  if (added) db.workouts.sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
  for (const d of data.deleted ?? []) {
    if (d.kind === 'routine') db.routines = db.routines.filter((r) => r.id !== d.id || r.dirty);
    else if (d.kind === 'workout') db.workouts = db.workouts.filter((w) => w.id !== d.id);
  }
}

// Sync a few seconds after any change, on launch, and whenever the app comes back to the foreground.
let timer: ReturnType<typeof setTimeout> | null = null;
export function startAutoSync() {
  onCommit(() => {
    if (quiet || !isLinked()) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), 3000);
  });
  if (isLinked()) void syncNow();
  return AppState.addEventListener('change', (s) => {
    if (s === 'active' && isLinked()) void syncNow();
  });
}
