# Lessons

Newest first. One entry per thing that cost real time. Say what happened, why, and what to do instead.

## 2026-11-22 — Reps

**Get the references before designing.** The first build was functional but generic and was called "meh". The redesign from eight reference screenshots landed immediately. Ask for references at the start.

**Pick the framework by the kind of product.** We built it three times: Expo, then Godot, then Expo again. Godot worked and exported an APK from the session, but a form-heavy app wants native lists and keyboards. For apps: Expo. For games: Godot.

**Standalone first.** The first design needed a deployed server before the app did anything, and the server could not be deployed from the session. Making the app local-first removed the blocker and made it better.

**An Expo APK cannot be built in a Claude session.** Google's Maven repository and Expo's servers are blocked. GitHub Actions builds it in about 22 minutes: `expo prebuild` then `./gradlew assembleRelease`.

**Attach the APK to a release, not only an artifact.** Artifacts need a GitHub login, arrive zipped, and cannot be fetched from the session. A release asset is a plain link.

**Android merges asset names that differ only in punctuation.** Exercise ids such as `3_4_Sit-Up` are unsafe as file names. Bundled images use numbers.

**Expo's file-system and notifications APIs had changed.** SDK 58 uses `new File(Paths.document, name)`; the older function-style API throws. Read the `.d.ts` in `node_modules` first.

**Do not let the default tab depend on a setting.** `initialRouteName` on the tab navigator was not accepted. Making the opening tab the `index` route is simpler and always works.

**Test typing at human speed.** `selectTextOnFocus` selects the text a moment after focus on web; a script that types instantly loses the first character. Wait 200 ms after clicking a field. This is a test artefact, not an app bug.

**Per-keystroke saves are fine; per-keystroke full redraws are not.** Keep clocks and timers in their own small components.

**Cloudflare D1 limits shape the code.** A statement can bind at most 100 values, and free plans cap queries per request. Insert many rows per statement and keep the number of statements per request low.

**A server that seeds itself beats a setup script.** Loading 876 library rows through the dashboard was impractical from a phone; loading them on first request needs nothing from the user.

**Background commands that wait on input hang the session.** `cat > file` with no input, or `curl` with no timeout against a dead server, blocks until killed. Always give `curl` a `-m` timeout.

**Stale data models bite quietly.** When the app moved to local-first, the old online-only client was left in the zip and no longer matched. Remove what a change makes obsolete.
