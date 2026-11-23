#!/bin/sh
# Runs the Investors Club end-to-end test: the web build of the app served by a throwaway local class server
# that uses made-up prices (MOCK_MARKET), so no data keys or internet are needed.
# Needs: Node 22+, Google Chrome (set CHROME=/path/to/chrome if it is elsewhere), and `npm install` done in
# ../app and ../backend. Screenshots land in $IC_SHOTS (default: an investors-club-e2e folder in the temp directory).
set -e
here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
port=8791
# wrangler starts child processes; run it in its own group so all of them stop when the test ends.
stop() { [ -n "$server" ] && { kill -- "-$server" 2>/dev/null || kill "$server" 2>/dev/null; } || true; }
trap stop EXIT
if curl -s -m 2 "localhost:$port/api/health" >/dev/null; then echo "Something is already running on port $port. Stop it first."; exit 1; fi

[ -d "$here/node_modules/puppeteer-core" ] || (cd "$here" && npm install --no-save puppeteer-core >/dev/null)

echo "Building the web version of the app..."
rm -rf "$here/../backend/public"
(cd "$here/../app" && CI=1 npx expo export --platform web --output-dir ../backend/public >/dev/null)

echo "Starting a fresh local class server..."
cd "$here/../backend"
rm -rf .wrangler
echo 'MOCK_MARKET=1' > .dev.vars
if command -v setsid >/dev/null; then SKIP_WEB_BUILD=1 setsid npx wrangler dev --port $port >"$work/backend.log" 2>&1 &
else SKIP_WEB_BUILD=1 npx wrangler dev --port $port >"$work/backend.log" 2>&1 &
fi
server=$!
tries=0
until curl -s -m 2 "localhost:$port/api/health" >/dev/null; do
  tries=$((tries + 1))
  [ $tries -gt 40 ] && { echo "The local server did not start:"; tail -20 "$work/backend.log"; exit 1; }
  sleep 1
done

IC_APP=http://localhost:$port node "$here/e2e.js"
