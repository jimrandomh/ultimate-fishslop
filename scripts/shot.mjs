// Headless screenshot helper for visual QA.
//   node scripts/shot.mjs "<query string>" out.png [--wait 3000] [--size 1440x900]
//        [--eval "<async js run in page after load>"] [--keys "w,w,space"] [--port 5173]
// Prints browser console errors/warnings. Requires `npm run dev` to be running.
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const query = args[0] ?? '';
const out = args[1] ?? 'shot.png';
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const wait = Number(opt('wait', '3000'));
const [w, h] = opt('size', '1440x900').split('x').map(Number);
const port = opt('port', '5173');
const evalCode = opt('eval', '');
const keys = opt('keys', '');

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: w, height: h } });
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
const q = query.startsWith('?') || query === '' ? query : `?${query}`;
await page.goto(`http://127.0.0.1:${port}/${q}`);
await page.waitForTimeout(800);
if (evalCode) {
  try {
    const r = await page.evaluate(`(async () => { ${evalCode} })()`);
    if (r !== undefined) console.log('[eval]', JSON.stringify(r));
  } catch (e) {
    console.log('[eval error]', e.message);
  }
}
for (const k of keys.split(',').filter(Boolean)) {
  if (k.startsWith('hold:')) {
    const [, key, ms] = k.split(':');
    await page.keyboard.down(key);
    await page.waitForTimeout(Number(ms));
    await page.keyboard.up(key);
  } else if (k.startsWith('wait:')) await page.waitForTimeout(Number(k.slice(5)));
  else if (k.startsWith('click:')) await page.click(k.slice(6), { force: true });
  else await page.keyboard.press(k);
}
await page.waitForTimeout(wait);
await page.screenshot({ path: out });
console.log(`saved ${out}`);
await browser.close();
