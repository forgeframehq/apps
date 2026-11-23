# Reps

A standalone workout tracker (React Native + Expo) with an optional Claude connection.

- `app/` — the app. Everything is stored on the phone; no account or server needed.
- `backend/` — optional Cloudflare Worker + D1 database. Only needed for the Claude connector: it is the server Claude talks to, and the app syncs with it both ways.
- `tools/build_library.py` — regenerates the bundled exercise library and pictures.
- `../.github/workflows/reps-android.yml` — builds the APK on GitHub.

## The app

Four tabs: **Home** (your workout feed), **Workout** (routines, folders, quick start), **Profile** (weekly chart, statistics, calendar, exercise library, settings) and **Connectors** (Claude).

While training: last session's numbers beside every set, warm-up / drop / failure sets, RPE, a rest timer per exercise with a phone notification when it ends, notes, and live duration / volume / set totals. Finishing a workout marks any personal records (heaviest weight, estimated 1RM, set volume).

Each exercise has a progress chart, personal records, per-rep bests, full session history and how-to steps with photos. You can add your own exercises, back up to the clipboard and restore from a backup.

### Try it

```bash
cd app
npm install
npx expo start          # scan the QR code with Expo Go
```

### Get an APK

Either route gives you an installable file; neither needs Android Studio.

**GitHub (nothing to run yourself):** the "Reps - Android APK" workflow builds on every push to `main` that touches `reps/app/`, or run it by hand from the Actions tab. The newest build is always `Reps.apk` on the repo's "Reps (latest build)" release.

**Expo's build service:** needs a free Expo account.

```bash
cd app
npx eas-cli@latest build -p android --profile preview
```

Keep using the same route for updates: an update only installs over the old app if it is signed with the same key.

### Code layout

- `src/lib/store.ts` — all data, saving, and the history maths (records, weekly totals, statistics).
- `src/lib/sync.ts` — the optional sync with the Claude server.
- `src/lib/rest.ts` — the rest-timer notification.
- `src/ui/` — shared controls (`kit.tsx`), dialogs and sheets (`overlay.tsx`), chart.
- `src/app/` — one file per screen (expo-router). `(tabs)/index.tsx` is the Workout tab, so the app opens on it.
- `src/data/` — exercise library and generated picture map. `art.ts` is where custom artwork overrides the library photos.
- `assets/exercises/` — pictures.

## Connecting Claude (optional)

1. Deploy the backend. The D1 database already exists in your Cloudflare account with the schema and your user (its id is in `backend/wrangler.jsonc`; it is still named `forgelift`). The exercise library loads itself on first use.
   - **No terminal:** in the Cloudflare dashboard: Workers & Pages → Create → Import a repository, root directory `reps/backend`.
   - **Terminal:** `cd backend && npm install && npx wrangler deploy`
2. In the app: Connectors → Claude → enter the server address and your token → Connect. This uploads what is on the phone and keeps both sides in step from then on.
3. On the same screen tap **Copy connector address**, then add it in Claude as a custom connector. The address contains your token, so treat it like a password.

Things to ask Claude:

- "Build me a 4-day upper/lower split and save it to Reps."
- "I just did bench 185 for 3 sets of 5. Log it."
- "How has my squat progressed over the last two months?"

### How sync works

- The phone is the original for workouts it logged; the server keeps a copy for Claude.
- Routines and workouts Claude creates are pulled down on the next sync. Routine edits made by Claude win over the phone's copy unless the phone has unsent edits.
- Deletions travel both ways.
- Sync runs on launch, when the app comes back to the foreground, a few seconds after any change, and from the sync button on the Workout tab.

### Adding more users later

Every table is keyed by user and each user has their own token.

1. Set a secret: `npx wrangler secret put ADMIN_SECRET` (or add it in the dashboard).
2. `curl -X POST https://<server>/admin/users -H "Authorization: Bearer <ADMIN_SECRET>" -H "Content-Type: application/json" -d '{"name":"Alex","unit":"kg"}'` returns that user's token. Only its hash is stored, so save it.

Before opening this to the public, replace token-in-URL with OAuth sign-in for the connector.

### Backend development

```bash
cd backend
npm install
echo 'ADMIN_SECRET=devsecret' > .dev.vars
npm run db:local
npm run dev             # http://localhost:8787
```

## Credits

Exercise library, photos and instructions: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain, Unlicense).

## Not built yet

Health Connect, heart-rate straps, supersets, body measurements, editing a saved workout, and social features.
