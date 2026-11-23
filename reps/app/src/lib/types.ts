export type Unit = 'kg' | 'lb';
export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';
export type PrKind = 'weight' | '1rm' | 'volume';

export interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  secondary: string[];
  equipment: string;
  instructions: string[];
  custom?: boolean;
  n?: number;
}

export interface RoutineExercise {
  exercise_id: string;
  exercise_name: string;
  target_sets: number;
  target_reps: string;
  rest_seconds: number;
  notes: string;
}
export interface Routine {
  id: string;
  name: string;
  folder: string;
  notes: string;
  updated_at: string;
  exercises: RoutineExercise[];
  dirty?: boolean;
}

export interface LoggedSet { set_type: SetType; weight_kg: number; reps: number; rpe: number | null; prs: PrKind[]; seconds?: number /* timed sets, e.g. a plank */ }
export interface LoggedExercise { exercise_id: string; exercise_name: string; muscle_group: string; sets: LoggedSet[] }
/** How a session felt, answered on the Coach tab. feel: 1 Rough .. 5 Great; energy: 1 Low .. 3 High. */
export interface Checkin { feel: number; energy: number; note: string }

export interface Workout {
  checkin?: Checkin;
  id: string;
  name: string;
  routine_id: string | null;
  started_at: string; // ISO, UTC
  ended_at: string;
  notes: string;
  source: 'app' | 'claude';
  exercises: LoggedExercise[];
  dirty?: boolean;
}

// The workout in progress. Weights are typed text in the user's unit until it is finished.
export interface ActiveSet { key: string; weight: string; reps: string; rpe: number | null; done: boolean; type: SetType }
export interface ActiveExercise {
  key: string;
  exercise_id: string;
  name: string;
  rest_seconds: number;
  target_reps: string;
  cue: string;
  coach?: string; // suggested target for today, from last session
  note: string;
  previous: LoggedSet[];
  sets: ActiveSet[];
}
export interface ActiveWorkout { name: string; routine_id: string | null; started_at: number; exercises: ActiveExercise[] }

export interface Settings {
  name: string; unit: Unit; folders: string[];
  accent?: string; // a key of ACCENTS in theme.ts
  length_unit?: 'cm' | 'in';
  default_rest?: number; // seconds, for exercises added outside a routine
  check_entries?: boolean; // ask before saving a set that is far outside your history (default on)
  record_resets?: Record<string, string>; // exercise id -> ISO time; personal bests count from here
}
/** One body measurement entry. Weight in kg, lengths in cm, like everything else stored. */
export interface Measure { id: string; date: string; weight_kg?: number; fat_percent?: number; parts?: Record<string, number> }
export interface Link { base_url: string; token: string; cursor: string; last_sync: number; error: string; push_unit: boolean }
export interface Tombstone { kind: 'routine' | 'workout'; id: string }
