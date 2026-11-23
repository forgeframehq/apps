// All app data lives on the phone: library, routines, workouts, settings. Nothing here needs a network.
// Connecting Claude (optional) mirrors the same data to a small server that Claude talks to; see sync.ts.
import { useSyncExternalStore } from 'react';

import { EXERCISE_ART } from '@/data/art';
import LIBRARY from '@/data/exercises.json';
import { FRAMES, THUMBS } from '@/data/images';

import { fromKg, isoNow, newId, toKg } from './format';
import { readJson, removeJson, writeJson } from './storage';
import type { ActiveExercise, ActiveSet, ActiveWorkout, Checkin, Exercise, Link, LoggedSet, PrKind, Routine, Settings, Tombstone, Unit, Workout } from './types';

export const emptyLink = (): Link => ({ base_url: '', token: '', cursor: '', last_sync: 0, error: '', push_unit: false });

export const db = {
  ready: false,
  settings: { name: '', unit: 'lb', folders: [] } as Settings,
  link: emptyLink(),
  customExercises: [] as Exercise[],
  routines: [] as Routine[],
  workouts: [] as Workout[], // newest first
  deleted: [] as Tombstone[], // waiting to be removed from the server
  active: null as ActiveWorkout | null,
  syncing: false,
};

export const library = LIBRARY as Exercise[];
const byId = new Map<string, Exercise>();
function reindex() {
  byId.clear();
  for (const e of library) byId.set(e.id, e);
  for (const e of db.customExercises) byId.set(e.id, e);
}
reindex();

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

let afterCommit: () => void = () => {};
/** sync.ts registers itself here so every change schedules an upload when Claude is connected. */
export const onCommit = (fn: () => void) => { afterCommit = fn; };

export function saveData() {
  writeJson('data', {
    settings: db.settings, link: db.link, customExercises: db.customExercises,
    routines: db.routines, workouts: db.workouts, deleted: db.deleted,
  });
}
export function commit() {
  reindex();
  saveData();
  bump();
  afterCommit();
}

let activeTimer: ReturnType<typeof setTimeout> | null = null;
export function saveActive() {
  if (activeTimer) clearTimeout(activeTimer);
  activeTimer = null;
  if (db.active) writeJson('active', db.active);
  else removeJson('active');
}
/** Call after editing the workout in progress. Re-renders now, saves shortly after. */
export function touch() {
  bump();
  if (!activeTimer) activeTimer = setTimeout(saveActive, 400);
}

export async function load() {
  const d = await readJson<any>('data');
  if (d && typeof d === 'object') {
    if (d.settings) Object.assign(db.settings, d.settings);
    if (d.link) Object.assign(db.link, d.link);
    for (const k of ['customExercises', 'routines', 'workouts', 'deleted'] as const) if (Array.isArray(d[k])) (db as any)[k] = d[k];
  }
  db.active = (await readJson<ActiveWorkout>('active')) ?? null;
  reindex();
  refreshNames();
  db.ready = true;
  bump();
}

// ---------- library ----------

/** Saved routines and workouts carry the exercise name they were logged with; bring them in line with the library after an update renames exercises. */
function refreshNames() {
  const current = (id: string, fallback: string) => byId.get(id)?.name ?? fallback;
  for (const r of db.routines) for (const e of r.exercises) e.exercise_name = current(e.exercise_id, e.exercise_name);
  for (const w of db.workouts) for (const e of w.exercises) e.exercise_name = current(e.exercise_id, e.exercise_name);
  for (const e of db.active?.exercises ?? []) e.name = current(e.exercise_id, e.name);
}

export const exercise = (id: string): Exercise | undefined => byId.get(id);
export const allExercises = (): Exercise[] => [...db.customExercises, ...library];
export const thumb = (id: string): number | undefined => EXERCISE_ART[id] ?? THUMBS[id];
export const frames = (id: string): number[] => FRAMES[id] ?? [];
const distinct = (pick: (e: Exercise) => string) => [...new Set(allExercises().map(pick))].sort();
export const muscles = () => distinct((e) => e.muscle_group);
export const equipmentTypes = () => distinct((e) => e.equipment);

export function createExercise(name: string, muscle_group: string, equipment: string, secondary: string[]): Exercise {
  const e: Exercise = { id: newId(), name: name.trim(), muscle_group, equipment, secondary, instructions: [], custom: true };
  db.customExercises.push(e);
  commit();
  return e;
}

// ---------- settings ----------

export const unit = (): Unit => db.settings.unit;
export function setUnit(u: Unit) {
  db.settings.unit = u;
  db.link.push_unit = true;
  commit();
}
export function setName(name: string) {
  db.settings.name = name.trim();
  commit();
}

// ---------- routines & folders ----------

export function folders(): string[] {
  return [...new Set([...db.settings.folders, ...db.routines.map((r) => r.folder)].filter(Boolean))];
}
export function addFolder(name: string) {
  const n = name.trim();
  if (n && !folders().includes(n)) {
    db.settings.folders.push(n);
    commit();
  }
}
const stamp = (r: Routine) => { r.updated_at = isoNow(); r.dirty = true; };
export function renameFolder(old: string, next: string) {
  const n = next.trim();
  if (!n || n === old) return;
  db.settings.folders = db.settings.folders.map((f) => (f === old ? n : f));
  for (const r of db.routines) if (r.folder === old) { r.folder = n; stamp(r); }
  commit();
}
/** Removes the folder; its routines move to the top level. */
export function deleteFolder(name: string) {
  db.settings.folders = db.settings.folders.filter((f) => f !== name);
  for (const r of db.routines) if (r.folder === name) { r.folder = ''; stamp(r); }
  commit();
}
export const routine = (id: string) => db.routines.find((r) => r.id === id);
export function saveRoutine(input: Omit<Routine, 'updated_at' | 'dirty'>) {
  const r: Routine = { ...input, id: input.id || newId(), updated_at: isoNow(), dirty: true };
  const i = db.routines.findIndex((x) => x.id === r.id);
  if (i >= 0) db.routines[i] = r;
  else db.routines.push(r);
  commit();
  return r;
}
export function duplicateRoutine(id: string) {
  const src = routine(id);
  if (src) saveRoutine({ ...JSON.parse(JSON.stringify(src)), id: '', name: `${src.name} (copy)` });
}
export function deleteRoutine(id: string) {
  db.routines = db.routines.filter((r) => r.id !== id);
  if (isLinked()) db.deleted.push({ kind: 'routine', id });
  commit();
}

// ---------- workouts & history ----------

export const workout = (id: string) => db.workouts.find((w) => w.id === id);
export function saveCheckin(id: string, checkin: Checkin) {
  const w = workout(id);
  if (!w) return;
  w.checkin = checkin;
  w.dirty = true; // so a connected assistant sees how the session felt
  commit();
}
export function deleteWorkout(id: string) {
  db.workouts = db.workouts.filter((w) => w.id !== id);
  if (isLinked()) db.deleted.push({ kind: 'workout', id });
  commit();
}
const allSets = (w: Workout) => w.exercises.flatMap((e) => e.sets);
export const workoutVolumeKg = (w: Workout) => allSets(w).reduce((a, s) => a + s.weight_kg * s.reps, 0);
export const workoutSetCount = (w: Workout) => allSets(w).length;
export const workoutReps = (w: Workout) => allSets(w).reduce((a, s) => a + s.reps, 0);
export const workoutMinutes = (w: Workout) => Math.round((Date.parse(w.ended_at) - Date.parse(w.started_at)) / 60000);
export const workoutRecords = (w: Workout) => allSets(w).reduce((a, s) => a + (s.prs?.length ?? 0), 0);
export const e1rm = (kg: number, reps: number) => (reps <= 0 ? 0 : reps === 1 ? kg : kg * (1 + reps / 30)); // Epley

/** Every session of one exercise, newest first. */
export function sessions(exId: string, skipWorkoutId = '') {
  const out: { workout: Workout; sets: LoggedSet[] }[] = [];
  for (const w of db.workouts) {
    if (w.id === skipWorkoutId) continue;
    const sets = w.exercises.filter((e) => e.exercise_id === exId).flatMap((e) => e.sets);
    if (sets.length) out.push({ workout: w, sets });
  }
  return out;
}
/** Sets from the most recent session, shown as "previous" while logging. */
export const previousSets = (exId: string): LoggedSet[] => JSON.parse(JSON.stringify(sessions(exId)[0]?.sets ?? []));

export interface Records {
  sessions: number;
  heaviest_kg: number;
  best_1rm_kg: number;
  best_set_kg: number;
  best_set_reps: number;
  best_set_volume_kg: number;
  best_session_volume_kg: number;
  set_records: { reps: number; kg: number }[];
  series: { t: number; heaviest: number; one: number; best_set: number; volume: number }[];
}
/** Personal records and the progress series for one exercise. */
export function records(exId: string, skipWorkoutId = ''): Records {
  const r: Records = { sessions: 0, heaviest_kg: 0, best_1rm_kg: 0, best_set_kg: 0, best_set_reps: 0, best_set_volume_kg: 0, best_session_volume_kg: 0, set_records: [], series: [] };
  const byReps = new Map<number, number>();
  for (const item of sessions(exId, skipWorkoutId).reverse()) { // oldest first, so the series reads left to right
    let heaviest = 0, one = 0, bestSet = 0, volume = 0;
    for (const s of item.sets) {
      volume += s.weight_kg * s.reps;
      if (s.set_type === 'warmup' || s.reps <= 0) continue;
      heaviest = Math.max(heaviest, s.weight_kg);
      one = Math.max(one, e1rm(s.weight_kg, s.reps));
      bestSet = Math.max(bestSet, s.weight_kg * s.reps);
      if (s.weight_kg * s.reps > r.best_set_volume_kg) {
        r.best_set_volume_kg = s.weight_kg * s.reps;
        r.best_set_kg = s.weight_kg;
        r.best_set_reps = s.reps;
      }
      if (s.weight_kg > 0 && s.weight_kg > (byReps.get(s.reps) ?? 0)) byReps.set(s.reps, s.weight_kg);
    }
    r.sessions++;
    r.heaviest_kg = Math.max(r.heaviest_kg, heaviest);
    r.best_1rm_kg = Math.max(r.best_1rm_kg, one);
    r.best_session_volume_kg = Math.max(r.best_session_volume_kg, volume);
    r.series.push({ t: Date.parse(item.workout.started_at), heaviest, one, best_set: bestSet, volume });
  }
  r.set_records = [...byReps.entries()].sort((a, b) => a[0] - b[0]).map(([reps, kg]) => ({ reps, kg }));
  return r;
}

/** Tags the sets in `w` that beat everything logged before it. A first session has nothing to beat. */
export function markRecords(w: Workout) {
  for (const s of allSets(w)) s.prs = [];
  for (const exId of new Set(w.exercises.map((e) => e.exercise_id))) {
    const prior = records(exId, w.id);
    if (!prior.sessions) continue;
    const mine = w.exercises.filter((e) => e.exercise_id === exId).flatMap((e) => e.sets).filter((s) => s.set_type !== 'warmup' && s.reps > 0 && s.weight_kg > 0);
    const check = (kind: PrKind, best: number, value: (s: LoggedSet) => number) => {
      const top = mine.reduce<LoggedSet | null>((a, s) => (!a || value(s) > value(a) ? s : a), null);
      if (top && value(top) > best + 1e-6) top.prs.push(kind);
    };
    check('weight', prior.heaviest_kg, (s) => s.weight_kg);
    check('1rm', prior.best_1rm_kg, (s) => e1rm(s.weight_kg, s.reps));
    check('volume', prior.best_set_volume_kg, (s) => s.weight_kg * s.reps);
  }
}

export function recentExerciseIds(limit = 8): string[] {
  const out: string[] = [];
  for (const w of db.workouts) for (const e of w.exercises) {
    if (!out.includes(e.exercise_id)) out.push(e.exercise_id);
    if (out.length >= limit) return out;
  }
  return out;
}

/** One bucket per week (Monday start, local time), oldest first. */
export function weekly(weeks = 12) {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const out = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7 * (weeks - 1 - i)).getTime();
    return { start, minutes: 0, volume_kg: 0, reps: 0, workouts: 0 };
  });
  for (const w of db.workouts) {
    const t = Date.parse(w.started_at);
    if (t < out[0].start) break; // newest first, so everything after this is older still
    let i = out.length - 1;
    while (i > 0 && out[i].start > t) i--;
    out[i].minutes += workoutMinutes(w);
    out[i].volume_kg += workoutVolumeKg(w);
    out[i].reps += workoutReps(w);
    out[i].workouts++;
  }
  return out;
}

export function stats(days: number) {
  const since = Date.now() - days * 86400000;
  const r = { workouts: 0, minutes: 0, volume_kg: 0, sets: 0, records: 0, muscles: [] as { name: string; sets: number }[], exercises: [] as { name: string; sets: number }[] };
  const byMuscle = new Map<string, number>();
  const byEx = new Map<string, number>();
  for (const w of db.workouts) {
    if (Date.parse(w.started_at) < since) break;
    r.workouts++;
    r.minutes += workoutMinutes(w);
    r.volume_kg += workoutVolumeKg(w);
    r.records += workoutRecords(w);
    for (const e of w.exercises) {
      const muscle = exercise(e.exercise_id)?.muscle_group ?? e.muscle_group ?? 'other';
      const n = e.sets.filter((s) => s.set_type !== 'warmup').length;
      r.sets += n;
      byMuscle.set(muscle, (byMuscle.get(muscle) ?? 0) + n);
      byEx.set(e.exercise_name, (byEx.get(e.exercise_name) ?? 0) + n);
    }
  }
  const rank = (m: Map<string, number>) => [...m.entries()].filter(([, sets]) => sets > 0).map(([name, sets]) => ({ name, sets })).sort((a, b) => b.sets - a.sets);
  r.muscles = rank(byMuscle);
  r.exercises = rank(byEx);
  return r;
}

// ---------- the workout in progress ----------

const blankSet = (): ActiveSet => ({ key: newId(), weight: '', reps: '', rpe: null, done: false, type: 'normal' });

function activeItem(exId: string, name: string, rest: number, targetReps: string, cue: string, setCount: number): ActiveExercise {
  const previous = previousSets(exId);
  const sets = Array.from({ length: Math.max(1, setCount) }, (_, i) => {
    const s = blankSet();
    // Outside a routine, carry warm-up markers over from last time so the layout matches what you actually do.
    if (!targetReps && previous[i]?.set_type === 'warmup') s.type = 'warmup';
    return s;
  });
  return { key: newId(), exercise_id: exId, name, rest_seconds: rest, target_reps: targetReps, cue, coach: coachHint(exId, targetReps), note: '', previous, sets };
}

let coachHint: (exId: string, targetReps: string) => string | undefined = () => undefined;
/** coach.ts registers its suggestion function here (it imports this module, so the link goes this way round). */
export const setCoachHint = (fn: typeof coachHint) => { coachHint = fn; };

export function startWorkout(r?: Routine) {
  db.active = {
    name: r?.name ?? 'Workout',
    routine_id: r?.id ?? null,
    started_at: Date.now(),
    exercises: (r?.exercises ?? []).map((e) => activeItem(e.exercise_id, e.exercise_name, e.rest_seconds, e.target_reps, e.notes ?? '', e.target_sets)),
  };
  saveActive();
  bump();
}
export function addExercise(ex: Exercise) {
  if (!db.active) return;
  db.active.exercises.push(activeItem(ex.id, ex.name, 0, '', '', Math.max(1, previousSets(ex.id).length)));
  touch();
}
export function discardWorkout() {
  db.active = null;
  saveActive();
  bump();
}
const typed = (text: string) => parseFloat(text.replace(',', '.')) || 0;
/** Live totals for the strip at the top of the workout screen. */
export function activeTotals() {
  let sets = 0, volumeKg = 0;
  for (const e of db.active?.exercises ?? []) for (const s of e.sets) if (s.done) {
    sets++;
    volumeKg += toKg(typed(s.weight), unit()) * (parseInt(s.reps, 10) || 0);
  }
  return { sets, volumeKg };
}
/** Saves the ticked sets as a workout. Returns it, or null if nothing was ticked. */
export function finishWorkout(): Workout | null {
  const a = db.active;
  if (!a) return null;
  const notes: string[] = [];
  const exercises = a.exercises
    .map((e) => {
      if (e.note.trim()) notes.push(`${e.name}: ${e.note.trim()}`);
      return {
        exercise_id: e.exercise_id,
        exercise_name: e.name,
        muscle_group: exercise(e.exercise_id)?.muscle_group ?? 'other',
        sets: e.sets.filter((s) => s.done).map((s): LoggedSet => ({ set_type: s.type, weight_kg: toKg(typed(s.weight), unit()), reps: parseInt(s.reps, 10) || 0, rpe: s.rpe, prs: [] })),
      };
    })
    .filter((e) => e.sets.length);
  if (!exercises.length) return null;
  const w: Workout = {
    id: newId(), name: a.name.trim() || 'Workout', routine_id: a.routine_id,
    started_at: isoNow(a.started_at), ended_at: isoNow(), notes: notes.join('\n'), source: 'app', exercises, dirty: true,
  };
  markRecords(w);
  db.workouts.unshift(w);
  db.active = null;
  saveActive();
  commit();
  return w;
}

// ---------- backup ----------

export const isLinked = () => db.link.token !== '';
export function exportBackup(): string {
  return JSON.stringify({ app: 'Reps', exported_at: isoNow(), settings: db.settings, customExercises: db.customExercises, routines: db.routines, workouts: db.workouts });
}
/** Merges a backup (from Reps or ForgeLift) into what is already here. Returns how many workouts were added. */
export function importBackup(text: string): number {
  const b = JSON.parse(text);
  if (!b || !Array.isArray(b.workouts)) throw new Error('That does not look like a backup.');
  let added = 0;
  for (const e of b.customExercises ?? b.custom_exercises ?? []) if (e?.id && !byId.has(e.id)) db.customExercises.push({ secondary: [], instructions: [], ...e, custom: true });
  for (const r of b.routines ?? []) if (r?.id && !routine(r.id)) db.routines.push({ ...r, dirty: true });
  for (const w of b.workouts) if (w?.id && !workout(w.id)) { db.workouts.push({ ...w, dirty: true }); added++; }
  db.workouts.sort((x, y) => (x.started_at < y.started_at ? 1 : -1));
  if (!db.settings.name && b.settings?.name) db.settings.name = b.settings.name;
  commit();
  return added;
}

export const displayWeight = (kg: number) => fromKg(kg, unit());
