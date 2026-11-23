// The built-in coach. Everything here is worked out on the phone from your own history: no AI, no network.
// It reviews the last session, suggests targets for the next one, and watches consistency and balance.
import { cap, fmtWeight, fromKg, trimNum } from './format';
import { db, e1rm, exercise, records, routine, sessions, setCoachHint, unit, weekly, workoutVolumeKg } from './store';
import type { LoggedSet, Routine, Workout } from './types';

export const FEEL = ['Rough', 'Hard', 'OK', 'Good', 'Great'];
export const ENERGY = ['Low', 'Normal', 'High'];

const working = (sets: LoggedSet[]) => sets.filter((s) => s.set_type !== 'warmup' && s.reps > 0);

/** "8-12" -> 8..12, "5" -> 5..5, anything else (AMRAP, blank) -> null. */
function repRange(text: string): { low: number; high: number } | null {
  const m = text.trim().match(/^(\d+)\s*(?:-|to)\s*(\d+)$/i) ?? text.trim().match(/^(\d+)$/);
  if (!m) return null;
  const low = parseInt(m[1], 10);
  const high = parseInt(m[2] ?? m[1], 10);
  return low > 0 && high >= low ? { low, high } : null;
}

/** Smallest sensible jump: bigger for barbell and machine leg work. */
function step(exId: string): number {
  const e = exercise(exId);
  const legs = ['quadriceps', 'hamstrings', 'glutes'].includes(e?.muscle_group ?? '') && ['barbell', 'machine'].includes(e?.equipment ?? '');
  return unit() === 'lb' ? (legs ? 10 : 5) : legs ? 5 : 2.5;
}

export interface Suggestion { last: string; next: string; why: string }

/**
 * Double progression: stay at a weight until every set reaches the top of the rep range, then add weight.
 * Uses the heaviest weight from the last session and holds back if that session was a grind.
 */
export function suggest(exId: string, targetReps: string): Suggestion | null {
  const lastSession = sessions(exId)[0];
  const sets = lastSession ? working(lastSession.sets) : [];
  if (!sets.length) return null;
  const u = unit();
  const topKg = Math.max(...sets.map((s) => s.weight_kg));
  const top = sets.filter((s) => s.weight_kg === topKg);
  const w = fromKg(topKg, u);
  const reps = top.map((s) => s.reps);
  const sameWeight = sets.every((s) => s.weight_kg === topKg);
  const last = sameWeight ? `${trimNum(w)} ${u} x ${reps.join(', ')}` : sets.map((s) => `${fmtWeight(s.weight_kg, u)}x${s.reps}`).join(', ');
  if (topKg <= 0) return { last: `${reps.join(', ')} reps`, next: `Beat ${Math.max(...reps)} reps`, why: 'Bodyweight: add a rep.' };

  const grind = top.some((s) => (s.rpe ?? 0) >= 9.5) || (lastSession.workout.checkin?.feel ?? 3) <= 1;
  const range = repRange(targetReps) ?? { low: Math.min(...reps), high: Math.min(...reps) + 2 };
  const span = range.low === range.high ? String(range.low) : `${range.low}-${range.high}`;
  if (grind) return { last, next: `${trimNum(w)} ${u} x ${span}`, why: 'Last time was a grind, so repeat it before adding.' };
  if (reps.every((r) => r >= range.high)) return { last, next: `${trimNum(w + step(exId))} ${u} x ${span}`, why: `Every set hit ${range.high}, so add weight.` };
  if (reps.some((r) => r < range.low)) return { last, next: `${trimNum(w)} ${u}, ${range.low} on every set`, why: `Some sets fell short of ${range.low}.` };
  return { last, next: `${trimNum(w)} ${u}, add a rep`, why: `Work up to ${range.high} on every set, then add weight.` };
}
setCoachHint((exId, targetReps) => suggest(exId, targetReps)?.next);

export interface ReviewRow { name: string; now: string; before: string; dir: -1 | 0 | 1 }

/** Compares a workout with the previous run of the same routine (or the same name). */
export function review(w: Workout) {
  const older = db.workouts.slice(db.workouts.indexOf(w) + 1);
  const prev = older.find((x) => (w.routine_id ? x.routine_id === w.routine_id : false)) ?? older.find((x) => x.name === w.name);
  const u = unit();
  const best = (sets: LoggedSet[]) => working(sets).reduce<LoggedSet | null>((a, s) => (!a || e1rm(s.weight_kg, s.reps) > e1rm(a.weight_kg, a.reps) ? s : a), null);
  const show = (s: LoggedSet) => (s.weight_kg > 0 ? `${fmtWeight(s.weight_kg, u)} x ${s.reps}` : `${s.reps} reps`);
  const rows: ReviewRow[] = [];
  for (const e of w.exercises) {
    const now = best(e.sets);
    const was = prev ? best(prev.exercises.filter((x) => x.exercise_id === e.exercise_id).flatMap((x) => x.sets)) : null;
    if (!now) continue;
    const a = now.weight_kg > 0 ? e1rm(now.weight_kg, now.reps) : now.reps;
    const b = was ? (was.weight_kg > 0 ? e1rm(was.weight_kg, was.reps) : was.reps) : a;
    rows.push({ name: e.exercise_name, now: show(now), before: was ? show(was) : '', dir: a > b + 1e-6 ? 1 : a < b - 1e-6 ? -1 : 0 });
  }
  const v = workoutVolumeKg(w);
  const pv = prev ? workoutVolumeKg(prev) : 0;
  return { prev, rows, volumeChange: pv > 0 ? Math.round(((v - pv) / pv) * 100) : null };
}

/** The routine to do next: the one after the last-used routine in its folder, else the one done longest ago. */
export function upNext(): Routine | null {
  const usable = db.routines.filter((r) => r.exercises.length);
  if (!usable.length) return null;
  const lastUsed = db.workouts.map((w) => (w.routine_id ? routine(w.routine_id) : undefined)).find((r) => r && r.exercises.length);
  if (lastUsed?.folder) {
    const group = usable.filter((r) => r.folder === lastUsed.folder);
    if (group.length > 1) return group[(group.indexOf(lastUsed) + 1) % group.length];
  }
  const lastDone = (r: Routine) => db.workouts.find((w) => w.routine_id === r.id)?.started_at ?? '';
  return [...usable].sort((a, b) => (lastDone(a) < lastDone(b) ? -1 : 1))[0];
}

/** This week against your recent normal, plus how many weeks in a row you have trained. */
export function week() {
  const weeks = weekly(26);
  const now = weeks[weeks.length - 1];
  const recent = weeks.slice(-5, -1);
  const usual = recent.reduce((a, w) => a + w.workouts, 0) / recent.length;
  let streak = 0;
  for (let i = weeks.length - (now.workouts ? 1 : 2); i >= 0 && weeks[i].workouts > 0; i--) streak++;
  return { sessions: now.workouts, usual: Math.round(usual * 10) / 10, streak };
}

/** Things worth a look: muscle groups you usually train but have not lately, and lifts with no new best in three sessions. */
export function watchList(): string[] {
  const out: string[] = [];
  const day = 86400000;
  const sets = new Map<string, number>();
  const lastTrained = new Map<string, number>();
  const recentExercises = new Map<string, string>();
  for (const w of db.workouts) {
    const t = Date.parse(w.started_at);
    if (t < Date.now() - 28 * day) break;
    for (const e of w.exercises) {
      const muscle = exercise(e.exercise_id)?.muscle_group ?? e.muscle_group;
      sets.set(muscle, (sets.get(muscle) ?? 0) + working(e.sets).length);
      if (!lastTrained.has(muscle)) lastTrained.set(muscle, t);
      recentExercises.set(e.exercise_id, e.exercise_name);
    }
  }
  for (const [muscle, n] of sets) {
    const days = Math.floor((Date.now() - (lastTrained.get(muscle) ?? 0)) / day);
    if (n >= 6 && days >= 9) out.push(`${cap(muscle)}: ${days} days since you trained them.`);
  }
  for (const [id, name] of recentExercises) {
    const series = records(id).series.map((p) => p.one);
    if (series.length < 5) continue;
    const before = Math.max(...series.slice(0, -3));
    if (before > 0 && Math.max(...series.slice(-3)) <= before + 1e-6) out.push(`${name}: no new best in your last 3 sessions.`);
    if (out.length >= 5) break;
  }
  return out.slice(0, 5);
}
