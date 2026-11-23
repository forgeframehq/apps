# Investors Club

A stock market game for schools in Bermuda. Students invest pretend money in 30 real companies at real prices,
read each stock's markers before choosing, learn the vocabulary, and compete on a class leaderboard.

- `app/` — the app (React Native + Expo). One codebase gives the Android app and the website.
- `backend/` — the class server (Cloudflare Worker + D1). Shares prices between everyone, runs classes and the
  leaderboard, and serves the website. Optional: the app works alone as a practice portfolio.
- `tests/` — end-to-end test that drives the web build against a local server with made-up prices.
- `../.github/workflows/investors-club-android.yml` — builds the APK on GitHub.

## The app

Four tabs:

- **Market** — a scrolling ticker, then the 30 stocks with price and today's change. Filter by group, search, sort.
- **Portfolio** — total value, gain since the start, your mix by group, holdings, badges, investor level, trades.
- **Learn** — six short lessons with quizzes and a 45-word glossary, each word explained at two reading levels.
- **Class** — join with a class code, a first name with last initial, and a PIN. Then the leaderboard.

A stock's page shows what the company does, the price, a graph (1W / 1M / 3M / 1Y) and its **markers**: company
size, price-to-earnings, dividend, jumpiness (beta), 52-week range, past year's change and sales growth. Each
marker shows the real number, a plain word ("Giant", "Calm", "Steady payout") and a meter; tapping it explains it.

Buying and selling is in dollars or shares (fractions allowed, no fees). Badges and levels reward learning and
spreading risk, never trading often.

**Teachers** (Settings → For teachers) create a class, choose the starting cash, and get a class code plus a
teacher key. The teacher view ranks every student and shows their holdings and recent trades. A teacher can reset
a student's PIN, remove a student, or start a new round.

No email addresses or accounts: students are a name and a PIN inside one class.

### Where prices come from

Prices are real, so they need the internet. Everything else (lessons, glossary, your portfolio at the last prices
seen) works offline. Trades always use a price fetched that second.

1. **Class server** (for schools). Holds the data keys, keeps one shared copy of each price and refreshes it on a
   timer, so a whole class uses about as much data as one person.
2. **Your own keys** (to try the app on one phone). Settings → Market data. A free [Finnhub](https://finnhub.io)
   key gives prices and markers; a free [Twelve Data](https://twelvedata.com) key gives the graphs.

**Before charging schools:** both free plans are for personal, non-commercial use. A paid product shown to
students needs a data plan that allows display to users (Twelve Data calls this "external display"; ask Finnhub
for commercial terms). Price that in.

### Get an APK

The "Investors Club - Android APK" workflow builds on every push to `main` that touches `investors-club/app/`.
The newest build is always `InvestorsClub.apk` on the "Investors Club (latest build)" release.

## The class server

1. Deploy it. In the Cloudflare dashboard: Workers & Pages → Create → Import a repository → this repo, root
   directory `investors-club/backend`. The D1 database already exists (its id is in `backend/wrangler.jsonc`) and
   the tables create themselves on first use. The deploy also builds the website, so the same address is the
   web app.
2. Add secrets (Worker → Settings → Variables and Secrets):
   - `FINNHUB_KEY` — prices and markers.
   - `TWELVE_KEY` — graphs.
   - `SCHOOL_KEY` — optional but recommended: any phrase you choose. Teachers must enter it to create a class,
     which stops strangers making classes on your server.
3. Point the app at it: either type the address under Settings → Market data, or set the GitHub repository
   variable `INVESTORS_CLUB_SERVER_URL` and rebuild so the APK has it built in. The website needs nothing: it
   uses the address it was loaded from.

### How it stays inside the free data plans

- Finnhub allows 60 requests a minute. The server keeps prices for 60 seconds while the market is open (15
  minutes when closed) and lets only one request at a time refresh them.
- Twelve Data allows 8 a minute and 800 a day. Each stock's graph is kept for 12 hours and markers for 24.
- A timer every 10 minutes refreshes prices and tops up the oldest few graphs and markers.

### Fair play

In a class, the server keeps every portfolio and fills each trade at its own price, so editing the app's saved
data changes nothing. The trading rules are one file shared by app and server (`app/src/lib/rules.ts`).

## Code layout

- `app/src/data/` — the 30 stocks, glossary, lessons, and how markers are worded.
- `app/src/lib/store.ts` — everything saved on the device, portfolio maths, badges and levels.
- `app/src/lib/market.ts` — picks the price source and caches what it fetches.
- `app/src/lib/provider.ts`, `rules.ts` — shared with the server. Keep them free of React Native imports.
- `app/src/lib/classroom.ts` — calls to the class server.
- `app/src/app/` — one file per screen. `(tabs)/index.tsx` is the Market tab, so the app opens on it.
- `backend/src/index.ts` — the whole server.

## Testing

```bash
cd app && npm install && npx tsc --noEmit
CI=1 npx expo export --platform android --output-dir /tmp/out
cd ../backend && npm install && npx tsc --noEmit
cd ../tests && ./run-e2e.sh
```

The end-to-end test uses made-up prices (`MOCK_MARKET`), so the real Finnhub and Twelve Data calls are not
covered by it. Check those on a phone with real keys.

## Not built yet

- Teacher choosing which stocks a class can trade.
- Bermuda Stock Exchange prices (no free feed).
- Dividends paid into portfolios, and stock splits.
- Proper sign-in for teachers (today: class code + teacher key).
