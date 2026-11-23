// End-to-end test. Drives the web build of Reps like a user would: standalone first, then connected to a
// local backend to check sync in both directions. Run it with ./run-e2e.sh (see that file for what it needs).
// Every control is found by its accessibilityLabel, so keep labels on anything pressable.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const lib = JSON.parse(fs.readFileSync(path.join(__dirname, '../app/src/data/exercises.json'), 'utf8'));
const ex = (name) => lib.find((e) => e.name.toLowerCase() === name.toLowerCase()) || lib.find((e) => e.name.toLowerCase().includes(name.toLowerCase()));
const API = process.env.REPS_API || 'http://localhost:8787';
const APP = process.env.REPS_APP || 'http://localhost:8090';
const OUT = process.env.REPS_SHOTS || path.join(require('os').tmpdir(), 'reps-e2e');
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const token = (process.env.REPS_TOKEN || '').trim();
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails.push(what); };
const api = (path, method = 'GET', body) => fetch(API + path, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());

function seed() {
  const bench = ex('Bench Press (Barbell)'), ohp = ex('Overhead Press (Barbell)'), lat = ex('Lateral Raise (Dumbbell)');
  const squat = ex('Squat (Barbell)'), curl = ex('Lying Leg Curl (Machine)'), pull = ex('Lat Pulldown - Wide Grip (Cable)'), row = ex('Seated Row (Cable)');
  const mk = (e, sets, reps) => ({ exercise_id: e.id, exercise_name: e.name, target_sets: sets, target_reps: reps, rest_seconds: 120, notes: '' });
  const id = () => Math.random().toString(36).slice(2).padEnd(12, '0') + Date.now().toString(36);
  const routines = [
    { id: id(), name: 'Push A', folder: 'Push Pull Legs', notes: '', updated_at: '2026-11-01T00:00:00Z', exercises: [mk(bench, 3, '8'), mk(ohp, 3, '8-10'), mk(lat, 3, '12-15')], dirty: true },
    { id: id(), name: 'Pull A', folder: 'Push Pull Legs', notes: '', updated_at: '2026-11-01T00:00:00Z', exercises: [mk(pull, 3, '10'), mk(row, 3, '10')], dirty: true },
    { id: id(), name: 'Legs A', folder: 'Push Pull Legs', notes: '', updated_at: '2026-11-01T00:00:00Z', exercises: [mk(squat, 4, '5'), mk(curl, 3, '12')], dirty: true },
    { id: id(), name: 'Quick Full Body', folder: '', notes: '', updated_at: '2026-11-01T00:00:00Z', exercises: [mk(squat, 3, '5'), mk(bench, 3, '5')], dirty: true },
  ];
  const plans = [['Push A', [bench, ohp, lat], [135, 85, 20]], ['Pull A', [pull, row], [120, 110]], ['Legs A', [squat, curl], [185, 70]]];
  const workouts = [];
  const LB = 0.45359237;
  for (let k = 0; k < 30; k++) {
    const p = plans[k % 3];
    const t = Date.now() - (80 - k * 2.7) * 86400000;
    workouts.unshift({
      id: id(), name: p[0], routine_id: null, started_at: new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z'), ended_at: new Date(t + (45 + (k % 4) * 10) * 60000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
      notes: '', source: 'app', dirty: true,
      exercises: p[1].map((e, j) => {
        const base = p[2][j] + Math.floor(k / 3) * 5;
        return { exercise_id: e.id, exercise_name: e.name, muscle_group: e.muscle_group, sets: [
          { set_type: 'warmup', weight_kg: Math.round(base * 0.6 / 5) * 5 * LB, reps: 8, rpe: null, prs: [] },
          ...[0, 1, 2].map((s) => ({ set_type: 'normal', weight_kg: (base + s * 5) * LB, reps: 10 - s, rpe: s === 2 ? 8 : null, prs: k > 2 && s === 2 ? ['weight'] : [] })),
        ] };
      }),
    });
  }
  return { settings: { name: 'Sudhi', unit: 'lb', folders: [] }, link: { base_url: '', token: '', cursor: '', last_sync: 0, error: '', push_unit: false }, customExercises: [], routines, workouts, deleted: [] };
}

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--no-proxy-server'] });
  const p = await b.newPage();
  await p.setViewport({ width: 412, height: 915, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 300)));
  const shot = async (n) => { await sleep(350); await p.screenshot({ path: path.join(OUT, `${n}.png`) }); };
  const visible = (sel) => p.evaluateHandle((sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null && e.getBoundingClientRect().width > 0), sel);
  const tap = async (label, which = 'first') => {
    const h = await visible(`[aria-label="${label}"]`);
    const els = await h.getProperties(); const arr = [...els.values()].map((x) => x.asElement()).filter(Boolean);
    if (!arr.length) return false;
    await (which === 'last' ? arr[arr.length - 1] : arr[0]).click(); await sleep(500); return true;
  };
  const type = async (label, text) => { const h = await visible(`[aria-label="${label}"]`); const el = (await h.getProperties()).values().next().value?.asElement(); if (!el) return false; await el.click({ clickCount: 3 }); await sleep(200); await el.type(text, { delay: 30 }); return true; };
  const text = () => p.evaluate(() => document.body.innerText);
  const data = () => p.evaluate(() => JSON.parse(localStorage.getItem('reps.data') || '{}'));
  const go = async (route) => { await p.goto(APP + route, { waitUntil: 'networkidle0' }); await sleep(500); };

  await go('/'); await shot('01-empty-workout-tab');
  check((await text()).includes('No routines yet'), 'opens on the Workout tab, empty');
  await p.evaluate((d) => localStorage.setItem('reps.data', JSON.stringify(d)), seed());
  await go('/'); await shot('02-workout-tab');
  check((await text()).includes('Push Pull Legs (3)'), 'routines and folder render');

  check(await tap('Start Routine'), 'Start Routine'); await sleep(500); await shot('03-session');
  let t = await text();
  check(t.includes('Log Workout') && t.includes('PREVIOUS'), 'session screen');
  check(/Coach: \d+ lb/.test(t), 'coach target shown on each exercise');
  check(/\d+lb x \d+/.test(t), 'previous numbers from local history');
  check(await type('Set 1 weight', '250') && await type('Set 1 reps', '6') && await type('Set 2 weight', '400') && await type('Set 2 reps', '5'), 'type weight and reps');
  check(await tap('Set 1 done') && await tap('Set 2 done'), 'tick two sets');
  check(await type('Set 3 reps', '153') && await tap('Set 3 done') && (await text()).includes('Is that right?'), 'a 153-rep slip is questioned'); await shot('04a-entry-check');
  check(await tap('Fix it') && await type('Set 3 reps', '5') && await tap('Set 3 done'), 'fix the slip and tick the set');
  await shot('04-session-ticked');
  t = await text();
  check(t.includes('Rest 1:5') || t.includes('Rest 2:0'), 'rest timer started');
  check(/Sets\s*3/.test(t.replace(/\n/g, ' ')), 'live set total');
  check(await tap('Set 3 RPE'), 'open RPE sheet'); await shot('05-rpe-sheet'); check(await tap('8.5'), 'pick RPE');
  check(await tap('Set 1 type'), 'open set menu'); check(await tap('Warm-up set'), 'mark warm-up'); await shot('06-session-warmup');
  check(await tap('Add Exercise'), 'Add Exercise'); await sleep(600); await shot('07-picker');
  check(await type('Search exercise', 'hammer curl'), 'search'); await sleep(500); await shot('08-picker-search');
  check(await tap('Hammer Curl (Dumbbell)'), 'choose exercise'); await sleep(600);
  t = await text(); check(/Hammer Curl/.test(t) && t.includes('Log Workout'), 'exercise added to workout'); await shot('09-session-added');
  await p.goBack(); await sleep(700); await shot('10-minibar');
  check((await text()).includes('in progress'), 'workout-in-progress bar'); check(await tap('Resume'), 'Resume'); await sleep(500);
  check(await tap('Finish'), 'Finish'); await shot('11-finish-dialog'); check(await tap('Finish', 'last'), 'confirm finish'); await sleep(900);
  await shot('12-coach-checkin');
  t = await text();
  check(t.includes('How was') && t.includes('LAST WORKOUT') && t.includes('UP NEXT'), 'lands on Coach with check-in, review and next targets');
  check(t.includes('Workout saved'), 'saved toast');
  check(await tap('Good') && await tap('High') && await tap('Save check-in'), 'answer the check-in'); await shot('12b-coach');
  check(((await data()).workouts[0].checkin || {}).feel === 4 && !(await text()).includes('How was'), 'check-in saved with the workout');
  check(await tap('Open monthly report'), 'open monthly report'); await sleep(600); await shot('12d-report');
  t = await text();
  check(t.includes('WHAT STANDS OUT') && t.includes('MUSCLE BALANCE') && t.includes('PUSH / PULL / LEGS') && /Quadriceps/.test(t), 'monthly report shows takeaways, muscle balance and split');
  check(await tap('Previous month') && !(await text()).includes('So far'), 'report steps back a month'); await shot('12e-report-previous');
  await go('/home'); await shot('12c-home-feed');
  let d = await data();
  check(d.workouts.length === 31 && d.workouts[0].exercises[0].sets.length === 3, 'workout saved on the device');
  check(d.workouts[0].exercises[0].sets[1].prs.includes('weight') && d.workouts[0].exercises[0].sets[0].prs.length === 0, 'new records marked on the right set');
  check(d.workouts[0].exercises[0].sets[0].set_type === 'warmup' && d.workouts[0].exercises[0].sets[2].rpe === 8.5, 'set type and RPE saved');
  check(await tap(`Open ${d.workouts[0].name}`), 'open workout detail'); await shot('13-workout-detail');
  check(await tap(`Details for ${d.workouts[0].exercises[0].exercise_name}`), 'open exercise from workout'); await sleep(500); await shot('14-exercise-summary');
  t = await text(); check(t.includes('Personal Records') && t.includes('Set Records'), 'exercise summary with records');
  check(await tap('History'), 'History tab'); await shot('15-exercise-history');
  check(await tap('How to'), 'How to tab'); await shot('16-exercise-howto');
  await go('/profile'); await shot('17-profile'); check((await text()).includes('this week'), 'profile chart');
  check(await tap('Statistics'), 'Statistics'); await shot('18-statistics'); check((await text()).includes('Sets per muscle group'), 'statistics');
  await go('/calendar'); await shot('19-calendar'); check((await text()).includes('this month'), 'calendar');
  await go('/settings'); await shot('20-settings');
  await go('/coach'); await shot('21-coach'); check((await text()).includes('CLAUDE (OPTIONAL)'), 'coach tab offers the optional AI coach');
  check(await tap('Connect Claude'), 'open assistant setup'); await sleep(500); await shot('22-assistant-connect');
  check(await type('Server address', API) && await type('Token', token), 'enter server and token');
  check(await tap('Connect'), 'Connect'); await sleep(6000); await shot('23-assistant-connected');
  t = await text(); check(t.includes('CONNECTED') && t.includes('Synced'), 'connected and synced');
  check(await tap('ChatGPT') && (await text()).includes('Apps & Connectors'), 'steps for other assistants'); await shot('23b-assistant-chatgpt');
  let remote = await api('/api/sync');
  check(remote.workouts.length === 31 && remote.routines.length === 4, `server has the phone's data (${remote.workouts.length} workouts, ${remote.routines.length} routines)`);
  d = await data(); check(!d.workouts.some((w) => w.dirty) && !d.routines.some((r) => r.dirty), 'nothing left to upload');
  const mine = await api('/api/workouts/' + d.workouts[0].id); check(/Check-in: felt Good, energy High/.test(mine.notes || ''), 'check-in reached the server for the assistant to read');
  // the connector, as Claude sees it
  const mcp = (method, params) => fetch(`${API}/mcp/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }).then((r) => r.json()).then((r) => r.result);
  const init = await mcp('initialize', { protocolVersion: '2025-06-18' });
  check(init.serverInfo.title === 'Reps' && /Reps coach/.test(init.instructions) && !!init.capabilities.prompts, 'connector introduces itself as the Reps coach');
  const prompts = (await mcp('prompts/list')).prompts; const got = await mcp('prompts/get', { name: prompts[0].name });
  check(prompts.length === 5 && /Reps/.test(got.messages[0].content.text), 'connector offers starter prompts');
  const brief = JSON.parse((await mcp('tools/call', { name: 'get_coach_briefing', arguments: {} })).content[0].text);
  check(brief.recent_workouts.length === 5 && /Check-in: felt Good/.test(brief.recent_workouts[0].notes || '') && brief.routines.length === 4 && brief.last_30_days.workouts > 0, 'coach briefing returns recent workouts with the check-in, stats and routines');
  // what Claude would do on the server
  const r1 = await api('/api/routines', 'POST', { name: 'Claude Upper', folder: 'From Claude', exercises: [{ exercise: 'Bench Press (Barbell)', sets: 4, reps: '6' }, { exercise: 'Landmine Twist Thing', muscle_group: 'abdominals' }] });
  const w1 = await api('/api/workouts', 'POST', { name: 'Told Claude', source: 'claude', duration_minutes: 40, exercises: [{ exercise: 'Squat (Barbell)', sets: [{ weight_kg: 200, reps: 3 }] }] });
  check(!!r1.id && w1.pr_count > 0, 'server-side routine and workout (with records) created');
  const quick = d.routines.find((r) => r.name === 'Quick Full Body'); await api('/api/routines/' + quick.id, 'DELETE');
  check(await tap('Sync now'), 'Sync now'); await sleep(3500);
  d = await data();
  check(d.routines.some((r) => r.name === 'Claude Upper' && r.folder === 'From Claude'), "pulled Claude's routine");
  check(!d.routines.some((r) => r.name === 'Quick Full Body'), 'remote delete applied');
  const told = d.workouts.find((w) => w.name === 'Told Claude');
  check(d.workouts.length === 32 && told && told.source === 'claude' && told.exercises[0].sets[0].prs.length > 0, "pulled Claude's workout with records");
  check(d.customExercises.some((e) => e.name === 'Landmine Twist Thing'), 'pulled custom exercise');
  await go('/'); await shot('24-workout-tab-synced'); check((await text()).includes('Claude Upper'), "Claude's routine shows on the Workout tab");
  await go('/coach'); await shot('25-coach-linked'); check((await text()).includes('Manage connection'), 'coach shows the assistant is connected');
  // restart persistence
  await go('/home'); await shot('26-home-after-restart'); check((await text()).includes('Told Claude'), 'data survives a restart');
  // theme
  await go('/settings'); check(await tap('Violet theme'), 'pick the Violet theme'); await sleep(600);
  check((await data()).settings.accent === 'Violet', 'theme choice is saved'); await go('/'); await shot('27-violet-theme');
  await go('/settings'); await tap('Volt theme'); await sleep(600); await go('/'); await shot('28-volt-theme');
  // import from a Hevy-style export (made up here; never commit a real export)
  const csv = ['"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_lbs","reps","distance_km","duration_seconds","rpe"',
    '"Zed Day","1 Mar 2025, 10:00","1 Mar 2025, 10:50","","Bench Press (Barbell)","","",0,"warmup",95,10,,,',
    '"Zed Day","1 Mar 2025, 10:00","1 Mar 2025, 10:50","","Bench Press (Barbell)","","",1,"normal",100,8,,,',
    '"Zed Day","1 Mar 2025, 10:00","1 Mar 2025, 10:50","","Zed Row (Old School Machine)","","felt, ""good""",0,"normal",90,153,,,',
    '"Zed Day","1 Mar 2025, 10:00","1 Mar 2025, 10:50","","Plank","","",0,"normal",,,,60,',
    '"Zed Day","1 Mar 2025, 10:00","1 Mar 2025, 10:50","","Pull Up (Assisted)","","",0,"normal",100,10,,,',
    '"Zed Day","8 Mar 2025, 10:00","8 Mar 2025, 10:45","","Zed Row (Old School Machine)","","",0,"dropset",100,12,,,',
    '"Zed Day","8 Mar 2025, 10:00","8 Mar 2025, 10:45","","Pull Up (Assisted)","","",0,"normal",80,10,,,',
    '"Zed Day","8 Mar 2025, 10:00","8 Mar 2025, 10:45","","Treadmill","","",0,"normal",,,,600,'].join('\n');
  const meas = '"date","weight_lbs","fat_percent","neck_cm","waist_cm"\n"14 Jan 2026, 00:00",181,,,\n"24 Feb 2026, 00:00",190,15.5,,84\n';
  fs.writeFileSync(path.join(OUT, 'workout_data.csv'), csv); fs.writeFileSync(path.join(OUT, 'measurement_data.csv'), meas);
  const before = (await data()).workouts.length;
  await go('/import');
  const [chooser] = await Promise.all([p.waitForFileChooser(), tap('Choose CSV files')]);
  await chooser.accept([path.join(OUT, 'workout_data.csv'), path.join(OUT, 'measurement_data.csv')]); await sleep(2500); await shot('29-import-done');
  t = await text(); d = await data();
  const zed = d.workouts.filter((w) => w.name === 'Zed Day'); const zrow = d.customExercises.find((e) => e.name === 'Zed Row (Old School Machine)');
  check(/2 workouts added/.test(t) && /2 entries added/.test(t) && d.workouts.length === before + 2, 'import adds the workouts and measurements');
  check(zrow && zrow.muscle_group === 'middle back' && zed[1].exercises[0].exercise_id === ex('Bench Press (Barbell)').id, 'known exercises link to the library, unknown ones become custom with a guessed muscle');
  check(Math.abs(zed[1].exercises[0].sets[1].weight_kg - 100 * 0.45359237) < 1e-6 && zed[1].exercises.some((e) => e.sets[0].seconds === 60) && zed[0].exercises[0].sets[0].set_type === 'drop' && /felt, "good"/.test(zed[1].notes), 'weights, timed sets, set types and notes come across');
  check(zed[0].exercises[0].sets[0].prs.includes('weight') && Math.abs(d.measures[0].weight_kg - 190 * 0.45359237) < 1e-6 && d.measures[0].parts.waist === 84, 'records recalculated and measurements stored');
  const pu = d.customExercises.find((e) => e.name === 'Pull Up (Assisted)'); const lessHelp = zed[0].exercises.find((e) => e.exercise_id === pu.id).sets[0];
  check(pu.muscle_group === 'lats' && lessHelp.prs.includes('weight'), 'assisted lift: less help counts as a record once body weight is known');
  check(d.customExercises.find((e) => e.name === 'Treadmill').muscle_group === 'other', 'cardio is not counted as a muscle');
  // edit a custom exercise
  await go('/exercise/' + encodeURIComponent(pu.id)); t = await text(); check(/Assisted lift, scored as your body weight \(190 lb\)/.test(t), 'assisted lift is explained on its screen'); await shot('29b-assisted');
  check(await tap('Exercise options') && await tap('Edit exercise'), 'open edit exercise'); await sleep(500);
  check(await type('Exercise name', 'Pull Up (Assisted, Machine)') && await tap('Save'), 'rename a custom exercise'); await sleep(600);
  d = await data();
  const renamed = d.customExercises.find((e) => e.id === pu.id).name; // the test types after the old text, so only the ending is known
  check(renamed.endsWith('(Assisted, Machine)') && d.workouts.find((w) => w.id === zed[0].id).exercises.some((e) => e.exercise_name === renamed), 'the new name shows in past workouts');
  // edit a workout: fix the 153
  await go('/edit-workout?id=' + zed[1].id); await shot('30-edit-workout');
  check(await type('Zed Row (Old School Machine) set 1 reps', '15') && await tap('Save changes'), 'edit a set'); await sleep(700);
  d = await data(); const fixed = d.workouts.find((w) => w.id === zed[1].id).exercises.find((e) => e.exercise_id === zrow.id).sets[0];
  check(fixed.reps === 15 && Math.abs(fixed.weight_kg - 90 * 0.45359237) < 1e-6, 'edit is saved without disturbing the weight');
  await go('/history/' + zed[1].id); await shot('31-workout-detail'); check((await text()).includes('Muscle split'), 'workout detail shows the muscle split');
  await go('/exercise/' + encodeURIComponent(zrow.id)); await shot('32-exercise'); t = await text(); check(t.includes('All time') && t.includes('Personal Records'), 'exercise screen has time ranges and records');
  check(await tap('Exercise options') && await tap('Reset personal records') && await tap('Reset'), 'reset records'); await sleep(500);
  check(!!((await data()).settings.record_resets || {})[zrow.id] && (await text()).includes('Counting from'), 'records restart from the reset');
  await go('/measures'); await shot('33-measures'); check((await text()).includes('190 lb'), 'measures screen shows the imported weight');
  await go('/integrations'); await shot('34-integrations'); check((await text()).includes('Health Connect'), 'integrations page');
  console.log('page errors:', errs.filter((e) => !/favicon|shadow\*|pointerEvents|useNativeDriver/.test(e)).slice(0, 6));
  console.log('FAILS:', fails);
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
