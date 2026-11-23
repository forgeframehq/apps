// Claude connector: a stateless MCP server over Streamable HTTP (JSON-RPC on POST).
// No SDK needed — each request is self-contained, which suits Workers well.
import * as data from './db';
import type { User, Unit } from './db';

const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

/** Convert every `*_kg` field into the user's unit and drop the suffix (weight_kg -> weight). */
function localize(v: any, unit: Unit): any {
  if (Array.isArray(v)) return v.map((x) => localize(x, unit));
  if (v && typeof v === 'object') {
    const out: any = {};
    for (const [k, val] of Object.entries(v)) {
      if (k.endsWith('_kg') && typeof val === 'number') out[k.slice(0, -3)] = data.fromKg(val, unit);
      else out[k] = localize(val, unit);
    }
    return out;
  }
  return v;
}

const unitProp = { type: 'string', enum: ['kg', 'lb'], description: "Unit for weights in this call. Defaults to the user's preferred unit." };
const exerciseRef = { type: 'string', description: 'Exercise name (e.g. "Bench Press") or id. Prefer names from list_exercises; unknown names are created as custom exercises.' };

interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  readOnly: boolean;
  destructive?: boolean;
  run: (db: D1Database, user: User, a: any) => Promise<unknown>;
}

const TOOLS: Tool[] = [
  {
    name: 'get_profile',
    title: 'Get profile',
    description: "Get the user's name and preferred weight unit (kg or lb). All weights returned by other tools are in this unit.",
    inputSchema: { type: 'object', properties: {} },
    readOnly: true,
    run: async (_db, user) => ({ name: user.name, unit: user.unit }),
  },
  {
    name: 'list_exercises',
    title: 'List exercises',
    description: 'Search the exercise library (built-in plus the user\'s custom exercises). Call this before creating routines or logging workouts so you reuse exact exercise names.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional text to match in the exercise name' },
        muscle_group: { type: 'string', enum: data.MUSCLES },
      },
    },
    readOnly: true,
    run: (db, user, a) => data.listExercises(db, user.id, a),
  },
  {
    name: 'list_routines',
    title: 'List routines',
    description: "List the user's saved workout routines with their exercises, target sets/reps and rest times.",
    inputSchema: { type: 'object', properties: {} },
    readOnly: true,
    run: (db, user) => data.listRoutines(db, user.id),
  },
  {
    name: 'create_routine',
    title: 'Create routine',
    description: 'Create a new workout routine that appears in the app ready to start. For a multi-day program, call once per day (e.g. "Push A", "Pull A") and give them the same folder.',
    inputSchema: {
      type: 'object',
      required: ['name', 'exercises'],
      properties: {
        name: { type: 'string' },
        folder: { type: 'string', description: 'Optional folder to group routines of one program, e.g. "Upper/Lower Split"' },
        notes: { type: 'string' },
        exercises: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['exercise'],
            properties: {
              exercise: exerciseRef,
              sets: { type: 'integer', minimum: 1, maximum: 20, description: 'Target number of working sets (default 3)' },
              reps: { type: 'string', description: 'Target reps or range, e.g. "5", "8-12", "AMRAP" (default "8-12")' },
              rest_seconds: { type: 'integer', minimum: 0, maximum: 1800, description: 'Rest between sets (default 120)' },
              notes: { type: 'string', description: 'Cues shown under the exercise in the app' },
              muscle_group: { type: 'string', description: 'Only used if this creates a new custom exercise' },
              equipment: { type: 'string', description: 'Only used if this creates a new custom exercise' },
            },
          },
        },
      },
    },
    readOnly: false,
    run: (db, user, a) => data.saveRoutine(db, user.id, a),
  },
  {
    name: 'update_routine',
    title: 'Update routine',
    description: 'Replace an existing routine (name, notes and the full exercise list). Get the routine_id from list_routines and send the complete new exercise list.',
    inputSchema: {
      type: 'object',
      required: ['routine_id', 'name', 'exercises'],
      properties: {
        routine_id: { type: 'string' },
        name: { type: 'string' },
        folder: { type: 'string', description: 'Omit to keep the current folder' },
        notes: { type: 'string' },
        exercises: { type: 'array', minItems: 1, items: { type: 'object', required: ['exercise'], properties: { exercise: exerciseRef, sets: { type: 'integer' }, reps: { type: 'string' }, rest_seconds: { type: 'integer' }, notes: { type: 'string' } } } },
      },
    },
    readOnly: false,
    destructive: true,
    run: (db, user, a) => data.saveRoutine(db, user.id, a, String(a?.routine_id ?? '')),
  },
  {
    name: 'delete_routine',
    title: 'Delete routine',
    description: 'Permanently delete a routine. Logged workouts are not affected. Confirm with the user first.',
    inputSchema: { type: 'object', required: ['routine_id'], properties: { routine_id: { type: 'string' } } },
    readOnly: false,
    destructive: true,
    run: async (db, user, a) => {
      await data.deleteRoutine(db, user.id, String(a?.routine_id ?? ''));
      return { deleted: true };
    },
  },
  {
    name: 'list_workouts',
    title: 'List workouts',
    description: 'List logged workouts, newest first, with duration, total volume and the exercises performed. Use get_workout for set-by-set detail.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Default 20' },
        since: { type: 'string', description: 'ISO date/time; only workouts on or after this' },
        until: { type: 'string', description: 'ISO date/time; only workouts on or before this' },
      },
    },
    readOnly: true,
    run: (db, user, a) => data.listWorkouts(db, user.id, a),
  },
  {
    name: 'get_workout',
    title: 'Get workout',
    description: 'Get one logged workout with every set (weight, reps, RPE).',
    inputSchema: { type: 'object', required: ['workout_id'], properties: { workout_id: { type: 'string' } } },
    readOnly: true,
    run: (db, user, a) => data.getWorkout(db, user.id, String(a?.workout_id ?? '')),
  },
  {
    name: 'log_workout',
    title: 'Log workout',
    description: 'Record a completed workout from what the user tells you. Ask for anything essential that is missing (exercises, weights, reps) rather than guessing.',
    inputSchema: {
      type: 'object',
      required: ['exercises'],
      properties: {
        name: { type: 'string', description: 'e.g. "Push Day". Default "Workout"' },
        started_at: { type: 'string', description: 'ISO date/time with timezone offset. Default: now' },
        duration_minutes: { type: 'number', description: 'Length of the session' },
        notes: { type: 'string' },
        unit: unitProp,
        exercises: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['exercise', 'sets'],
            properties: {
              exercise: exerciseRef,
              sets: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'object',
                  required: ['reps'],
                  properties: {
                    weight: { type: 'number', description: 'Load for the set; 0 for bodyweight' },
                    reps: { type: 'integer' },
                    rpe: { type: 'number', minimum: 1, maximum: 10 },
                    set_type: { type: 'string', enum: ['normal', 'warmup', 'drop', 'failure'] },
                  },
                },
              },
            },
          },
        },
      },
    },
    readOnly: false,
    run: (db, user, a) => {
      const unit: Unit = a?.unit === 'kg' || a?.unit === 'lb' ? a.unit : user.unit;
      const exercises = (Array.isArray(a?.exercises) ? a.exercises : []).map((e: any) => ({
        ...e,
        sets: (Array.isArray(e?.sets) ? e.sets : []).map((s: any) => ({ ...s, weight_kg: data.toKg(Number(s?.weight ?? 0), unit) })),
      }));
      return data.createWorkout(db, user.id, { ...a, exercises, source: 'claude' });
    },
  },
  {
    name: 'delete_workout',
    title: 'Delete workout',
    description: 'Permanently delete a logged workout. Confirm with the user first.',
    inputSchema: { type: 'object', required: ['workout_id'], properties: { workout_id: { type: 'string' } } },
    readOnly: false,
    destructive: true,
    run: async (db, user, a) => {
      await data.deleteWorkout(db, user.id, String(a?.workout_id ?? ''));
      return { deleted: true };
    },
  },
  {
    name: 'get_exercise_history',
    title: 'Get exercise history',
    description: 'Session-by-session history for one exercise, plus the heaviest set and best estimated 1RM (Epley). Use for progress and plateau analysis.',
    inputSchema: { type: 'object', required: ['exercise'], properties: { exercise: exerciseRef, limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Most recent sessions to return (default 10)' } } },
    readOnly: true,
    run: (db, user, a) => data.exerciseHistory(db, user.id, String(a?.exercise ?? ''), a?.limit),
  },
  {
    name: 'get_training_stats',
    title: 'Get training stats',
    description: 'Training summary for the last N days: workout count and frequency, total volume, working sets per muscle group, and most-trained exercises.',
    inputSchema: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 3650, description: 'Default 30' } } },
    readOnly: true,
    run: (db, user, a) => data.stats(db, user.id, a?.days),
  },
];

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: any };

async function handleOne(db: D1Database, user: User, msg: Rpc): Promise<object | null> {
  const isNotification = msg.id === undefined || msg.id === null;
  const ok = (result: unknown) => ({ jsonrpc: '2.0', id: msg.id, result });
  const err = (code: number, message: string) => ({ jsonrpc: '2.0', id: msg.id ?? null, error: { code, message } });
  if (msg?.jsonrpc !== '2.0' || typeof msg.method !== 'string') return err(-32600, 'Invalid Request');
  if (isNotification) return null;

  switch (msg.method) {
    case 'initialize': {
      const asked = msg.params?.protocolVersion;
      return ok({
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[1],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'reps', title: 'Reps', version: '1.0.0' },
        instructions: `Reps is ${user.name}'s workout tracker. Weights are in ${user.unit} unless a tool call says otherwise. Use list_exercises to find exact exercise names before creating routines or logging workouts.`,
      });
    }
    case 'ping':
      return ok({});
    case 'tools/list':
      return ok({
        tools: TOOLS.map((t) => ({
          name: t.name,
          title: t.title,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: { title: t.title, readOnlyHint: t.readOnly, destructiveHint: !!t.destructive, openWorldHint: false },
        })),
      });
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === msg.params?.name);
      if (!tool) return err(-32602, `Unknown tool: ${msg.params?.name}`);
      try {
        const result = localize(await tool.run(db, user, msg.params?.arguments ?? {}), user.unit);
        const payload = Array.isArray(result) ? { unit: user.unit, items: result } : { unit: user.unit, ...(result as object) };
        return ok({ content: [{ type: 'text', text: JSON.stringify(payload) }], isError: false });
      } catch (e) {
        // Tool failures go back as results so Claude can read the message and correct itself.
        const message = e instanceof data.HttpError ? e.message : 'Internal error';
        if (!(e instanceof data.HttpError)) console.error(e);
        return ok({ content: [{ type: 'text', text: `Error: ${message}` }], isError: true });
      }
    }
    default:
      return err(-32601, `Method not found: ${msg.method}`);
  }
}

export async function handleMcp(req: Request, db: D1Database, user: User): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 });
  }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleOne(db, user, m)))).filter(Boolean);
    return out.length ? Response.json(out) : new Response(null, { status: 202 });
  }
  const res = await handleOne(db, user, body as Rpc);
  return res ? Response.json(res) : new Response(null, { status: 202 });
}
