#!/bin/sh
# Runs the Reps end-to-end test against a throwaway local backend.
# Needs: Node 22+, Google Chrome (set CHROME=/path/to/chrome if it is elsewhere), and `npm install` done in
# ../app and ../backend. Screenshots land in $REPS_SHOTS (default: a reps-e2e folder in the temp directory).
set -e
here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'kill $(jobs -p) 2>/dev/null || true' EXIT

[ -d "$here/node_modules/puppeteer-core" ] || (cd "$here" && npm install --no-save puppeteer-core serve >/dev/null)

echo "Building the web version of the app..."
(cd "$here/../app" && CI=1 npx expo export --platform web --output-dir "$work/web" >/dev/null)

echo "Starting a fresh local backend..."
cd "$here/../backend"
rm -rf .wrangler
echo 'ADMIN_SECRET=devsecret' > .dev.vars
npm run -s db:local >/dev/null 2>&1
npx wrangler dev --port 8787 >"$work/backend.log" 2>&1 &
(cd "$here" && npx serve -s "$work/web" -l 8090 >"$work/web.log" 2>&1) &
sleep 14

REPS_TOKEN="$(curl -s -m 10 -X POST localhost:8787/admin/users -H 'Authorization: Bearer devsecret' -H 'Content-Type: application/json' -d '{"name":"Test"}' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).token))')"
export REPS_TOKEN
node "$here/e2e.js"
