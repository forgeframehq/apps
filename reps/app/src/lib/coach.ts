// The built-in coach. Everything here is worked out on the phone from your own history: no AI, no network.
// It reviews the last session, suggests targets for the next one, and watches consistency and balance.
import { cap, fmtDate, fmtMinutes, fmtVolume, fmtWeight, fromKg, MONTH_NAMES, plural, trimNum } from './format';
import { db, e1rm, exercise, records, routine, sessions, setCoachHint, unit, weekly, workoutMinutes, workoutRecords, workoutVolumeKg } from './store';
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
  for (const w of db.workouts) {
    const t = Date.parse(w.started_at);
    if (t < Date.now() - 28 * day) break;
    for (const e of w.exercises) {
      const muscle = exercise(e.exercise_id)?.muscle_group ?? e.muscle_group;
      sets.set(muscle, (sets.get(muscle) ?? 0) + working(e.sets).length);
      if (!lastTrained.has(muscle)) lastTrained.set(muscle, t);
    }
  }
  for (const [muscle, n] of sets) {
    const days = Math.floor((Date.now() - (lastTrained.get(muscle) ?? 0)) / day);
    if (n >= 6 && days >= 9) out.push(`${cap(muscle)}: ${days} days since you trained them.`);
  }
  for (const l of liftStatus()) if (l.status !== 'up') out.push(`${l.name}: ${l.detail}`);
  return out.slice(0, 5);
}

// ---------- lift trends, deload, monthly report ----------

const DAY = 86400000;
export interface LiftStatus { id: string; name: string; status: 'up' | 'stalled' | 'slipping'; detail: string }

/**
 * Where each regular lift is heading, judged on estimated 1-rep max so more reps at the same weight still counts.
 * Needs 5 sessions of a lift, at least one in the last 6 weeks. Stalled = the last 3 sessions set no new best.
 */
export function liftStatus(): LiftStatus[] {
  const out: LiftStatus[] = [];
  const seen = new Set<string>();
  const u = unit();
  for (const w of db.workouts) {
    if (Date.parse(w.started_at) < Date.now() - 42 * DAY) break;
    for (const e of w.exercises) {
      if (seen.has(e.exercise_id)) continue;
      seen.add(e.exercise_id);
      const series = records(e.exercise_id).series.map((p) => p.one);
      if (series.length < 5) continue;
      const before = Math.max(...series.slice(0, -3));
      const recent = Math.max(...series.slice(-3));
      if (before <= 0) continue;
      const pct = Math.round(((recent - before) / before) * 100);
      if (recent > before + 1e-6) out.push({ id: e.exercise_id, name: e.exercise_name, status: 'up', detail: `est. max ${fmtWeight(recent, u)} ${u}, up ${Math.max(1, pct)}% on your earlier best.` });
      else if (recent < before * 0.95) out.push({ id: e.exercise_id, name: e.exercise_name, status: 'slipping', detail: `down ${-pct}% from your best. Drop the weight about 10% and build back up.` });
      else out.push({ id: e.exercise_id, name: e.exercise_name, status: 'stalled', detail: 'no new best in your last 3 sessions. Try a different rep range, or a close variation for a few weeks.' });
    }
  }
  const order = { slipping: 0, stalled: 1, up: 2 };
  return out.sort((a, b) => order[a.status] - order[b.status]);
}

/** Suggests a lighter week when the signs of fatigue stack up. One hard check-in streak is enough; otherwise it takes two signs. */
export function deload(): { suggest: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const checked = db.workouts.filter((w) => w.checkin).slice(0, 4);
  const hard = checked.filter((w) => (w.checkin?.feel ?? 3) <= 2).length;
  const tired = checked.length >= 3 && hard >= 3;
  if (tired) reasons.push(`${hard} of your last ${checked.length} check-ins were Hard or Rough.`);
  const stuck = liftStatus().filter((l) => l.status !== 'up').length;
  if (stuck >= 3) reasons.push(`${stuck} lifts have stopped moving.`);
  // Weeks trained in a row with no lighter week (a week under 60% of the run's average volume counts as lighter).
  const weeks = weekly(16).slice(0, -1).reverse(); // finished weeks, newest first
  const run = [];
  for (const w of weeks) { if (!w.workouts) break; run.push(w.volume_kg); }
  const avg = run.reduce((a, v) => a + v, 0) / (run.length || 1);
  const sinceLight = run.findIndex((v) => v < avg * 0.6);
  const hardWeeks = sinceLight < 0 ? run.length : sinceLight;
  if (hardWeeks >= 8) reasons.push(`${hardWeeks} weeks of training without a lighter one.`);
  return { suggest: tired || reasons.length >= 2, reasons };
}

const PUSH = ['chest', 'shoulders', 'triceps'];
const PULL = ['lats', 'middle back', 'biceps', 'traps', 'lower back', 'forearms'];
const LEGS = ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'];
const MAJOR = ['chest', 'shoulders', 'lats', 'middle back', 'quadriceps', 'hamstrings', 'glutes', 'biceps', 'triceps', 'abdominals'];

interface Totals { workouts: number; minutes: number; volume_kg: number; sets: number; records: number; days: number; muscles: Map<string, number>; feel: number[] }
/** Totals for workouts started in [from, to). A set counts fully for its main muscle and half for each secondary one. */
function totals(from: number, to: number): Totals {
  const t: Totals = { workouts: 0, minutes: 0, volume_kg: 0, sets: 0, records: 0, days: 0, muscles: new Map(), feel: [] };
  const days = new Set<string>();
  for (const w of db.workouts) {
    const at = Date.parse(w.started_at);
    if (at < from) break;
    if (at >= to) continue;
    t.workouts++;
    t.minutes += workoutMinutes(w);
    t.volume_kg += workoutVolumeKg(w);
    t.records += workoutRecords(w);
    days.add(new Date(at).toDateString());
    if (w.checkin) t.feel.push(w.checkin.feel);
    for (const e of w.exercises) {
      const ex = exercise(e.exercise_id);
      const n = working(e.sets).length;
      t.sets += n;
      const add = (m: string, v: number) => t.muscles.set(m, (t.muscles.get(m) ?? 0) + v);
      add(ex?.muscle_group ?? e.muscle_group ?? 'other', n);
      for (const m of ex?.secondary ?? []) add(m, n / 2);
    }
  }
  t.days = days.size;
  return t;
}

export interface Change { now: number; before: number; pct: number | null }
const change = (now: number, before: number): Change => ({ now, before, pct: before > 0 ? Math.round(((now - before) / before) * 100) : null });

export interface MuscleRow { name: string; sets: number; before: number; perWeek: number; level: 'Light' | 'Steady' | 'Growth range' | 'Very high' }
export interface LiftGain { id: string; name: string; best: string; pct: number }

/**
 * The report for one calendar month (0 = this month, 1 = last month...).
 * The month in progress is compared with the same number of days of the month before, so a half month is not judged against a whole one.
 */
export function monthReport(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
  const partial = offset === 0;
  const to = partial ? Date.now() : end.getTime();
  const prevTo = partial ? Math.min(start.getTime(), prevStart.getTime() + (to - start.getTime())) : start.getTime();
  const t = totals(start.getTime(), to);
  const p = totals(prevStart.getTime(), prevTo);
  const weeksSpan = Math.max(1, (to - start.getTime()) / (7 * DAY));
  const u = unit();

  const level = (perWeek: number): MuscleRow['level'] => (perWeek < 5 ? 'Light' : perWeek < 10 ? 'Steady' : perWeek <= 20 ? 'Growth range' : 'Very high');
  const names = new Set([...t.muscles.keys(), ...p.muscles.keys(), ...(t.workouts ? MAJOR : [])]);
  const muscles: MuscleRow[] = [...names].map((name) => {
    const sets = t.muscles.get(name) ?? 0;
    return { name, sets: Math.round(sets), before: Math.round(p.muscles.get(name) ?? 0), perWeek: Math.round((sets / weeksSpan) * 10) / 10, level: level(sets / weeksSpan) };
  }).sort((a, b) => b.sets - a.sets);

  const group = (list: string[]) => list.reduce((a, m) => a + (t.muscles.get(m) ?? 0), 0);
  const split = { push: Math.round(group(PUSH)), pull: Math.round(group(PULL)), legs: Math.round(group(LEGS)) };

  // Lifts whose best estimated max this month beat everything before the month began.
  const gains: LiftGain[] = [];
  const done = new Set<string>();
  for (const w of db.workouts) {
    const at = Date.parse(w.started_at);
    if (at < start.getTime()) break;
    if (at >= to) continue;
    for (const e of w.exercises) {
      if (done.has(e.exercise_id)) continue;
      done.add(e.exercise_id);
      let best: LoggedSet | null = null, prior = 0;
      for (const sess of sessions(e.exercise_id)) {
        const st = Date.parse(sess.workout.started_at);
        if (st >= to) continue;
        for (const x of working(sess.sets)) {
          const v = e1rm(x.weight_kg, x.reps);
          if (st < start.getTime()) prior = Math.max(prior, v);
          else if (!best || v > e1rm(best.weight_kg, best.reps)) best = x;
        }
      }
      if (!best || prior <= 0) continue;
      const pct = Math.round(((e1rm(best.weight_kg, best.reps) - prior) / prior) * 100);
      if (pct >= 1) gains.push({ id: e.exercise_id, name: e.exercise_name, best: `${fmtWeight(best.weight_kg, u)} ${u} x ${best.reps}`, pct });
    }
  }
  gains.sort((a, b) => b.pct - a.pct);

  // Plain-sentence takeaways, most useful first.
  const notes: string[] = [];
  const than = partial ? 'than at this point last month' : 'than the month before';
  if (t.workouts && p.workouts) {
    const d = t.workouts - p.workouts;
    notes.push(d === 0 ? `Same number of workouts as ${partial ? 'at this point last month' : 'the month before'}: ${t.workouts}.` : `${plural(Math.abs(d), 'workout')} ${d > 0 ? 'more' : 'fewer'} ${than}.`);
    const v = change(t.volume_kg, p.volume_kg).pct;
    if (v !== null && Math.abs(v) >= 5) notes.push(`Total volume is ${v > 0 ? 'up' : 'down'} ${Math.abs(v)}%.`);
  }
  if (gains.length) notes.push(`Biggest mover: ${gains[0].name}, up ${gains[0].pct}% (${gains[0].best}).`);
  if (t.workouts) {
    const top = muscles[0];
    if (top?.sets) notes.push(`Most trained: ${cap(top.name)}, about ${trimNum(top.perWeek, 1)} sets a week.`);
    const missed = muscles.filter((m) => MAJOR.includes(m.name) && m.sets === 0).map((m) => cap(m.name));
    if (missed.length) notes.push(`No direct work for ${missed.slice(0, 3).join(', ')}${missed.length > 3 ? ` and ${missed.length - 3} more` : ''}.`);
    if (split.pull > 0 && split.push > split.pull * 1.5) notes.push(`Pushing outweighs pulling ${trimNum(split.push / split.pull, 1)} to 1. Add rows or pulldowns to even it out.`);
    else if (split.push > 0 && split.pull > split.push * 1.5) notes.push(`Pulling outweighs pushing ${trimNum(split.pull / split.push, 1)} to 1. Add some pressing to even it out.`);
    else if (split.push + split.pull >= 12 && (split.push === 0 || split.pull === 0)) notes.push(split.pull === 0 ? 'All pushing and no pulling this month. Add rows or pulldowns.' : 'All pulling and no pushing this month. Add some pressing.');
    const all = split.push + split.pull + split.legs;
    if (all >= 20 && split.legs / all < 0.2) notes.push(`Legs got ${Math.round((split.legs / all) * 100)}% of your sets.`);
    if (t.feel.length >= 3) notes.push(`Sessions felt ${FEEL[Math.round(t.feel.reduce((a, f) => a + f, 0) / t.feel.length) - 1].toLowerCase()} on average.`);
  }

  // Volume for this and the five months before it, for the trend chart.
  const trend = Array.from({ length: 6 }, (_, i) => {
    const a = new Date(start.getFullYear(), start.getMonth() - (5 - i), 1);
    const b = new Date(a.getFullYear(), a.getMonth() + 1, 1);
    return { label: MONTH_NAMES[a.getMonth()].slice(0, 3), volume_kg: totals(a.getTime(), b.getTime()).volume_kg };
  });

  return {
    title: `${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`, partial, compared: partial ? 'vs this point last month' : 'vs the month before', hasBefore: p.workouts > 0,
    workouts: change(t.workouts, p.workouts), minutes: change(t.minutes, p.minutes), volume: change(t.volume_kg, p.volume_kg),
    sets: change(t.sets, p.sets), records: change(t.records, p.records), days: change(t.days, p.days),
    muscles, split, gains: gains.slice(0, 5), notes: notes.slice(0, 6), trend,
    older: db.workouts.some((w) => Date.parse(w.started_at) < start.getTime()),
  };
}
export type MonthReport = ReturnType<typeof monthReport>;

/** A workout as plain text, for sharing into any assistant or chat. */
export function shareText(w: Workout): string {
  const u = unit();
  const lines = [`${w.name} - ${fmtDate(w.started_at)}, ${fmtMinutes(workoutMinutes(w))}, ${fmtVolume(workoutVolumeKg(w), u)} volume (logged in Reps)`];
  for (const e of w.exercises) {
    const sets = e.sets.filter((s) => s.reps > 0).map((s) => `${s.weight_kg > 0 ? `${fmtWeight(s.weight_kg, u)}x` : ''}${s.reps}${s.set_type === 'warmup' ? ' (warm-up)' : ''}${s.rpe ? ` @${s.rpe}` : ''}`);
    if (sets.length) lines.push(`${e.exercise_name}: ${sets.join(', ')}${e.sets.some((s) => s.weight_kg > 0) ? ` ${u}` : ''}`);
  }
  if (w.checkin) lines.push(`Check-in: felt ${FEEL[w.checkin.feel - 1]}, energy ${ENERGY[w.checkin.energy - 1]}.${w.checkin.note ? ` ${w.checkin.note}` : ''}`);
  if (w.notes) lines.push(`Notes: ${w.notes}`);
  lines.push('', 'How did this session look, and what should I change next time?');
  return lines.join('\n');
}
