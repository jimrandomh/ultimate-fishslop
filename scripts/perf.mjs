// Measures frame rate of a stage in headless Chrome using the real GPU (Metal on macOS).
//   node scripts/perf.mjs "stage=aquarium" [--port 5173] [--size 1440x900] [--eval "<js before measuring>"]
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const opt = (n, d) => (args.indexOf(`--${n}`) >= 0 ? args[args.indexOf(`--${n}`) + 1] : d);
const [w, h] = opt('size', '1440x900').split('x').map(Number);
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(`http://127.0.0.1:${opt('port', '5173')}/?${args[0] ?? ''}`);
await page.waitForTimeout(1500);
const pre = opt('eval', '');
if (pre) await page.evaluate(`(async () => { ${pre} })()`);
const r = await page.evaluate(async () => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown';
  let frames = 0;
  const t0 = performance.now();
  await new Promise((res) => {
    const f = () => {
      frames++;
      if (performance.now() - t0 < 3000) requestAnimationFrame(f);
      else res();
    };
    requestAnimationFrame(f);
  });
  return { renderer, fps: +(frames / ((performance.now() - t0) / 1000)).toFixed(1) };
});
console.log(JSON.stringify(r));
await browser.close();
