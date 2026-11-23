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

## 2026-11-22 — Exercise names

**Rename by rule, then curate.** The open dataset's names were inconsistent ("Barbell Bench Press - Medium Grip", "Pullups"). `reps/tools/exercise_names.py` turns them into "Movement - Variation (Equipment)" with rules plus an overrides table. Reviewing the full output by equipment group caught what rules alone got wrong.

**Keep ids and file numbering stable when renaming.** Pictures are numbered by the dataset's original order, so a rename changes two JSON files and no images. Saved routines and workouts refresh their stored names from the library on launch, and the server re-seeds its library when a name differs.

## 2026-11-22 — Reps: Coach tab replaces Connectors

- **A setup screen is not a tab.** Connectors was used once and then sat in the tab bar. Tabs are for things opened every session; setup goes one level down (Coach → Connect an assistant, also in Settings).
- **Make the feature work offline first, then let the assistant add to it.** Coach (check-in, review, next targets, weekly view) is plain arithmetic on local history in `src/lib/coach.ts`. The assistant is an extra, so the tab is never empty for someone who connects nothing.
- **One MCP server serves Claude, ChatGPT and Gemini.** All three accept a custom remote MCP address, so there is one connector address and three sets of instructions, not three integrations. ChatGPT and Gemini are untested here and have plan/region limits; say so in the app.
- **New per-workout data without a schema change:** the check-in is stored on the phone as its own field and appended to the workout notes when uploaded (`notesWithCheckin` in `sync.ts`), so the server and the assistant see it with no backend change.
- **Renaming a route:** grep for the old path in `router.push`, the root `Stack.Screen` names, and the e2e test; TypeScript does not catch a stale route string.

## 2026-11-23 — Reps: offline coach and the Reps-branded connector

- **"AI" features that are really arithmetic should stay arithmetic.** The monthly report, muscle balance, plateau and deload detection are plain rules over local history (`src/lib/coach.ts`). Free, offline, instant, and testable. Save a real model for conversation.
- **A Claude subscription cannot power chat inside our app.** Chat in-app means an API key billed per message. The free route is the connector: the user talks in the Claude app and our server only supplies data and actions. Claude's free plan allows one custom connector (checked 2026-11-23).
- **Branding a custom connector without directory approval:** `serverInfo.title`, the `instructions` string returned by `initialize` (this is where the coaching behaviour lives), tool titles, and MCP `prompts` as conversation starters. A logo and one-tap connect need a directory listing, which needs real sign-in (OAuth) on the server.
- **Give the assistant one "briefing" tool.** `get_coach_briefing` returns recent workouts, a 30-day summary and routines in one call, so the assistant does not need five calls before it can say anything useful.
- **Compare a month in progress with the same number of days of the month before**, not the whole month, or every report on the 10th says you are down 60%.
- **Expo adds permissions the app does not use** (draw over other apps, external storage). Remove them with `android.blockedPermissions` in `app.json` and check the built APK's manifest.

## 2026-11-23 — Reps: themes, Hevy import, editing history

- **Theme without a rewrite:** keep colours in one mutable object (`src/lib/theme.ts`), read it at render time (never inside `StyleSheet.create` or a module-level table), and put `key={accent}` on the root `Stack` so every screen remounts on a change. Text on the accent needs its own colour (`onAccent`): white on orange worked, white on volt green does not.
- **Importing another app's export:** match exercise names by a normalised word set (order, punctuation, plural and "bicep/biceps" ignored). Never map to the "nearest" name: a wrong link corrupts history. Unmatched names become custom exercises under the user's own name with a muscle guessed from keywords.
- **Deterministic ids for imported rows** (hash of start time + title) make a second import a no-op.
- **An export has no routines.** Rebuild them from the latest run of each workout name used at least twice, and link old workouts to them, or the coach has nothing to compare.
- **Recompute records in one chronological pass** after an import, an edit or a reset; the per-workout version is quadratic.
- **Assisted lifts invert "heavier is better".** Leave them out of records, targets and trend arrows until they are modelled properly.
- **Real data finds what seed data cannot:** 153-rep typos, a workout left running for 4 hours, one-off workout names, timed sets with no reps. Test with a real export (kept outside the repo), then write a made-up CSV for the automated test.
- **A new native module** (`expo-document-picker`) means `npm install` at the version in `node_modules/expo/bundledNativeModules.json` and committing `package-lock.json`, because CI runs `npm ci`.
- **Puppeteer and uppercase:** `Caption` upper-cases its text, so match rendered text case-insensitively.

## 2026-11-23 — Reps 1.3: closing the import gaps

- **Assisted lifts:** score them as body weight minus the help (`loadOf` in `store.ts`), so every record, trend and target rule works unchanged. Without a logged body weight they stay unscored. Leave them out of volume, which is what Hevy does and what the user's totals were compared against.
- **Borrow pictures, never history.** A custom exercise shows the photos of a library exercise with the same movement words and main muscle (`lookalike` in `names.ts`), and says so. Its history stays its own.
- **Compare totals with the app the data came from.** Volume was 2,230 lb higher than Hevy's for one workout; the difference was exactly the assisted sets.
- **Default workout names** ("Evening workout") repeat, so "used twice" is not enough to call something a routine.
- **A deploy workflow should pass when its secrets are missing** and say what to add, so pushing it never turns the repo red.
- **Test helper:** `type()` only replaces text in fields with `selectTextOnFocus`; elsewhere it appends.
