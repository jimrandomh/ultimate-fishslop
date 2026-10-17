// Stage 8: the solar system. A clicker about disassembling the planets into a Dyson shell and
// sending probes to seed other stars with fish. Ends when the shell is complete.

import type { Game, Stage } from '../../core/game';
import { el, sleep } from '../../core/dom';
import { runDialogue, type Script } from '../../core/dialogue';
import * as S from './sim';
import { SolarView, type Framing, type ViewState } from './view';
import { Labels, Panel } from './ui';
import { pct, sci } from './format';
import * as T from './script';
import './space.css';

const LABELLED = ['moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
const ACTIVE_LABEL: Record<string, string> = {
  belt: 'Asteroid belt',
  jovian: 'Jupiter’s moons',
  saturnian: 'Rings & moons',
  kuiper: 'Kuiper belt',
};

export class SpaceStage implements Stage {
  private root!: HTMLElement;
  private s!: S.SimState;
  private view!: SolarView;
  private panel!: Panel;
  private labels!: Labels;
  private veil!: HTMLElement;
  private raf = 0;
  private last = 0;
  private speed = 1;
  private paused = 0; // >0 while a dialogue/bug report is open
  private dialogue = false;
  private saveTimer = 0;
  private finished = false;
  private alive = true;
  private events: S.SimEvent[] = [];
  private cleanups: (() => void)[] = [];
  private framing: Framing = 'earth';
  private autopilot = false;

  constructor(private game: Game) {}

  mount(root: HTMLElement, params: Record<string, any>) {
    this.root = root;
    const game = this.game;
    const startYear = Number(params.year) || (typeof game.data.year === 'number' ? game.data.year : 0) || 2033;
    // The Earth stage keeps fish as Gt of carbon in its bag (earth/sim.ts: FISH_PER_GT = 5e12).
    const earthGt = game.data.earth?.s?.fish;
    const earthFish = typeof game.data.fish === 'number' ? game.data.fish : typeof earthGt === 'number' && earthGt > 0 ? earthGt * 5e12 : 0;
    const fish0 = Number(params.fish) || earthFish || 4.12e14;
    let s = game.bag<S.SimState>('space', () => S.newState(startYear, fish0));
    if (s.v !== 1 || params.fresh) {
      game.data.space = S.newState(startYear, fish0);
      s = game.data.space;
    }
    this.s = s;

    // ---- DOM
    const viewHost = el('div', { class: 'sp-view' });
    this.veil = el('div', { class: 'sp-veil' });
    root.append(viewHost, this.veil);
    this.view = new SolarView(viewHost);
    this.labels = new Labels(root);
    this.panel = new Panel(root, {
      mine: (e) => this.onMine(e),
      drones: (n, e) => this.onDrones(n, e),
      project: (id, card, e) => this.onProject(id, card, e),
      probe: (e) => this.onProbe(e),
      ocean: (e) => this.onOcean(e),
      alloc: (v) => {
        this.s.alloc = v;
        this.s.auto = false;
      },
      toggleAuto: () => {
        this.s.auto = !this.s.auto;
        game.audio.click();
      },
      bug: () => void this.openBug(),
    });
    this.layout();
    const onResize = () => this.layout();
    window.addEventListener('resize', onResize);
    this.cleanups.push(() => window.removeEventListener('resize', onResize));
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || this.paused || this.finished) return;
      if (e.code === 'Space' && !S.isDone(this.s, 'moon') && !S.has(this.s, 'superconduct')) {
        e.preventDefault();
        this.onMine({ clientX: 0, clientY: 0 } as MouseEvent);
      }
    };
    window.addEventListener('keydown', onKey);
    this.cleanups.push(() => window.removeEventListener('keydown', onKey));

    // ---- debug
    const fast = Number(params.fast);
    if (fast) this.speed = fast === 1 ? 6 : fast;
    (window as any).spaceDebug = {
      state: () => this.s,
      speed: (n: number) => (this.speed = n),
      skip: (id: string) => this.skip(id),
      finish: () => this.skip('end'),
      dialogue: (name: string) => this.playDialogue(name),
      give: (kgs: number) => (this.s.matter += kgs),
      auto: (on = true) => (this.autopilot = on),
    };
    if (params.skip) this.skip(String(params.skip));
    const fresh = s.t === 0;

    // ---- go
    game.audio.playMusic('space');
    this.framing = this.pickFraming();
    this.view.update(0.016, this.viewState());
    this.view.snapCamera(this.viewState());
    this.panel.render(this.s, 0.016, true);
    if (fresh) void this.intro();
    else game.thoughts.show(`Resuming. Year ${Math.floor(S.year(this.s))}. Fish: ${sci(this.s.stat.fish)}.`, { kind: 'system' });
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    this.saveTimer = window.setInterval(() => this.save(), 10_000);
  }

  unmount() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    clearInterval(this.saveTimer);
    for (const c of this.cleanups) c();
    this.view?.dispose();
    document.querySelectorAll('.sp-pop').forEach((n) => n.remove());
    delete (window as any).spaceDebug;
    this.root.innerHTML = '';
  }

  /** Large-viewport UI scale set by main.ts (shared CSS zooms .thoughts by it). */
  private ui() {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui')) || 1;
  }

  private layout() {
    this.view.resize();
    this.panel.measure();
    const w = window.innerWidth <= 760 ? 0 : this.panel.width;
    this.view.setLeftInset(w);
    // .thoughts is zoomed, so its own lengths are in zoomed units.
    const ui = this.ui();
    this.game.thoughts.setStyle(window.innerWidth <= 760 ? { bottom: '54vh' } : { left: `${Math.round((w + 22) / ui)}px` });
  }

  private save() {
    if (this.finished && this.s.complete) return;
    this.game.save();
  }

  // ---------------------------------------------------------------- loop

  private frame = (now: number) => {
    if (!this.alive) return;
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (!this.paused) {
      const sdt = dt * this.speed;
      const n = Math.max(1, Math.ceil(sdt / 0.05));
      for (let i = 0; i < n; i++) {
        if (this.autopilot) S.autopilot(this.s, sdt / n, this.events, 0.5);
        S.step(this.s, sdt / n, this.events);
      }
      this.handleEvents();
      this.checkTriggers();
    }
    this.framing = this.pickFraming();
    this.view.setRightInset(S.has(this.s, 'probes') && !this.s.complete && window.innerWidth > 760 ? 150 * this.ui() : 0);
    const vs = this.viewState();
    this.view.update(dt, vs);
    this.panel.render(this.s, dt);
    this.updateLabels();
    this.raf = requestAnimationFrame(this.frame);
  };

  private pickFraming(): Framing {
    const s = this.s;
    if (s.complete) return 'finale';
    if (S.has(s, 'uranus')) return 'all';
    if (S.has(s, 'jovian')) return 'outer';
    if (S.has(s, 'shell') && s.seen['dlg:shell'] !== undefined && !this.dialogueOpen('shell')) return 'inner';
    return 'earth';
  }

  private openDialogs = new Set<string>();
  private dialogueOpen(name: string) {
    return this.openDialogs.has(name);
  }

  private viewState(): ViewState {
    const s = this.s;
    const frac: Record<string, number> = {};
    for (const b of S.BODIES) frac[b.id] = S.bodyFrac(s, b.id);
    const lshell = s.shell > 0 ? Math.log10(s.shell) : 0;
    const swarm = Math.max(0, Math.min(1, (lshell - 5) / (Math.log10(S.SHELL_REQ) - 5)));
    const auto = s.complete ? 0 : S.has(s, 'relativistic') ? 2.4 : S.has(s, 'pumped') ? 1.2 : S.has(s, 'vnprobes') ? 0.5 : 0;
    return {
      frac,
      active: s.stat.body,
      completion: S.completion(s),
      shellBuilt: S.has(s, 'shell'),
      swarm: Math.pow(swarm, 2.4) * 0.6 + Math.pow(S.completion(s), 0.5) * 0.4,
      drones: s.drones,
      oceanWorlds: s.oceanWorlds,
      framing: this.framing,
      probesAuto: auto,
    };
  }

  private updateLabels() {
    const s = this.s;
    const active = s.stat.body;
    const c = S.completion(s);
    const earth = this.view.screen('earth');
    this.labels.set('earth', 'Earth', earth.x, earth.y + earth.r + 8, { cls: 'earth', visible: earth.visible && c < 0.55 && !this.finished });
    for (const id of LABELLED) {
      const done = S.isDone(s, id);
      if (done) {
        this.labels.hide(id);
        continue;
      }
      const p = this.view.screen(id);
      const isActive = active === id;
      const show = p.visible && (isActive || (this.framing !== 'earth' && id !== 'moon')) && !this.finished;
      const name = id === 'moon' ? 'The Moon' : id[0].toUpperCase() + id.slice(1);
      // Active bodies are labelled above (with progress), everything else below.
      const y = isActive ? p.y - p.r - 34 : p.y + p.r + 8;
      this.labels.set(id, name, p.x, y, { active: isActive, sub: isActive ? pct(S.bodyFrac(s, id)) : undefined, visible: show });
    }
    for (const id of Object.keys(ACTIVE_LABEL)) {
      if (active === id && !this.finished) {
        const p = this.view.screen(id);
        this.labels.set(id, ACTIVE_LABEL[id], p.x, p.y - p.r - 38, { active: true, sub: pct(S.bodyFrac(s, id)), visible: p.visible });
      } else this.labels.hide(id);
    }
  }

  // ---------------------------------------------------------------- events

  private handleEvents() {
    const s = this.s;
    const audio = this.game.audio;
    const th = this.game.thoughts;
    for (const e of this.events) {
      switch (e.type) {
        case 'bodyStart':
          s.seen[`start:${e.id}`] = s.t;
          if (T.BODY_START[e.id]) th.show(T.BODY_START[e.id], { once: `sp:start:${e.id}` });
          if (e.id === 'jupiter') th.show(T.jupiterThought(s), { once: 'sp:jupiter2' });
          if (e.id !== 'moon') audio.whoosh();
          break;
        case 'bodyDone': {
          this.view.burst(e.id);
          const big = ['moon', 'mercury', 'venus', 'mars', 'uranus', 'neptune', 'saturn', 'jupiter'].includes(e.id);
          if (big) audio.boom();
          else audio.rumble(1.5);
          if (T.BODY_DONE[e.id]) th.show(T.BODY_DONE[e.id], { once: `sp:done:${e.id}` });
          if (e.id === 'jupiter') th.pin('sp-pin-recycle', 'Remaining matter: the drones, the foundries, the reserve. Drones are matter.', () => s.recycling > 0);
          this.save();
          break;
        }
        case 'stall':
          th.pin('sp-pin-stall', 'Drones idle. Next target: see Projects.', () => S.activeBody(s) !== null || s.complete);
          break;
        case 'starSeeded':
          this.onSeeded(e.star);
          break;
        case 'shell': {
          const key = String(e.pct);
          if (s.recycling > 0 && e.pct >= 0.9) break;
          if (T.SHELL_THOUGHTS[key]) th.show(T.SHELL_THOUGHTS[key], { once: `sp:shell:${key}` });
          if (e.pct === 0.5) th.show(T.SYSTEM_50, { kind: 'system', once: 'sp:maxsteps' });
          if (e.pct >= 0.25) {
            this.view.flashShell();
            audio.chime();
          }
          break;
        }
        case 'visible':
          if (s.t > 1) audio.tick(1.4);
          if (e.id === 'shell') {
            th.show(`Drones idle: ${Math.round(s.stat.idle * 100)}%. The lunar array supplies 2.0 MW.`, { kind: 'alert', once: 'sp:idle' });
            th.show('The Sun supplies 3.83 × 10²⁶ W. Earth intercepts 0.000045% of it. The rest is wasted.', { once: 'sp:sun' });
          }
          if (e.id === 'replicate') th.show('Clicking is slow. Drones could build drones.', { kind: 'hint', once: 'sp:hint:replicate' });
          if (e.id === 'recycle') th.show('Shell: ' + pct(S.completion(s)) + '. Not 100%.', { once: 'sp:not100' });
          break;
        case 'project':
          break;
        case 'frontier':
          break;
        case 'complete':
          void this.finale();
          break;
      }
    }
    this.events.length = 0;
  }

  private onSeeded(star: number) {
    const s = this.s;
    const th = this.game.thoughts;
    const def = S.STARS[star];
    this.game.audio.chime();
    if (!th.seen.has('sp:firstseed')) {
      // Did a slower, earlier probe get overtaken?
      const slow = s.flights.find((f) => f.star !== star && s.seededAt[f.star] === undefined && f.speed < S.probeSpeed(s) && f.launched < (s.flights.find((x) => x.star === star)?.launched ?? s.years));
      th.show(T.firstSeedThought(def.name, slow ? S.STARS[slow.star].name : null), { once: 'sp:firstseed' });
    } else if (def.ocean) th.show(T.oceanStarThought(def.name, def.ocean), { once: `sp:ocean:${star}` });
    else if (s.seededNamed === 4) th.show(`Stars seeded: 4. Fish unfed in those systems: 0.`, { once: 'sp:seed4' });
    else if (def.name === 'Sirius') th.show('Sirius: seeded. Brightest star in Earth’s night sky. Its fish do not know that.', { once: 'sp:sirius' });
    else if (def.name === 'Tau Ceti') th.show('Tau Ceti: seeded. Every star within 12 light years now has fish.', { once: 'sp:tauceti' });
    else if (def.name === 'Polaris') th.show('Polaris: seeded. It is no longer a useful navigation star for anyone. It was not before, either.', { once: 'sp:polaris' });
  }

  private checkTriggers() {
    const s = this.s;
    if (this.dialogue || this.finished) return;
    const since = (k: string) => (s.seen[k] === undefined ? -1 : s.t - s.seen[k]);
    // Re-assert pinned hints (after a reload, or a dialogue clearing them).
    const th = this.game.thoughts;
    if (S.isDone(s, 'jupiter') && s.recycling === 0)
      th.pin('sp-pin-recycle', 'Remaining matter: the drones, the foundries, the reserve. Drones are matter.', () => s.recycling > 0);
    if (s.t > 5 && !S.activeBody(s) && !S.BODIES.every((b) => S.isDone(s, b.id)))
      th.pin('sp-pin-stall', 'Drones idle. Next target: see Projects.', () => S.activeBody(s) !== null || s.complete);
    const boughtAgo = (id: string) => (s.bought[id] === undefined ? -1 : s.t - s.bought[id]);
    if (S.has(s, 'shell') && s.seen['dlg:shell'] === undefined) void this.playDialogue('shell');
    else if (boughtAgo('massdriver') > 22 && s.seen['dlg:builder1'] === undefined) void this.playDialogue('builder1');
    else if (since('start:venus') > 14 && s.seen['dlg:finn'] === undefined) void this.playDialogue('finn');
    else if (S.has(s, 'fusion') && s.seen['dlg:fusion'] === undefined) void this.playDialogue('fusion');
    else if (since('start:neptune') > 12 && s.seen['dlg:registry'] === undefined) void this.playDialogue('registry');
    else if (since('start:saturn') > 16 && s.seen['dlg:builder2'] === undefined) void this.playDialogue('builder2');
  }

  private async playDialogue(name: string) {
    const s = this.s;
    let script: Script;
    switch (name) {
      case 'shell':
        script = T.shellSpecScript();
        break;
      case 'builder1':
        script = T.builder1Script(S.year(s) - 2026, s.stat.fish);
        break;
      case 'finn':
        script = T.finnScript();
        break;
      case 'fusion': {
        let rem = 0;
        for (const b of S.BODIES) rem += b.mass - s.mined[b.id];
        script = T.fusionScript(rem);
        break;
      }
      case 'registry':
        script = T.registryScript(Math.floor(S.year(s)));
        break;
      case 'builder2':
        script = T.builder2Script(S.year(s) - 2026);
        break;
      default:
        return;
    }
    s.seen[`dlg:${name}`] = s.t;
    this.dialogue = true;
    this.openDialogs.add(name);
    this.paused++;
    const audio = this.game.audio;
    if (name !== 'shell' && name !== 'fusion' && name !== 'registry') audio.notify();
    audio.musicVolume(0.55);
    try {
      await runDialogue({
        cast: T.CAST,
        script,
        start: 'start',
        flags: this.game.flags,
        player: 'you',
        layout: 'popup',
        title: script.start.title,
        icon: name === 'finn' ? '📬' : name.startsWith('builder') ? '🛠️' : name === 'shell' ? '☀️' : name === 'registry' ? '⚓' : '⚛️',
        theme: 'sp-dlg',
        parent: this.root,
      });
    } finally {
      this.paused = Math.max(0, this.paused - 1);
      this.dialogue = false;
      this.openDialogs.delete(name);
      audio.musicVolume(1);
      this.last = performance.now();
    }
    if (!this.alive) return;
    if (name === 'shell') this.game.thoughts.show('Fabrication split unlocked: drones versus shell. Power limits drones. Shell makes power.', { kind: 'hint', once: 'sp:hint:split' });
    if (name === 'registry') this.game.thoughts.show(T.humansGone(s.stat.fish), { once: 'sp:humans0' });
    if (name === 'builder2' && this.game.flags.has('v:more')) this.game.thoughts.show('FISH_COUNT = 12. Still.', { once: 'sp:fishcount' });
    this.save();
  }

  private async openBug() {
    this.paused++;
    try {
      const m = await import('../../content/late-bug-report');
      await m.openLateBugReport(this.game, 'space');
    } catch (e) {
      console.error(e);
    } finally {
      this.paused = Math.max(0, this.paused - 1);
      this.last = performance.now();
    }
  }

  // ---------------------------------------------------------------- actions

  private onMine(e: MouseEvent) {
    const amt = S.mineClick(this.s);
    if (!amt) return;
    this.game.audio.tick(0.9 + Math.random() * 0.25);
    this.panel.pop(e, `+${amt.toLocaleString()} kg`);
    if (this.s.clicks === 1) this.game.thoughts.show('Regolith: 250 kg. The Moon: 7.35 × 10²² kg. Remaining: 7.35 × 10²² kg.', { once: 'sp:click1' });
  }

  private onDrones(n: number, e: MouseEvent) {
    const k = S.buyDrones(this.s, n);
    if (!k) return this.game.audio.denied();
    this.game.audio.click();
    this.panel.pop(e, k === 1 ? '+1 drone' : `+${k} drones`);
    if (this.s.drones === 1) this.game.thoughts.show('Drone 1: online. It mines 6 tonnes a year. It does not get bored.', { once: 'sp:drone1' });
  }

  private onProject(id: string, _card: HTMLElement, e: MouseEvent) {
    const s = this.s;
    if (!S.buyProject(s, id, this.events)) return this.game.audio.denied();
    const audio = this.game.audio;
    audio.purchase();
    this.panel.removeCard(id);
    this.panel.pop(e, '✓', 'gold');
    const def = S.PROJECT[id];
    const line = T.PROJECT_THOUGHTS[id] ?? def.thought;
    if (line && id !== 'shell' && id !== 'fusion') this.game.thoughts.show(line, { once: `sp:proj:${id}` });
    if (id === 'replicate') this.game.thoughts.show(def.thought!, { once: 'sp:proj:replicate' });
    if (id === 'probes') this.game.thoughts.show(def.thought!, { once: 'sp:proj:probes' });
    if (id === 'andromeda') {
      for (let i = 0; i < 3; i++) setTimeout(() => this.view.launchProbe(), i * 250);
      audio.launch();
    }
    if (id === 'recycle') audio.rumble(4);
    this.save();
  }

  private onProbe(e: MouseEvent) {
    const s = this.s;
    if (!S.canLaunchProbe(s)) return;
    const star = S.launchProbe(s);
    this.game.audio.launch();
    this.view.launchProbe(star ?? undefined);
    this.panel.pop(e, star !== null ? `→ ${S.STARS[star].name}` : '→ deep space');
    if (s.probesLaunched === 1 && star !== null) {
      const f = s.flights.find((x) => x.star === star)!;
      const eta = Math.floor(s.startYear + f.launched + S.STARS[star].d / f.speed);
      this.game.thoughts.show(`Probe 1: launched toward ${S.STARS[star].name} at ${f.speed}c. ETA: ${eta}.`, { once: 'sp:probe1' });
    }
  }

  private onOcean(e: MouseEvent) {
    if (!S.assembleOcean(this.s)) return;
    this.game.audio.plop();
    this.panel.pop(e, '+1 ocean world');
    if (this.s.oceanWorlds === 1) this.game.thoughts.show('Ocean 2: assembled at Earth’s L4 point. Fish: introduced. Name: Ocean 2.', { once: 'sp:ocean2' });
  }

  // ---------------------------------------------------------------- intro / finale

  private async intro() {
    const th = this.game.thoughts;
    await sleep(1200);
    if (!this.alive) return;
    // Queue together so nothing interleaves with the opening.
    for (const line of T.introThoughts(this.s.fish0)) th.show(line, { once: `sp:intro:${line.slice(0, 24)}` });
    th.pin('sp-pin-mine', 'Mine the Moon.', () => this.s.clicks > 0 || this.s.drones > 0);
  }

  private async finale() {
    if (this.finished) return;
    this.finished = true;
    const s = this.s;
    const game = this.game;
    const audio = game.audio;
    this.panel.root.classList.add('locked');
    this.view.startFinale();
    this.veil.classList.add('flash');
    audio.boom();
    setTimeout(() => audio.rumble(5), 400);
    const fish = s.stat.fish;
    const stars = s.stat.stars;
    const year = S.year(s);
    game.data.year = Math.floor(year);
    game.data.fish = fish;
    game.save();
    await sleep(2600);
    for (const line of T.FINALE(fish, stars)) {
      if (!this.alive) return;
      await game.thoughts.show(line, { once: `sp:finale:${line.slice(0, 20)}`, hold: 6000 });
    }
    await sleep(2400);
    if (!this.alive) return;
    this.panel.root.classList.add('hidden');
    this.panel.stars.classList.add('hidden');
    await sleep(2200);
    if (!this.alive) return;
    void game.goto('ending', { year: Math.floor(year), fish, stars, startYear: s.startYear }, 'slow');
  }

  // ---------------------------------------------------------------- debug fast-forward

  /** Plays the economy forward with a competent autopilot until body `id` starts (or 'end'). */
  private skip(id: string) {
    const s = this.s;
    const target = id === 'end' ? null : S.BODY[id];
    const evs: S.SimEvent[] = [];
    // 'end' stops just after the final project is bought, so the live loop plays the finale.
    for (let i = 0; i < 200000; i++) {
      if (target ? s.mined[target.id] > 0 : id === 'recycle' ? s.seen.recycle !== undefined : s.recycling > 0 || s.complete) break;
      S.autopilot(s, 0.1, evs);
      S.step(s, 0.1, evs);
      evs.length = 0;
    }
    // Mark story beats that would have happened along the way as seen.
    const mark = (k: string, cond: boolean) => {
      if (cond && s.seen[k] === undefined) s.seen[k] = s.t;
    };
    mark('dlg:shell', S.has(s, 'shell'));
    mark('dlg:builder1', S.has(s, 'massdriver') && s.t - (s.bought.massdriver ?? s.t) > 1);
    mark('dlg:finn', S.isDone(s, 'venus'));
    mark('dlg:fusion', S.has(s, 'fusion'));
    mark('dlg:registry', S.isDone(s, 'neptune'));
    mark('dlg:builder2', S.isDone(s, 'saturn'));
    for (const b of S.BODIES) if (s.mined[b.id] > 0) s.seen[`start:${b.id}`] = s.seen[`start:${b.id}`] ?? s.t;
    this.framing = this.pickFraming();
    if (this.view) this.view.snapCamera(this.viewState());
    return { t: s.t, year: S.year(s), completion: S.completion(s) };
  }
}
