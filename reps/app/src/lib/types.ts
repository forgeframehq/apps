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

export interface LoggedSet { set_type: SetType; weight_kg: number; reps: number; rpe: number | null; prs: PrKind[] }
export interface LoggedExercise { exercise_id: string; exercise_name: string; muscle_group: string; sets: LoggedSet[] }
export interface Workout {
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
  note: string;
  previous: LoggedSet[];
  sets: ActiveSet[];
}
export interface ActiveWorkout { name: string; routine_id: string | null; started_at: number; exercises: ActiveExercise[] }

export interface Settings { name: string; unit: Unit; folders: string[] }
export interface Link { base_url: string; token: string; cursor: string; last_sync: number; error: string; push_unit: boolean }
export interface Tombstone { kind: 'routine' | 'workout'; id: string }
