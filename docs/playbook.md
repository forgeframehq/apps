# Playbook: how we build an app here

This is the recipe that produced Reps. Follow it for the next app and change it when something better turns up.

## 1. Decide these before writing code

| Question | Our default | Why |
| --- | --- | --- |
| What is it built with? | React Native + Expo, TypeScript, expo-router | Native lists, inputs and keyboards. A game engine (we tried Godot) can do an app, but forms and scrolling never feel native. |
| Where does data live? | On the phone, as JSON files | Works with no signal and no account. The gym has bad reception. |
| Does it need a server? | Only for optional extras (sync, Claude) | Keeps the app usable on day one, before anything is deployed. |
| How does the APK get built? | GitHub Actions on push | No computer or Android Studio needed. |
| Reference apps? | Take features and flows, never code, images, text or exact look | Ideas are free to use; their material is not. |

Ask for reference screenshots early. The first version of Reps was rebuilt because it was designed before the references arrived.

## 2. Structure of an app folder

```
<app>/
  app/            Expo project
    src/lib/      store.ts (all data + maths), sync.ts (optional), storage.ts, format.ts, types.ts
    src/ui/       kit.tsx (controls), overlay.tsx (dialogs, sheets, toasts), chart.tsx
    src/app/      one file per screen; (tabs)/index.tsx is the tab the app opens on
    src/data/     bundled data and generated asset maps
    assets/
  backend/        optional Cloudflare Worker + D1
  tests/          end-to-end test
  tools/          scripts that generate bundled data
  README.md
```

To start a new app, copy `reps/app` and keep `src/ui`, `src/lib/storage.ts`, `src/lib/format.ts`, the root layout and the Connectors tab; replace the store and screens. Copy `.github/workflows/reps-android.yml` to `<app>-android.yml` and change the paths and names.

## 3. Patterns that worked

- **One store module.** A plain object holds all state; functions change it and call `commit()` (save, re-render, schedule sync). Screens read it with `useStore()`. No state library needed at this size.
- **Maths next to the data.** Records, weekly totals and statistics are plain functions in the store, computed from the workout list when needed. Nothing derived is saved, so it can never go stale.
- **Promise dialogs.** `if (await confirm(...))` reads top to bottom and works on web, which is what makes the browser test possible.
- **Small ticking components.** The clock and rest bar own their timers, so the set list does not redraw every second.
- **Sync as a mirror.** The phone is the original for what it created; the server holds a copy. Push dirty items, then pull. Deletions are remembered as tombstones on both sides. Ids are made on the phone so both sides agree.
- **The server seeds itself.** The Worker loads its built-in library on first request, so deploying needs no database commands.
- **Bundled open data.** A public-domain dataset gave 876 exercises with photos and instructions for free. Look for an open dataset before generating content.

## 4. Testing without a phone

1. `tsc --noEmit` for types.
2. `expo export --platform android` to prove the native bundle compiles.
3. A Puppeteer script against the web build and a local backend: it logs a workout, checks what was saved, connects, and checks sync both ways. Screenshots from that run are what get reviewed and sent.

What this cannot cover: touch scrolling feel, the on-screen keyboard, notch padding, notifications. Say so every time, and let the first install be the real test.

## 5. Release loop

Push → GitHub builds → APK attached to the `<app>-latest` release → send the link. The first build of an app takes about 22 minutes.

Updates only install over the old app when signed with the same key. The workflow uses the generated project's debug key, which is stable across builds. Before a Play Store release, switch to a real key stored as a repo secret, or to Expo's build service.

## 6. Design

- Dark, high contrast, one accent colour, large tap targets (44 or more).
- Cards for groups, full-width primary buttons, bottom sheets for choices, a toast for confirmations.
- Empty states say what the screen is for and offer the next action.
- Plain words in the interface; no technical terms.

## 7. Checklist for a new app

- [ ] References collected and the feature list agreed
- [ ] Works offline with an empty state on every screen
- [ ] Every pressable has an accessibility label
- [ ] Backup and restore
- [ ] End-to-end test covers the main flow and passes
- [ ] Workflow builds the APK and attaches it to a release
- [ ] README says how to run, build and deploy
- [ ] New lessons added to `docs/lessons.md`
