# ForgeFrame apps

One folder per app. Each app keeps its own README with how to run, build and deploy it.

| App | What it is | Folder |
| --- | --- | --- |
| Reps | Standalone workout tracker (React Native + Expo) with an optional Claude connector | [`reps/`](reps/) |

## Conventions

- An app lives entirely inside its folder: source, backend, tools and docs.
- Build workflows live in `.github/workflows/` and are named `<app>-<target>.yml`. Each one only runs when its own app's files change.
- Never commit secrets: tokens, signing keys and `.dev.vars` stay out of the repo.
