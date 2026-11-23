// Imports the CSV files Hevy exports (workout_data.csv and measurement_data.csv). Runs on the phone.
// Exercises that match the Reps library by name are linked to it; the rest come in as custom exercises under your own names.
import { KG_PER_LB } from './format';
import { guess, words } from './names';
import { allExercises, commit, db, recomputeRecords } from './store';
import type { Exercise, LoggedExercise, LoggedSet, Measure, SetType, Workout } from './types';

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift() ?? [];
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ''])));
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** "22 Nov 2026, 18:48" in the phone's time zone -> ISO UTC. */
function parseDate(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2}) (\w{3})\w* (\d{4}),? (\d{1,2}):(\d{2})/);
  const month = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1;
  if (!m || month < 0) return null;
  return new Date(+m[3], month, +m[1], +m[4], +m[5]).toISOString().replace(/\.\d{3}Z$/, 'Z');
}
const num = (v: string | undefined) => { const n = parseFloat(v ?? ''); return Number.isFinite(n) ? n : 0; };

/** Stable id from the workout's start and title, so importing the same file twice adds nothing. */
function stableId(text: string): string {
  let a = 0x811c9dc5, b = 0x1b873593;
  for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619) >>> 0; b = Math.imul(b + text.charCodeAt(i), 2246822519) >>> 0; }
  return ('hv' + a.toString(36) + b.toString(36) + text.length.toString(36)).padEnd(20, '0').slice(0, 20);
}

const TYPES: Record<string, SetType> = { normal: 'normal', warmup: 'warmup', failure: 'failure', dropset: 'drop', drop: 'drop' };

export interface ImportResult { kind: 'workouts' | 'measures'; added: number; skipped: number; matched: number; custom: number; routines: number; first?: string; last?: string }

/** Works out which Hevy file this is from its header and imports it. Throws if it is neither. */
export function importHevy(text: string): ImportResult {
  const rows = parseCsv(text);
  const head = Object.keys(rows[0] ?? {});
  if (head.includes('exercise_title') && head.includes('start_time')) return importWorkouts(rows);
  if (head.includes('date') && head.some((h) => h.startsWith('weight_'))) return importMeasures(rows);
  throw new Error('Not a Hevy export');
}

function importWorkouts(rows: Record<string, string>[]): ImportResult {
  const lb = 'weight_lbs' in rows[0];
  const byWords = new Map<string, Exercise>();
  for (const e of [...allExercises()].reverse()) byWords.set(words(e.name), e); // library wins over custom on a tie
  let matched = 0, custom = 0;
  const seen = new Set<string>();
  const find = (name: string): Exercise => {
    const key = words(name);
    let e = byWords.get(key);
    if (!e) {
      e = { id: stableId('ex|' + key), name: name.trim(), instructions: [], custom: true, ...guess(name) };
      db.customExercises.push(e);
      byWords.set(key, e);
    }
    if (!seen.has(key)) { seen.add(key); if (e.custom) custom++; else matched++; }
    return e;
  };

  const groups = new Map<string, Record<string, string>[]>();
  for (const r of rows) {
    const key = `${r.start_time}|${r.title}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const have = new Set(db.workouts.map((w) => w.id));
  const fresh: Workout[] = [];
  let skipped = 0;
  for (const [key, list] of groups) {
    const started = parseDate(list[0].start_time);
    if (!started) { skipped++; continue; }
    const id = stableId(key);
    if (have.has(id)) { skipped++; continue; }
    const exercises: LoggedExercise[] = [];
    const notes: string[] = list[0].description?.trim() ? [list[0].description.trim()] : [];
    for (const r of list) {
      const ex = find(r.exercise_title);
      let item = exercises[exercises.length - 1];
      if (!item || item.exercise_id !== ex.id) {
        item = { exercise_id: ex.id, exercise_name: ex.name, muscle_group: ex.muscle_group, sets: [] };
        exercises.push(item);
        if (r.exercise_notes?.trim()) notes.push(`${ex.name}: ${r.exercise_notes.trim()}`);
      }
      const reps = Math.round(num(r.reps)), seconds = Math.round(num(r.duration_seconds));
      if (reps <= 0 && seconds <= 0) continue;
      const set: LoggedSet = { set_type: TYPES[r.set_type] ?? 'normal', weight_kg: num(lb ? r.weight_lbs : r.weight_kg) * (lb ? KG_PER_LB : 1), reps, rpe: num(r.rpe) || null, prs: [] };
      if (seconds > 0) set.seconds = seconds;
      item.sets.push(set);
    }
    const kept = exercises.filter((e) => e.sets.length);
    if (!kept.length) { skipped++; continue; }
    fresh.push({ id, name: list[0].title.trim() || 'Workout', routine_id: null, started_at: started, ended_at: parseDate(list[0].end_time) ?? started, notes: notes.join('\n'), source: 'app', exercises: kept, dirty: true });
  }
  db.workouts = [...db.workouts, ...fresh].sort((a, b) => (a.started_at < b.started_at ? 1 : -1));

  // Hevy's export has no routines, so rebuild them from the latest run of each workout name in the last 6 weeks.
  let routines = 0;
  const cutoff = new Date(Date.now() - 42 * 86400000).toISOString();
  const names = new Set<string>();
  for (const w of fresh.sort((a, b) => (a.started_at < b.started_at ? 1 : -1))) {
    // One-off sessions ("Evening workout") are not routines: the name has to have been used at least twice.
    if (w.started_at < cutoff || names.has(w.name) || db.routines.some((r) => r.name === w.name) || db.workouts.filter((x) => x.name === w.name).length < 2 || /^(morning|midday|lunch|afternoon|evening|night)\b.*workout/i.test(w.name)) continue; // the last one is Hevy's default name for an unplanned session
    names.add(w.name);
    const rid = stableId('routine|' + w.name);
    db.routines.push({
      id: rid, name: w.name, folder: 'From Hevy', notes: '', updated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), dirty: true,
      exercises: w.exercises.map((e) => {
        const work = e.sets.filter((s) => s.set_type !== 'warmup');
        return { exercise_id: e.exercise_id, exercise_name: e.exercise_name, target_sets: Math.max(1, work.length), target_reps: String((work[0] ?? e.sets[0]).reps || ''), rest_seconds: db.settings.default_rest ?? 120, notes: '' };
      }),
    });
    routines++;
  }
  // Link past workouts to their routine so the coach can compare like with like and cycle through them.
  for (const w of db.workouts) if (!w.routine_id) { const r = db.routines.find((x) => x.folder === 'From Hevy' && x.name === w.name); if (r) w.routine_id = r.id; }

  recomputeRecords();
  commit();
  const times = fresh.map((w) => w.started_at).sort();
  return { kind: 'workouts', added: fresh.length, skipped, matched, custom, routines, first: times[0], last: times[times.length - 1] };
}

function importMeasures(rows: Record<string, string>[]): ImportResult {
  let added = 0, skipped = 0;
  for (const r of rows) {
    const date = parseDate(r.date);
    if (!date) { skipped++; continue; }
    const id = stableId('m|' + r.date);
    if (db.measures.some((m) => m.id === id)) { skipped++; continue; }
    const m: Measure = { id, date, parts: {} };
    for (const [k, v] of Object.entries(r)) {
      const n = num(v);
      if (!n) continue;
      if (k === 'weight_lbs') m.weight_kg = n * KG_PER_LB;
      else if (k === 'weight_kg') m.weight_kg = n;
      else if (k === 'fat_percent') m.fat_percent = n;
      else if (k.endsWith('_cm')) m.parts![k.slice(0, -3)] = n;
      else if (k.endsWith('_in')) m.parts![k.slice(0, -3)] = n * 2.54;
    }
    if (m.weight_kg || m.fat_percent || Object.keys(m.parts!).length) { db.measures.push(m); added++; } else skipped++;
  }
  db.measures.sort((a, b) => (a.date < b.date ? 1 : -1));
  recomputeRecords(); // body weight is what lets assisted lifts be scored
  commit();
  return { kind: 'measures', added, skipped, matched: 0, custom: 0, routines: 0 };
}
