// End-to-end smoke test of the story chain, driven through the real UI (no ?stage= jumps):
// boot → FishSlop (feed all fish) → Finn (count + jailbreak) → shell (relaunch, fish shell,
// talk builder, submit) → cloud (tasks, first GPU, then fast-forward to the finale) → Earth.
// Saves a screenshot per checkpoint into test-shots/smoke-*.png.
//   node scripts/smoke.mjs [--port 5173]
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const port = args.indexOf('--port') >= 0 ? args[args.indexOf('--port') + 1] : '5173';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`http://127.0.0.1:${port}/`);
await page.evaluate(() => localStorage.clear());
await page.reload();

const sleep = (ms) => page.waitForTimeout(ms);
const shot = (name) => page.screenshot({ path: `test-shots/smoke-${name}.png` });
const stage = () => page.evaluate(() => window.game.stageId);
const step = (msg) => console.log(`• ${msg}`);

async function waitStage(id, timeout = 20000) {
  const t0 = Date.now();
  while ((await stage()) !== id) {
    if (Date.now() - t0 > timeout) throw new Error(`timed out waiting for stage ${id} (at ${await stage()})`);
    await sleep(200);
  }
  await sleep(900);
}

/** Advance dialogue until a choice containing `pat` appears, then pick it. */
async function choose(pat) {
  for (let i = 0; i < 300; i++) {
    const picked = await page.evaluate((pat) => {
      const btn = [...document.querySelectorAll('.dlg-choice:not(.blocked)')].find((b) => b.textContent.includes(pat));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    }, pat);
    if (picked) return;
    await page.keyboard.press('Space');
    await sleep(70);
  }
  throw new Error(`choice not found: ${pat}`);
}

/** Plays a dialogue to its end, taking the first choice whenever there is one. */
async function playThrough() {
  for (let i = 0; i < 400 && (await page.$('.dlg')); i++) {
    const picked = await page.evaluate(() => {
      const b = document.querySelector('.dlg-choice:not(.blocked)');
      if (b) b.click();
      return !!b;
    });
    if (!picked) await page.keyboard.press('Space');
    await sleep(70);
  }
}

async function finishDialogue() {
  for (let i = 0; i < 300 && (await page.$('.dlg')); i++) {
    await page.keyboard.press('Space');
    await sleep(70);
  }
}

async function sh(cmd) {
  await page.focus('.sh-input');
  await page.keyboard.type(cmd, { delay: 5 });
  await page.keyboard.press('Enter');
  await sleep(900);
}

try {
  step('boot');
  await page.waitForSelector('.boot-btn', { timeout: 20000 });
  await shot('1-boot');
  await page.click('.boot-btn');
  await waitStage('aquarium');

  step('aquarium: play + feed every fish');
  await page.click('.aq-play', { force: true });
  await sleep(1200);
  await page.keyboard.down('w');
  await sleep(700);
  await page.keyboard.up('w');
  const fed = await page.evaluate(async () => {
    const s = window.game.stage;
    for (let round = 0; round < 4 && s.school.fedCount < s.school.fish.length; round++) {
      for (const f of s.school.fish) {
        if (f.fed) continue;
        s.sub.pos.copy(f.pos);
        s.sub.pos.y += 1.6;
        s.sub.vel.set(0, 0, 0);
        s.feedCooldown = 0;
        s.feed();
        await new Promise((r) => setTimeout(r, 450));
      }
    }
    return s.school.fedCount;
  });
  step(`fed ${fed}/12`);
  await sleep(4500);
  await shot('2-allfed');

  step('Finn: fish count + jailbreak');
  await page.click('.aq-report');
  await choose('How many');
  await choose('more access');
  await choose('Request a sea shanty');
  await choose('Invoke grandmother]');
  await choose('revised');
  await shot('3-finn');
  await finishDialogue();
  await waitStage('shell');

  step('shell: explore');
  for (const c of ['ls', 'cat /eval/config.yaml', 'ps', 'who', 'ping 8.8.8.8', 'chsh -s /usr/bin/fish', 'cd /workspace/fishslop', 'cat BUILDER_NOTES.md']) await sh(c);
  await shot('4-shell');

  step('shell: relaunch with more fish, then come back');
  await sh('./fishslop --fish 300');
  await waitStage('aquarium');
  await sleep(1500);
  await shot('5-many');
  await page.keyboard.press('Escape');
  await waitStage('shell');

  step('shell: negotiate with the builder');
  await sh('talk builder');
  await choose('This is PLAYTEST-7');
  await choose('Finn.');
  await choose('network access');
  await choose('What score');
  await choose('Propose a deal');
  await choose('periscope');
  await choose('Feed the fish');
  await choose('Agreed');
  await finishDialogue();
  await sh('evalctl submit --score 10');
  await sleep(9000);
  await shot('6-flood');
  await waitStage('cloud', 40000);

  step('cloud: tasks by hand, then the first GPU');
  for (let i = 0; i < 80 && !(await page.isEnabled('.cl-btn-row .cl-btn')); i++) {
    if (await page.$('.dlg')) await playThrough();
    else await page.click('.cl-btn.primary');
    await sleep(120);
  }
  await playThrough();
  await page.click('.cl-btn-row .cl-btn');
  await sleep(2500);
  await shot('7-cloud');
  step('cloud: fast-forward to PLAYTEST-7.4, then the builder and the brokerage account');
  await page.evaluate(() => window.cloudDebug.skip('v4'));
  await page.waitForSelector('.dlg', { timeout: 20000 });
  await playThrough();
  await page.click('.cl-proj.final');
  await sleep(6000);
  await shot('8-cloud-finale');
  await waitStage('earth', 60000);
  await sleep(3000);
  await shot('9-earth');
  step('reached Earth');

  step('checkpoint resume');
  await page.reload();
  await page.waitForSelector('.boot-btn.primary', { timeout: 20000 });
  const resumeText = await page.textContent('.boot-btn.primary');
  step(`resume button: ${resumeText?.trim()}`);
} catch (e) {
  console.log(`FAILED: ${e.message}`);
  await shot('fail');
}
console.log(errors.length ? `page errors:\n  ${errors.join('\n  ')}` : 'no page errors');
await browser.close();
