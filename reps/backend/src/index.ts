import * as data from './db';
import { Env, HttpError, User } from './db';
import { handleMcp } from './mcp';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization,Content-Type,Mcp-Session-Id,Mcp-Protocol-Version',
  'Access-Control-Max-Age': '86400',
};

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

function bearer(req: Request): string {
  const h = req.headers.get('Authorization') ?? '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

async function body(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, 'Body must be JSON');
  }
}

async function api(req: Request, env: Env, user: User, path: string[], url: URL): Promise<Response> {
  const db = env.DB;
  const m = req.method;
  const [res, id, sub] = path;
  const q = (k: string) => url.searchParams.get(k) ?? undefined;

  if (res === 'me') {
    if (m === 'GET') return json(user);
    if (m === 'PATCH') return json(await data.updateUser(db, user, await body(req)));
  }
  if (res === 'exercises') {
    if (!id && m === 'GET') return json(await data.listExercises(db, user.id, { query: q('query'), muscle_group: q('muscle_group') }));
    if (!id && m === 'POST') return json(await data.createExercise(db, user.id, await body(req)), 201);
    if (id && sub === 'history' && m === 'GET') return json(await data.exerciseHistory(db, user.id, id, Number(q('limit')) || 10));
  }
  if (res === 'routines') {
    if (!id && m === 'GET') return json(await data.listRoutines(db, user.id));
    if (!id && m === 'POST') return json((await data.saveRoutine(db, user.id, await body(req))).routine, 201);
    if (id && m === 'GET') return json(await data.getRoutine(db, user.id, id));
    // PUT creates the routine if the id is new: the app mints ids offline and syncs later.
    if (id && m === 'PUT') return json((await data.saveRoutine(db, user.id, await body(req), id, true)).routine);
    if (id && m === 'DELETE') return (await data.deleteRoutine(db, user.id, id), json({ deleted: true }));
  }
  if (res === 'workouts') {
    if (!id && m === 'GET') return json(await data.listWorkouts(db, user.id, { limit: Number(q('limit')) || 20, since: q('since'), until: q('until') }));
    if (!id && m === 'POST') return json((await data.createWorkout(db, user.id, await body(req))).workout, 201);
    if (id && m === 'GET') return json(await data.getWorkout(db, user.id, id));
    if (id && m === 'DELETE') return (await data.deleteWorkout(db, user.id, id), json({ deleted: true }));
  }
  if (res === 'sync' && m === 'GET') return json(await data.syncPull(db, user, q('since')));
  if (res === 'stats' && m === 'GET') return json(await data.stats(db, user.id, Number(q('days')) || 30));
  throw new HttpError(404, 'Not found');
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.split('/').filter(Boolean);
    try {
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
      if (!path.length) return json({ name: 'Reps', ok: true });

      // Claude connector. The token rides in the URL (https://host/mcp/<token>) because Claude's
      // custom-connector form takes a URL, not a header. Treat that URL like a password.
      if (path[0] === 'mcp' || path[0] === 'api') await data.ensureLibrary(env.DB);

      if (path[0] === 'mcp') {
        const user = await data.userFromToken(env.DB, path[1] ?? bearer(req));
        if (!user) return json({ error: 'Unauthorized' }, 401);
        const res = await handleMcp(req, env.DB, user);
        const out = new Response(res.body, res);
        for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
        return out;
      }

      // Create additional users later: POST /admin/users with the ADMIN_SECRET as bearer token.
      if (path[0] === 'admin' && path[1] === 'users' && req.method === 'POST') {
        if (!env.ADMIN_SECRET || bearer(req) !== env.ADMIN_SECRET) return json({ error: 'Unauthorized' }, 401);
        const b = await body(req);
        return json(await data.createUser(env.DB, b?.name, b?.unit === 'kg' ? 'kg' : 'lb'), 201);
      }

      if (path[0] === 'api') {
        const user = await data.userFromToken(env.DB, bearer(req));
        if (!user) return json({ error: 'Unauthorized' }, 401);
        return await api(req, env, user, path.slice(1), url);
      }
      return json({ error: 'Not found' }, 404);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Internal error' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
