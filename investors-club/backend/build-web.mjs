// Run by wrangler before every deploy (see wrangler.jsonc): builds the website version of the app into ./public,
// so one deploy serves both the website and the API. Set SKIP_WEB_BUILD=1 to reuse what is already there.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

if (process.env.SKIP_WEB_BUILD) {
  if (!existsSync('public')) {
    mkdirSync('public');
    writeFileSync('public/index.html', '<!doctype html><title>Investors Club</title><p>The class server is running. The website has not been built.</p>');
  }
  process.exit(0);
}
const run = (cmd) => execSync(cmd, { cwd: '../app', stdio: 'inherit', env: { ...process.env, CI: '1' } });
if (!existsSync('../app/node_modules/expo')) run('npm ci');
run('npx expo export --platform web --output-dir ../backend/public');
