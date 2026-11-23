// Working with exercise names: comparing them, and guessing what an unknown exercise trains.
import type { Exercise } from './types';

// Words that mean the same thing, so "Tricep Extension" and "Triceps Extension" compare equal.
const SAME: Record<string, string> = { bicep: 'biceps', tricep: 'triceps', raises: 'raise', curls: 'curl', rows: 'row', dips: 'dip', squats: 'squat', lunges: 'lunge', extensions: 'extension', shrugs: 'shrug', crunches: 'crunch', deadlifts: 'deadlift', flyes: 'fly', flys: 'fly', pullup: 'pull up', chinup: 'chin up', pushup: 'push up' };
export const wordList = (name: string) => [...new Set(name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').flatMap((t) => (SAME[t] ?? t).split(' ')))].sort();
/** Same words in any order, ignoring punctuation and plurals -> same key. */
export const words = (name: string) => wordList(name).join(' ');

/** Best guess at the main muscle from the name, for exercises the library does not have. First match wins. */
const MUSCLE_RULES: [RegExp, string, string[]][] = [
  [/treadmill|running|\brun\b|stair|ladder|cycling|\bbike\b|rowing machine|elliptical|stretch|walk\b/, 'other', []],
  [/calf/, 'calves', []],
  [/glute|hip thrust|rear kick|donkey kick/, 'glutes', ['hamstrings']],
  [/abduct/, 'abductors', []], [/adduct/, 'adductors', []],
  [/tricep|pushdown|skull|\bdip|jm press/, 'triceps', []],
  [/leg curl|hamstring/, 'hamstrings', []],
  [/wrist|forearm/, 'forearms', []],
  [/curl|\b21s?a?\b/, 'biceps', ['forearms']],
  [/pulldown|pull up|chin up|pullover|\blat\b/, 'lats', ['biceps']],
  [/shrug/, 'traps', []],
  [/rack pull|back extension|hyperextension/, 'lower back', ['glutes', 'hamstrings']],
  [/face pull|rear delt|reverse fly|lateral|delt|shoulder|overhead press|lu raise|front raise|external rotation|see saw/, 'shoulders', []],
  [/\brow\b/, 'middle back', ['biceps', 'lats']],
  [/chest|bench|butterfly|pec|\bfly\b|push up|press around/, 'chest', ['triceps', 'shoulders']],
  [/deadlift|rdl|good morning|pull through|swing/, 'hamstrings', ['glutes', 'lower back']],
  [/squat|leg press|lunge|leg extension|step up|\bextensions?\b/, 'quadriceps', ['glutes']],
  [/\babs?\b|crunch|sit ?up|plank|knee raise|leg raise|twist|hollow/, 'abdominals', []],
  [/raise/, 'shoulders', []],
  [/press/, 'shoulders', ['triceps']],
];
const EQUIPMENT: [RegExp, string][] = [[/smith|machine|assisted|plate/, 'machine'], [/cable|rope|pulldown|pushdown/, 'cable'], [/dumbbell/, 'dumbbell'], [/ez bar/, 'ez bar'], [/barbell|\bbar\b/, 'barbell'], [/kettle/, 'kettlebell'], [/band/, 'band']];

export function guess(name: string): Pick<Exercise, 'muscle_group' | 'secondary' | 'equipment'> {
  const n = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const m = MUSCLE_RULES.find(([re]) => re.test(n));
  return { muscle_group: m?.[1] ?? 'other', secondary: m?.[2] ?? [], equipment: EQUIPMENT.find(([re]) => re.test(n))?.[1] ?? 'other' };
}

// Words that say how or with what, not which movement. Two names that differ only in these are the same movement.
const HOW = new Set(['machine', 'cable', 'barbell', 'dumbbell', 'smith', 'plate', 'plated', 'loaded', 'rope', 'bar', 'ez', 'band', 'kettlebell', 'seated', 'standing', 'assisted', 'old', 'school', 'iso', 'lateral', 'single', 'arm', 'grip', 'wide', 'close', 'neutral', 'attachment', 'horizontal', 'base']);

/**
 * The library exercise that looks most like a custom one, to borrow its photos. Needs the same main muscle and
 * the same movement words; equipment and grip may differ. Only the picture is borrowed, never the history.
 */
export function lookalike(custom: Exercise, library: Exercise[]): Exercise | undefined {
  const mine = wordList(custom.name);
  const core = mine.filter((w) => !HOW.has(w));
  if (!core.length) return undefined;
  let best: Exercise | undefined, bestScore = 0;
  for (const e of library) {
    if (e.muscle_group !== custom.muscle_group) continue;
    const theirs = wordList(e.name);
    const theirCore = theirs.filter((w) => !HOW.has(w));
    if (theirCore.length !== core.length || !core.every((w) => theirCore.includes(w))) continue;
    const shared = mine.filter((w) => theirs.includes(w)).length;
    const score = shared / (mine.length + theirs.length - shared);
    if (score > bestScore) { best = e; bestScore = score; }
  }
  return best;
}
