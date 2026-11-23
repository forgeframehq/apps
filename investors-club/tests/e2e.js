// End-to-end test. Drives the web build of Investors Club like a student and a teacher would, against a local
// class server with made-up prices. Run it with ./run-e2e.sh (see that file for what it needs).
// Every control is found by its accessibilityLabel, so keep labels on anything pressable.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const APP = process.env.IC_APP || 'http://localhost:8791';
const OUT = process.env.IC_SHOTS || path.join(require('os').tmpdir(), 'investors-club-e2e');
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails.push(what); };
const api = (route, body, token) => fetch(APP + '/api' + route, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());

function driver(p, errs) {
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 300)));
  const visible = (sel) => p.evaluateHandle((sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null && e.getBoundingClientRect().width > 0), sel);
  const all = async (label) => [...(await (await visible(`[aria-label="${label}"]`)).getProperties()).values()].map((x) => x.asElement()).filter(Boolean);
  return {
    shot: async (n) => { await sleep(400); await p.screenshot({ path: path.join(OUT, `${n}.png`) }); },
    tap: async (label, which = 'first') => { const arr = await all(label); if (!arr.length) return false; await (which === 'last' ? arr[arr.length - 1] : arr[0]).click(); await sleep(500); return true; },
    // Wait 200 ms after clicking a field before typing: a script that types instantly can lose the first character.
    type: async (label, text) => { const el = (await all(label))[0]; if (!el) return false; await el.click({ clickCount: 3 }); await sleep(200); await el.type(text, { delay: 30 }); return true; },
    text: () => p.evaluate(() => document.body.innerText),
    data: () => p.evaluate(() => JSON.parse(localStorage.getItem('ic.data') || '{}')),
    go: async (route) => { await p.goto(APP + route, { waitUntil: 'networkidle0' }); await sleep(900); },
  };
}

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--no-proxy-server'] });
  const errs = [];
  const p = await b.newPage();
  await p.setViewport({ width: 412, height: 915, deviceScaleFactor: 2 });
  const { shot, tap, type, text, data, go } = driver(p, errs);
  let t;

  // ---- Market ----
  await go('/'); await shot('01-market');
  t = await text();
  check(t.includes('Apple') && t.includes('Butterfield Bank') && /\$\d+\.\d\d/.test(t), 'Market lists the stocks with prices');
  check(/AAPL\s*\$\d/.test(t.replace(/\n/g, ' ')), 'the ticker tape shows symbols and prices');
  check(await tap('Bermuda'), 'filter by group'); t = await text();
  check(t.includes('RenaissanceRe') && !t.includes('McDonald'), 'the Bermuda group shows only Bermuda companies'); await shot('02-market-bermuda');
  check(await tap('All') && await type('Search stocks', 'disn'), 'search'); await sleep(400);
  check((await text()).includes('Disney') && !(await text()).includes('Coca-Cola'), 'search narrows the list');

  // ---- A stock: graph, markers, buying ----
  await go('/stock/AAPL'); await sleep(800); await shot('03-stock');
  t = await text();
  check(t.includes('Makes the iPhone') && /\$\d+\.\d\d/.test(t), 'stock page shows what the company does and its price');
  check(/COMPANY SIZE/i.test(t) && /JUMPINESS/i.test(t) && /DIVIDEND/i.test(t) && /52-WEEK RANGE/i.test(t), 'markers are shown before buying');
  check((await p.$$('svg path')).length >= 2, 'the price graph is drawn');
  check(await tap('3M'), 'change the graph range');
  check(await tap('Marker Company size'), 'open a marker'); await shot('04-marker-explained');
  check((await text()).includes('What the whole company is worth'), 'the marker is explained in plain words'); await tap('OK');
  check(await tap('Add to watchlist'), 'star the stock');
  check(await tap('Buy'), 'open the buy sheet'); await shot('05-buy-sheet');
  check(await type('Amount', '500'), 'type an amount'); await sleep(300); await shot('06-buy-amount');
  check(/You get/.test(await text()), 'the sheet says how many shares that buys');
  check(await tap('Confirm buy'), 'confirm'); await sleep(900); await shot('07-first-badge');
  t = await text();
  check(t.includes('Badge earned: First Trade'), 'first trade earns a badge'); await tap('OK'); await sleep(400);
  let d = await data();
  check(d.solo.holdings.length === 1 && d.solo.holdings[0].symbol === 'AAPL' && Math.abs(d.solo.cash - 9500) < 1, 'practice portfolio saved: Apple held, about $500 spent');
  check(await tap('Buy') && await type('Amount', '999999') && (await text()).includes('in cash'), 'cannot spend more than the cash'); await tap('Cancel');
  check(await tap('Sell') && await tap('Half') && await tap('Confirm sell'), 'sell half'); await sleep(900);
  d = await data();
  check(d.solo.trades.length === 2 && d.solo.cash > 9700, 'selling adds the cash back');

  // ---- Portfolio ----
  await go('/portfolio'); await shot('08-portfolio');
  t = await text();
  check(t.includes('Practice portfolio') && t.includes('Apple') && t.includes('First Trade') && t.includes('Recent trades'), 'Portfolio shows value, holdings, badges and trades');

  // ---- Learn ----
  await go('/learn'); await shot('09-learn');
  check(await tap('Lesson What is a stock?'), 'open a lesson'); await sleep(500); await shot('10-lesson');
  for (let i = 0; i < 4; i++) await tap(i === 3 ? 'Start the quiz' : 'Next');
  check((await text()).includes('What do you own when you buy a share?'), 'quiz starts after the cards');
  for (const a of [2, 1, 3]) { await tap(`Answer ${a}`); await sleep(200); if (a === 2) await shot('11-quiz'); await tap((await text()).includes('See my score') ? 'See my score' : 'Next question'); }
  await sleep(600); await shot('12-lesson-done');
  t = await text();
  check(t.includes('Badge earned: Quick Learner'), 'passing a quiz earns a badge'); await tap('OK'); await sleep(300);
  check((await text()).includes('You scored 3 of 3'), 'full marks recorded');
  await go('/glossary');
  check(await tap('Word Dividend') && (await text()).includes('pocket money'), 'glossary explains a word simply'); await shot('13-glossary');
  check((await data()).learned.terms.includes('dividend'), 'the word is marked as read');

  // ---- Class: teacher creates, student joins and trades ----
  await go('/teacher');
  check(await type('Class name', 'P6 Blue') && await type('Teacher name', 'Ms Smith') && await tap('Create class'), 'teacher creates a class'); await sleep(900); await shot('14-class-created');
  t = await text();
  const code = (t.match(/Class code: ([A-Z0-9]{6})/) || [])[1];
  const key = (t.match(/Teacher key: ([a-z0-9]{12})/) || [])[1];
  check(!!code && !!key, 'the class code and teacher key are shown'); await tap('OK'); await sleep(400); await shot('15-teacher-empty');
  check((await text()).includes(code) && (await text()).includes('Nobody has joined yet'), 'teacher view shows the code and an empty class');

  // A second student joins straight through the API so the leaderboard has someone to compare with.
  const other = await api('/join', { code, name: 'Alex R', pin: '4321' });
  await api('/trade', { symbol: 'DIS', side: 'buy', shares: 3 }, other.token);

  const ctx = await b.createBrowserContext();
  const sp = await ctx.newPage();
  await sp.setViewport({ width: 412, height: 915, deviceScaleFactor: 2 });
  const s = driver(sp, errs);
  await s.go('/class'); await s.shot('16-join');
  check(await s.type('Class code', code) && await s.type('Your name', 'Sam T') && await s.type('PIN', '1234') && await s.tap('Join class'), 'student joins with code, name and PIN'); await sleep(1200); await s.shot('17-leaderboard');
  t = await s.text();
  check(t.includes('P6 Blue') && t.includes('Sam T (you)') && t.includes('Alex R'), 'student sees the class leaderboard');
  await s.go('/stock/NTB');
  check(await s.tap('Buy') && await s.type('Amount', '2000') && await s.tap('Confirm buy'), 'student buys in the class portfolio'); await sleep(1200);
  await s.tap('OK'); await sleep(300); await s.tap('OK');
  await s.go('/portfolio'); await s.shot('18-class-portfolio');
  t = await s.text();
  check(t.includes('class portfolio') && t.includes('Butterfield Bank'), 'Portfolio switches to the class portfolio');
  const wrong = await api('/join', { code, name: 'Sam T', pin: '0000' });
  check(/PIN does not match/.test(wrong.error || ''), 'someone else cannot take a name without the PIN');
  const back = await api('/join', { code, name: 'sam t', pin: '1234' });
  check(back.portfolio && back.portfolio.holdings.length === 1, 'the same name and PIN signs back in on another device');

  // ---- Teacher view ----
  await go('/teacher'); await sleep(600);
  t = await text();
  check(t.includes('Sam T') && t.includes('Alex R') && t.includes('Students (2)'), 'teacher sees both students');
  check(await tap('Student Sam T'), 'open a student'); await shot('19-teacher-student');
  check(/bought .* of NTB/.test(await text()), "teacher sees the student's trades");
  const cls = await api('/teacher/class', null, `${code}.${key}`);
  const sam = cls.standings.find((x) => x.name === 'Sam T');
  check(sam && sam.holdings[0].symbol === 'NTB' && Math.abs(sam.cash - 8000) < 1, 'the class server holds the trade');
  const bad = await api('/teacher/class', null, `${code}.nope`);
  check(!!bad.error, 'the teacher view needs the right key');

  await go('/settings'); await shot('20-settings');
  await go('/market-data'); await shot('21-market-data');
  check((await text()).includes('Prices come from the class server'), 'Market data shows where prices come from');

  const real = errs.filter((e) => !/Failed to load resource|favicon/.test(e));
  check(real.length === 0, 'no errors in the browser console' + (real.length ? ': ' + real.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nAll passed');
  console.log('Screenshots: ' + OUT);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
