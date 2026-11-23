# ForgeFrame apps

One repo, one folder per app. Start with `docs/playbook.md` (how we build an app here) and `docs/lessons.md` (what went wrong before and how it was fixed). Add to `docs/lessons.md` whenever something costs more than a few minutes to figure out.

## How we work

- Sudhi works from his phone. He does not run builds locally.
- The loop: make the change → push to `main` → GitHub Actions builds the APK (about 20 minutes) → send him the download link with what changed and what to check → he installs and reports back.
- Builds are slow, so batch related changes into one push. Docs-only pushes do not trigger a build.
- The latest APK for an app is always on its `<app>-latest` release (for Reps: `releases/download/reps-latest/Reps.apk`).
- Tell him plainly what was tested and what was not. Nothing here runs on a real phone before he installs it.

## Before pushing an app change

Run these in the app's folder and fix what they report:

```bash
cd <app>/app && npx tsc --noEmit                      # types
CI=1 npx expo export --platform android --output-dir /tmp/out   # proves the native bundle compiles
cd ../tests && ./run-e2e.sh                           # drives the app in a browser against a local backend
```

## Conventions

- **Local-first.** An app must work with no account and no network. Anything online (sync, an AI assistant) is optional and sits behind one clearly optional screen, not a main tab (in Reps: Coach tab → "Connect Claude").
- **Expo APIs change between SDK versions.** Check the installed package's `.d.ts` in `node_modules` before using an Expo API; do not write it from memory.
- **Every pressable has an `accessibilityLabel`.** The end-to-end test finds controls by label, and screen readers need it.
- **Colours come from `src/lib/theme.ts`** and are read at render time (`C.accent`, with `C.onAccent` for anything drawn on it), so the in-app theme picker works. Do not copy them into module-level constants.
- **No `Alert.alert`.** Use the promise-based dialogs in `src/ui/overlay.tsx` (`confirm`, `menu`, `pick`, `prompt`, `toast`); they also work in the browser test.
- **Bundled images get numeric file names** (`t0001.webp`). Android turns asset paths into resource names and merges names that differ only in punctuation or case.
- **Data:** weights are stored in kg and converted for display; timestamps are ISO UTC strings; ids are generated on the phone so things can be created offline and synced later.
- **Secrets never go in the repo:** tokens, signing keys, `.dev.vars`. Nor does anyone's real data: test imports with a made-up file.
- **Workflows** are named `<app>-<target>.yml` and filtered by path so one app's change does not rebuild another.

## Limits of a Claude session (so you do not rediscover them)

- An Android APK cannot be built inside the session: Google's Maven repository and Expo's servers are not reachable. GitHub Actions builds it.
- Action *artifacts* cannot be downloaded from the session (blob storage is blocked). Release assets on github.com can, which is why the workflow attaches the APK to a release.
- `gh` works for REST (`gh api repos/...`, `gh run view`, `gh run watch`) but GraphQL-backed commands such as `gh repo view` fail.
- The Cloudflare connector can create and query D1 databases but cannot deploy a Worker.

## Apps

- `reps/` — workout tracker. Expo app in `reps/app`, Cloudflare Worker (REST + sync + the Reps coach MCP connector) in `reps/backend`, exercise library builder in `reps/tools`, end-to-end test in `reps/tests`.
- `investors-club/` — stock market game for schools. Expo app (Android + website) in `investors-club/app`, Cloudflare Worker (shared prices, classes, leaderboard, serves the website) in `investors-club/backend`, end-to-end test in `investors-club/tests`. Prices are real, so they are the one thing that needs a network; the rest works offline. `app/src/lib/provider.ts` and `rules.ts` are bundled by the server too: no React Native imports in them. Latest APK: `releases/download/investors-club-latest/InvestorsClub.apk`.
