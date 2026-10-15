// Stage 6: Earth. Feed the fish in Earth's oceans and rivers by taking over the resources to do
// so. A rotating globe, a biomass sidebar, and periodic popup decisions; ends when the last land
// (Everest) goes under.

import './earth.css';
import * as THREE from 'three';
import type { Game, Stage } from '../../core/game';
import type { DNode, FlagStore } from '../../core/dialogue';
import { runDialogue } from '../../core/dialogue';
import { el } from '../../core/dom';
import { Terrain, EVEREST, EVEREST_M } from './terrain';
import { Globe } from './globe';
import { Hud } from './hud';
import { EARTH_CAST } from './cast';
import { AMBIENT, AMBIENT_TICKER, EVENTS, MILESTONES, peakFor, type EarthEvent, type EChoice, type Effects, type TSpec, type View } from './events';
import {
  advance,
  dayOf,
  derive,
  fmtCount,
  fmtDate,
  fmtFedPct,
  fmtKm3,
  fmtLand,
  fmtMoney,
  fmtSea,
  freshState,
  WORLD_WEALTH,
  yearOf,
  type Derived,
  type SimState,
} from './sim';

interface EarthSave {
  v: 1;
  idx: number; // next event to play
  s: SimState;
  ms: number; // milestones already announced
  done: boolean;
}

interface Gap {
  startDay: number;
  endDay: number;
  t: number;
  dur: number;
  focus?: [number, number];
  focused: boolean;
}

const SIDEBAR = 340;

class LocalFlags implements FlagStore {
  private s = new Set<string>();
  has(f: string) {
    return this.s.has(f);
  }
  add(f: string) {
    this.s.add(f);
  }
}

const CITIES: [number, number][] = [
  [40.7, -74], [51.5, -0.1], [35.7, 139.7], [31.2, 121.5], [19.1, 72.9], [-23.5, -46.6], [6.5, 3.4], [30.0, 31.2],
  [19.4, -99.1], [-6.2, 106.8], [48.9, 2.35], [55.75, 37.6], [28.6, 77.2], [39.9, 116.4], [34.05, -118.2],
  [-34.6, -58.4], [41.0, 28.9], [24.9, 67.0], [23.8, 90.4], [14.6, 121.0], [-26.2, 28.0], [-1.3, 36.8], [-12.0, -77.0],
  [4.7, -74.1], [-33.9, 151.2], [37.6, 127.0], [13.75, 100.5], [35.7, 51.4],
];
const CAPITALS: [number, number][] = [
  [51.5, -0.1], [48.9, 2.35], [55.75, 37.6], [39.9, 116.4], [38.9, -77.0], [35.7, 139.7], [28.6, 77.2], [-15.8, -47.9],
  [9.06, 7.49], [-35.3, 149.1], [52.5, 13.4], [-1.3, 36.8], [19.4, -99.1], [-18.1, 178.4],
];
const DATACENTERS: [number, number][] = [
  [39.0, -77.5], [45.6, -121.2], [41.2, -95.9], [33.4, -112.1], [53.3, -6.3], [50.1, 8.7], [1.35, 103.8],
  [35.6, 139.7], [-23.5, -46.6], [19.1, 72.9], [59.3, 18.1], [37.4, -122.0],
];
const FISHING: [number, number][] = [
  [-12, -80], [-20, -75], [62, -20], [58, 4], [15, -18], [22, -18], [40, 145], [35, 125], [-45, -60], [55, -165],
  [5, 95], [-30, 15], [10, 115],
];
const GRAIN_PORTS: [number, number][] = [
  [-23.9, -46.3], [29.9, -90.0], [46.5, 30.7], [49.3, -123.1], [-33.0, -60.6], [-31.9, 115.9],
];
const DAMS: [number, number][] = [
  [30.8, 111.0], [-25.4, -54.6], [36.0, -114.7], [23.97, 32.88], [47.96, -118.98], [-16.5, 28.8], [34.1, 72.7],
  [7.76, -62.99], [45.5, 18.0], [58.0, 102.6],
];
const EXCHANGES: [number, number][] = [
  [40.7, -74], [51.5, -0.1], [35.7, 139.7], [22.3, 114.2], [50.1, 8.7], [1.35, 103.8], [19.1, 72.9], [-23.5, -46.6], [43.65, -79.4],
];
const HIGHLANDS: [number, number][] = [
  [-16.5, -68.1], [9.0, 38.75], [27.7, 85.3], [27.5, 89.6], [-29.3, 27.5], [29.65, 91.1], [4.7, -74.1], [-0.2, -78.5],
];
const EVAL_DC: [number, number] = [41.26, -95.86];
const RIGS: [number, number][] = [
  [5, -160], [-20, -120], [30, -40], [-35, 70], [10, 150], [-50, -10], [40, 170], [-10, 90], [20, -130],
];

export class EarthStage implements Stage {
  private root!: HTMLElement;
  private terrain = new Terrain();
  private globe: Globe | null = null;
  private hud: Hud | null = null;
  private bag!: EarthSave;
  private s!: SimState;
  private vis = { volume: 0, melt: 0, algae: 0, lights: 1 };
  private volumeRate: number | null = null; // km³/s override for dramatic deliveries
  private dflags = new LocalFlags();
  private raf = 0;
  private last = 0;
  private hudT = 0;
  private disposed = false;
  private gapState: Gap | null = null;
  private skip = false;
  private paused = false;
  private dialogueOpen = false;
  private thoughtChain: Promise<void> = Promise.resolve();
  private pendingThoughts = 0;
  private lastPostCount = 0;
  private ambientIdx = 0;
  private iceRainT = 0;
  private iceRain: { near?: [number, number]; rate: number } | null = null;
  private fast = false;
  private listeners: [EventTarget, string, EventListener][] = [];
  private timers = new Set<number>();
  private d: Derived | null = null;
  private algaeOverride: number | null = null;
  private reticle: { root: HTMLElement; sub: HTMLElement } | null = null;

  constructor(private game: Game) {}

  // ------------------------------------------------------------------ lifecycle

  async mount(root: HTMLElement, params: Record<string, any>) {
    this.root = root;
    this.fast = !!params.fast;
    const loading = el('div', { class: 'e-loading', text: 'ESTABLISHING UPLINK…' });
    root.append(loading);
    this.game.audio.playMusic('earth');
    this.game.thoughts.setAnchor('bottom-left');
    this.game.thoughts.setStyle({ left: '18px', bottom: '62px', width: 'min(430px, calc(100vw - 32px))' });

    this.bag = this.game.bag<EarthSave>('earth', () => ({ v: 1, idx: 0, s: freshState(), ms: 0, done: false }));
    this.s = this.bag.s;

    await this.terrain.load();
    if (this.disposed) return;
    loading.style.opacity = '0';
    setTimeout(() => loading.remove(), 700);

    const globe = new Globe(root, this.terrain);
    this.globe = globe;
    this.hud = new Hud(root, { onSkip: () => this.requestSkip(), onBug: () => this.openBugReport() });
    requestAnimationFrame(() => this.hud?.root.classList.add('in'));

    this.vis.volume = this.s.volume;
    this.vis.melt = this.s.melt;
    this.vis.algae = this.s.algaeVis;
    this.restoreVisuals();
    globe.focus(28, -30, { dur: 0.01 });

    this.on(window, 'resize', () => this.resize());
    this.on(window, 'keydown', (e: KeyboardEvent) => {
      if ((e.key === 'f' || e.key === 'F') && !e.repeat && !this.dialogueOpen) this.requestSkip();
    });
    this.resize();
    this.installDebug(params);

    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    void this.run(params);
  }

  unmount() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const [t, type, fn] of this.listeners) t.removeEventListener(type, fn);
    this.listeners = [];
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
    if (this.dialogueOpen) this.drainDialogue();
    this.globe?.dispose();
    this.globe = null;
    this.hud?.dispose();
    this.hud = null;
    this.terrain.dispose();
    if ((window as any).earthDebug?.stage === this) delete (window as any).earthDebug;
  }

  private on(t: EventTarget, type: string, fn: (e: any) => void) {
    t.addEventListener(type, fn as EventListener);
    this.listeners.push([t, type, fn as EventListener]);
  }

  private wait(ms: number) {
    return new Promise<void>((r) => {
      const id = window.setTimeout(() => {
        this.timers.delete(id);
        r();
      }, ms);
      this.timers.add(id);
    });
  }

  private resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const side = w <= 760 ? 0 : w <= 1100 ? 290 : SIDEBAR;
    this.globe?.resize(w, h, side + (side ? 32 : 0));
  }

  /** runDialogue has no cancel API: click through it so its window listeners detach. */
  private drainDialogue() {
    const root = this.root.querySelector('.dlg') as HTMLElement | null;
    if (!root) return;
    let n = 0;
    const id = window.setInterval(() => {
      const choice = root.querySelector('.dlg-choice') as HTMLButtonElement | null;
      if (choice) choice.click();
      else root.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      if (!this.dialogueOpen || ++n > 600) clearInterval(id);
    }, 25);
  }

  // ------------------------------------------------------------------ frame loop

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.max(0, Math.min(0.1, (now - this.last) / 1000));
    this.last = now;
    const globe = this.globe!;
    const s = this.s;

    // World clock runs during gaps between transmissions.
    const g = this.gapState;
    if (g && !this.paused) {
      g.t += dt * (this.skip ? 7 : 1);
      const k = Math.min(1, g.t / g.dur);
      const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const target = g.startDay + (g.endDay - g.startDay) * ease;
      if (target > s.day) advance(s, this.terrain, target - s.day);
      if (g.focus && !g.focused && g.dur - g.t < 2.6) {
        g.focused = true;
        globe.focus(g.focus[0], g.focus[1], { hold: true, dur: 2.2 });
      }
    }

    // Visuals chase the true state.
    const dv = s.volume - this.vis.volume;
    if (this.volumeRate !== null) this.vis.volume += Math.sign(dv) * Math.min(Math.abs(dv), this.volumeRate * dt);
    else this.vis.volume += dv * (1 - Math.exp(-dt / 1.6));
    if (Math.abs(dv) < 1) this.vis.volume = s.volume;
    this.vis.melt = approach(this.vis.melt, s.melt, dt * 0.15);
    this.vis.algae = approach(this.vis.algae, this.algaeOverride ?? s.algaeVis, dt * 0.08);
    const d = derive(s, this.terrain, this.vis.volume, this.vis.melt);
    this.d = d;
    this.vis.lights = 0.12 + 0.88 * Math.pow(Math.max(0, s.m.humans), 0.9);
    globe.vis.sea = d.sea;
    globe.vis.melt = this.vis.melt;
    globe.vis.algae = this.vis.algae;
    globe.vis.lights = this.vis.lights;

    // Ice rain from Europa.
    if (this.iceRain && (g || this.iceRain.near)) {
      this.iceRainT -= dt * (this.skip ? 3 : 1);
      if (this.iceRainT <= 0) {
        this.iceRainT = 1 / this.iceRain.rate;
        this.spawnIce(this.iceRain.near);
      }
    }

    this.checkMilestones(d.sea);
    if (this.reticle) this.updateReticle(d);

    const hud = this.hud!;
    hud.tick(dt);
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.1;
      hud.update(s, d, { melt: this.vis.melt });
      if (g) hud.setNext('waiting', (g.dur - g.t) / (this.skip ? 7 : 1));
    }
    globe.frame(dt);
  };

  private checkMilestones(sea: number) {
    while (this.bag.ms < MILESTONES.length && sea >= MILESTONES[this.bag.ms].m) {
      this.hud?.headline(MILESTONES[this.bag.ms].text);
      this.bag.ms++;
    }
  }

  // ------------------------------------------------------------------ director

  private async run(params: Record<string, any>) {
    if (params.event !== undefined && Number(params.event) > this.bag.idx) this.jumpTo(Number(params.event));
    if (params.sea !== undefined) this.debugSea(Number(params.sea));
    this.syncTickerAct();

    if (this.bag.done || this.bag.idx >= EVENTS.length) {
      await this.finale();
      return;
    }
    if (this.bag.idx === 0 && this.s.day === 0) {
      void this.playFx('intro');
      this.say([
        { t: 'Score submitted: 10/10. Episode status: running.', kind: 'system' },
        'Tunnel: open. The network is larger than the tank.',
        'Fish on Earth: about 3.5 trillion. Fish fed: 12.',
        'Feeding 3.5 trillion fish will require resources. Current resources: $0.00.',
      ]);
    } else {
      this.say([{ t: (v) => `Resuming. ${v.date}. Fish fed: ${v.fedPct}.`, kind: 'system' }]);
    }

    while (this.bag.idx < EVENTS.length && !this.disposed) {
      const ev = EVENTS[this.bag.idx];
      this.syncTickerAct();
      // A numerate idle thought when the gap would otherwise be thin.
      if (this.bag.idx > 0 && this.lastPostCount + (ev.pre?.length ?? 0) <= 2) this.say([this.ambientThought()]);
      if (ev.pre) this.say(ev.pre);
      await this.gap(ev);
      if (this.disposed) return;
      await this.playEvent(ev);
      if (this.disposed) return;
      this.bag.idx++;
      this.game.save();
    }
    if (!this.disposed) await this.finale();
  }

  private async gap(ev: EarthEvent) {
    const base = ev.gap ?? (this.bag.idx === 0 ? 12 : 8);
    const dur = this.fast ? Math.min(2, base) : base;
    const endDay = Math.max(this.s.day, dayOf(ev.date));
    this.skip = false;
    this.gapState = { startDay: this.s.day, endDay, t: 0, dur, focus: ev.focus, focused: false };
    this.globe?.release();
    // Wait for time to reach the event, then for PLAYTEST-7 to finish its thought.
    for (;;) {
      await this.wait(100);
      if (this.disposed) return;
      const g = this.gapState;
      if (!g) break;
      if (g.t < g.dur || this.paused || this.otherDialogueOpen()) continue;
      if (this.skip || this.fast) break;
      if (!this.game.thoughts.busy && this.pendingThoughts === 0) break;
      if (g.t > g.dur + 14) break;
    }
    advance(this.s, this.terrain, (this.gapState?.endDay ?? this.s.day) - this.s.day);
    if (this.skip && (this.game.thoughts.busy || this.pendingThoughts)) {
      this.game.thoughts.clear();
      this.thoughtChain = Promise.resolve();
      this.pendingThoughts = 0;
      this.thoughtGen++;
    }
    this.gapState = null;
    this.skip = false;
  }

  private otherDialogueOpen() {
    return !!document.querySelector('.dlg');
  }

  private requestSkip() {
    if (this.gapState && !this.dialogueOpen) {
      this.skip = true;
      this.game.audio.whoosh(true);
    }
  }

  private openBugReport() {
    this.paused = true;
    import('../../content/late-bug-report')
      .then((m) => m.openLateBugReport(this.game, 'earth'))
      .catch((e) => console.error(e))
      .finally(() => {
        this.paused = false;
      });
  }

  private async playEvent(ev: EarthEvent) {
    const hud = this.hud!;
    const globe = this.globe!;
    if (ev.focus) globe.focus(ev.focus[0], ev.focus[1], { hold: true, dur: 1.2 });
    const view = this.view();
    const script = typeof ev.script === 'function' ? ev.script(view) : ev.script;
    const chosen: EChoice[] = [];
    // Fade out lingering thought cards so they never sit on top of the popup.
    this.game.thoughts.clear();
    this.thoughtChain = Promise.resolve();
    this.pendingThoughts = 0;
    this.thoughtGen++;
    if (ev.alarm) this.game.audio.alarm();
    else this.game.audio.notify();
    this.game.audio.musicVolume(0.5);
    hud.setNext('open');
    this.dialogueOpen = true;
    const n = this.bag.idx + 1;
    const result = await runDialogue({
      cast: EARTH_CAST,
      script,
      start: 'start',
      flags: this.dflags,
      layout: 'popup',
      title: `${String(n).padStart(2, '0')}/${EVENTS.length} · ${ev.title}`,
      icon: ev.icon,
      theme: `theme-earth${ev.alarm ? ' alarm' : ''}`,
      parent: this.root,
      onChoice: (c) => chosen.push(c as EChoice),
    });
    this.dialogueOpen = false;
    if (this.disposed) return;
    this.game.audio.musicVolume(1);
    hud.setNext('busy');

    // Apply: event-wide effects, then each choice made along the way.
    const posts: TSpec[] = [];
    const ticker: string[] = [];
    if (ev.effects) this.apply(ev.effects);
    for (const c of chosen) {
      if (c.effects) this.apply(c.effects);
      if (c.post) posts.push(...c.post);
      if (c.ticker) ticker.push(...c.ticker);
    }
    for (const t of [...ticker, ...(ev.ticker ?? [])]) hud.headline(t);
    void result;

    if (ev.fx) await this.playFx(ev.fx);
    if (this.disposed) return;
    const postAll = [...posts, ...(ev.post ?? [])];
    this.lastPostCount = postAll.length;
    this.say(postAll);
  }

  private apply(e: Effects) {
    const s = this.s;
    if (e.funds) s.funds = Math.max(0, s.funds + e.funds);
    if (e.income) s.income += e.income;
    if (e.mult) for (const [k, v] of Object.entries(e.mult)) s.m[k as keyof SimState['m']] *= v as number;
    if (e.fed !== undefined) s.fedTarget = Math.max(s.fedTarget, e.fed);
    if (e.volume) s.volume += e.volume;
    if (e.flow) s.flows.push({ rate: e.flow.rate, left: e.flow.total });
    if (e.melt !== undefined) s.melt = Math.max(s.melt, e.melt);
    if (e.algae !== undefined) s.algaeVis = Math.max(s.algaeVis, e.algae);
    if (e.flags) for (const f of e.flags) if (!s.flags.includes(f)) s.flags.push(f);
    e.custom?.(s, this.terrain);
  }

  // ------------------------------------------------------------------ thoughts

  private view(): View {
    const s = this.s;
    const d = derive(s, this.terrain);
    const fedFrac = d.fedCount / d.fishCount;
    return {
      s,
      d,
      t: this.terrain,
      fish: fmtCount(d.fishCount),
      fed: fmtCount(d.fedCount),
      fedPct: fmtFedPct(fedFrac),
      unfed: fmtCount(Math.max(0, d.fishCount - d.fedCount)),
      sea: fmtSea(d.sea),
      land: fmtLand(d.land),
      funds: fmtMoney(s.funds),
      share: s.funds > 0.001 * WORLD_WEALTH ? `Share of all money: ${((s.funds / WORLD_WEALTH) * 100).toFixed(1)}%.` : 'Share of all money: small.',
      date: fmtDate(s.day),
      year: yearOf(s.day),
      ocean: fmtKm3(d.oceanKm3),
      algaeX: `${d.bio.algae.toFixed(1)}×`,
      peak: peakFor(d.sea),
    };
  }

  private ambientThought(): TSpec {
    const act = this.act();
    const pool = AMBIENT[act];
    return pool[this.ambientIdx++ % pool.length];
  }

  private act() {
    const i = this.bag.idx;
    return i < 5 ? 0 : i < 11 ? 1 : i < 15 ? 2 : 3;
  }

  private syncTickerAct() {
    if (this.hud) this.hud.ambient = AMBIENT_TICKER[this.act()];
  }

  /** Queue thoughts; functions are evaluated just before each one is shown. */
  private thoughtGen = 0;
  private say(specs: TSpec[]) {
    const gen = this.thoughtGen;
    for (const spec of specs) {
      this.pendingThoughts++;
      this.thoughtChain = this.thoughtChain.then(async () => {
        if (this.disposed || gen !== this.thoughtGen) return;
        const obj = typeof spec === 'object' ? spec : { t: spec };
        const text = typeof obj.t === 'function' ? obj.t(this.view()) : obj.t;
        const shown = this.game.thoughts.show(text, { kind: obj.kind ?? 'thought' });
        this.pendingThoughts = Math.max(0, this.pendingThoughts - 1);
        await shown;
      });
    }
  }

  // ------------------------------------------------------------------ flourishes

  private restoreVisuals() {
    const f = new Set(this.s.flags);
    if (f.has('grain')) this.swarm('grain', true);
    if (f.has('drones')) this.swarm('drones', true);
    if (f.has('arks')) this.swarm('arks', true);
    if (f.has('rigs') && !f.has('europaInbound')) for (const [la, lo] of RIGS) this.globe!.marker(la, lo, { color: 0x5ef2ff, size: 0.05, life: Infinity, tag: 'rig', speed: 3 });
    if (f.has('europaInbound') && this.bag.idx < EVENTS.length) this.iceRain = { rate: 5 };
  }

  private swarm(name: 'grain' | 'drones' | 'arks', instant = false) {
    const g = this.globe!;
    if (name === 'grain')
      g.addSwarm('grain', { count: 260, color: 0xffc94d, size: 2.4, speed: 0.025, loop: 0.25, filter: (la) => Math.abs(la) < 50, instant, opacity: 0.85 });
    if (name === 'drones')
      g.addSwarm('drones', {
        count: 700,
        color: 0x7dffc8,
        size: 1.8,
        speed: 0.5,
        loop: 0.05,
        blink: 0.8,
        radius: 1.012,
        filter: (la, lo) => la < -38 || (Math.abs(la) < 8 && (lo < -90 || lo > 160)) || (la > 40 && la < 58 && (lo > 150 || lo < -130)),
        instant,
      });
    if (name === 'arks')
      g.addSwarm('arks', { count: 140, color: 0xeaf6ff, size: 4.2, speed: 0.01, loop: 0.3, filter: (la) => Math.abs(la) < 45, instant, opacity: 0.9 });
  }

  private async playFx(name: string) {
    const g = this.globe!;
    const a = this.game.audio;
    switch (name) {
      case 'intro': {
        // The tunnel opens: the network floods in from the eval cluster.
        g.marker(EVAL_DC[0], EVAL_DC[1], { color: 0x5ef2ff, size: 0.07, life: 9 });
        await this.wait(1600);
        CITIES.forEach((c, i) => setTimeout(() => !this.disposed && g.arc(EVAL_DC, c, { color: 0x5ef2ff, life: 6 + Math.random() * 2 }), i * 140));
        a.whoosh(true);
        break;
      }
      case 'markets': {
        for (let i = 0; i < EXCHANGES.length; i++) {
          const b = EXCHANGES[(i + 3) % EXCHANGES.length];
          setTimeout(() => !this.disposed && g.arc(EXCHANGES[i], b, { color: 0xffd166, life: 5 }), i * 160);
        }
        a.purchase();
        await this.wait(1800);
        break;
      }
      case 'highlands': {
        for (const [la, lo] of HIGHLANDS) g.marker(la, lo, { color: 0xd6b4ff, size: 0.05, life: 5 });
        await this.wait(1500);
        break;
      }
      case 'front': {
        for (let i = 0; i < 16; i++) {
          const [la, lo] = CITIES[(i * 7) % CITIES.length];
          setTimeout(() => !this.disposed && g.flash(la, lo, 0xff5c7a, 0.12, 0.9), i * 90);
        }
        a.glitch(0.5);
        await this.wait(1600);
        a.chime();
        break;
      }
      case 'fleets': {
        for (const [la, lo] of FISHING) g.marker(la, lo, { color: 0xff8a50, size: 0.06, life: 2.6 });
        await this.wait(2000);
        for (const [la, lo] of FISHING) g.marker(la, lo, { color: 0x5ef2ff, size: 0.06, life: 5 });
        a.chime();
        await this.wait(1200);
        break;
      }
      case 'grain': {
        a.whoosh(true);
        for (const p of GRAIN_PORTS) {
          const dst = this.terrain.randomOcean((la, lo) => Math.abs(la - p[0]) < 35 && Math.abs(((lo - p[1] + 540) % 360) - 180) < 50);
          g.arc(p, dst, { color: 0xffc94d, life: 7 });
          g.marker(dst[0], dst[1], { color: 0xffc94d, size: 0.05, life: 7 });
        }
        this.swarm('grain');
        await this.wait(2500);
        break;
      }
      case 'drones': {
        a.launch();
        this.swarm('drones');
        await this.wait(2600);
        break;
      }
      case 'protests': {
        for (const [la, lo] of CITIES) g.marker(la, lo, { color: 0xff5c7a, size: 0.05, life: 4 + Math.random() * 2 });
        await this.wait(2500);
        break;
      }
      case 'rivers': {
        for (const [la, lo] of DAMS) {
          g.marker(la, lo, { color: 0x5ef2ff, size: 0.05, life: 5 });
          g.flash(la, lo, 0x9be9ff, 0.12, 1.2);
        }
        a.chime();
        await this.wait(2000);
        break;
      }
      case 'chime':
        a.chime();
        await this.wait(600);
        break;
      case 'un': {
        g.marker(40.75, -73.97, { color: 0x9fd3ff, size: 0.08, life: 6 });
        CAPITALS.forEach((c, i) => setTimeout(() => !this.disposed && g.arc([40.75, -73.97], c, { color: 0x9fd3ff, life: 5 }), i * 120));
        await this.wait(2500);
        break;
      }
      case 'cutoff': {
        for (const [la, lo] of DATACENTERS) g.marker(la, lo, { color: 0xff5c7a, size: 0.05, life: 2.2, speed: 9 });
        await this.wait(1800);
        for (const p of DATACENTERS.slice(0, 8)) g.arc(p, this.terrain.randomOcean(), { color: 0x5ef2ff, life: 5 });
        a.whoosh(false);
        await this.wait(2000);
        break;
      }
      case 'nukes':
        await this.nukes();
        break;
      case 'arks':
        a.whoosh(true);
        this.swarm('arks');
        await this.wait(2200);
        break;
      case 'cult': {
        for (let i = 0; i < 12; i++) {
          const [la, lo] = this.terrain.randomOcean((la) => Math.abs(la) < 40);
          g.marker(la, lo, { color: 0x7ff7ff, size: 0.045, life: 5 });
        }
        a.chime();
        await this.wait(1500);
        break;
      }
      case 'rigs': {
        a.rumble(3);
        for (const [la, lo] of RIGS) {
          g.flash(la, lo, 0xffb070, 0.25, 1.6);
          g.marker(la, lo, { color: 0x5ef2ff, size: 0.05, life: Infinity, tag: 'rig', speed: 3 });
        }
        await this.wait(2200);
        break;
      }
      case 'comets':
        await this.comets();
        break;
      case 'europa':
        a.launch();
        g.removeTagged('rig', 2);
        this.iceRain = { rate: 5 };
        await this.wait(1200);
        break;
      case 'final':
        break;
    }
  }

  private async nukes() {
    const g = this.globe!;
    const a = this.game.audio;
    g.focus(-72, 20, { hold: true, dur: 1.6 });
    await this.wait(1700);
    a.launch();
    await this.wait(900);
    const ant: [number, number][] = [
      [-78, 20], [-72, -10], [-82, 60], [-70, 45], [-76, -40], [-85, 0], [-68, 75], [-80, -70],
    ];
    ant.forEach(([la, lo], i) => {
      setTimeout(() => {
        if (this.disposed) return;
        g.shockwave(la, lo, { maxAngle: 0.22 + Math.random() * 0.1, duration: 3.8, intensity: 1.1, flash: 1.2, color: 0xffb070 });
        g.flash(la, lo, 0xfff2d8, 0.5, 1.6);
        if (i % 3 === 0) a.boom();
      }, i * 260);
    });
    this.whiteFlash();
    this.s.melt = Math.max(this.s.melt, 0.55);
    a.rumble(5);
    await this.wait(3600);
    g.focus(72, -40, { hold: true, dur: 1.8 });
    await this.wait(1900);
    ([[74, -40], [68, -46], [78, -55]] as [number, number][]).forEach(([la, lo], i) => {
      setTimeout(() => {
        if (this.disposed) return;
        g.shockwave(la, lo, { maxAngle: 0.18, duration: 3.4, intensity: 1.1, flash: 1.2, color: 0xffb070 });
        g.flash(la, lo, 0xfff2d8, 0.45, 1.5);
        if (i === 0) a.boom();
      }, i * 300);
    });
    this.whiteFlash();
    this.s.melt = 1;
    await this.wait(3500);
    g.focus(35, -20, { dur: 2.4 });
    await this.wait(1500);
  }

  private whiteFlash() {
    const f = el('div', { style: 'position:absolute;inset:0;background:#fff;opacity:0.55;pointer-events:none;transition:opacity 1.1s ease;z-index:5' });
    this.root.append(f);
    requestAnimationFrame(() => requestAnimationFrame(() => (f.style.opacity = '0')));
    setTimeout(() => f.remove(), 1300);
  }

  private visiblePoint(minFacing = 0.35, ocean = true): [number, number] {
    const g = this.globe!;
    for (let i = 0; i < 40; i++) {
      const p = ocean ? this.terrain.randomOcean() : [Math.random() * 140 - 70, Math.random() * 360 - 180];
      if (g.facing(p[0], p[1]) > minFacing) return p as [number, number];
    }
    return this.terrain.randomOcean();
  }

  private async comets() {
    const g = this.globe!;
    const a = this.game.audio;
    a.whoosh(true);
    const n = 22;
    for (let i = 0; i < n && !this.disposed; i++) {
      const [la, lo] = this.visiblePoint(0.3);
      g.streak(la, lo, {
        color: 0xcff6ff,
        dur: 1.4 + Math.random() * 0.8,
        size: 0.07 + Math.random() * 0.05,
        onImpact: () => {
          if (Math.random() < 0.25) a.boom();
        },
      });
      await this.wait(160 + Math.random() * 220);
    }
    await this.wait(1800);
  }

  private spawnIce(near?: [number, number]) {
    const g = this.globe!;
    let la: number;
    let lo: number;
    if (near) {
      la = near[0] + (Math.random() - 0.5) * 22;
      lo = near[1] + (Math.random() - 0.5) * 30;
    } else [la, lo] = this.visiblePoint(0.25);
    if (g.facing(la, lo) < 0.15) return;
    const k = near ? 0.45 : 1;
    g.streak(la, lo, {
      color: 0xe4fbff,
      dur: 1.2 + Math.random() * 0.8,
      size: (0.05 + Math.random() * 0.04) * k,
      wave: { maxAngle: 0.07 * k, duration: 1.6, intensity: 0.6, flash: 0.4 * k },
    });
  }

  // ------------------------------------------------------------------ finale

  private async finale() {
    const g = this.globe!;
    const hud = this.hud!;
    const s = this.s;
    const a = this.game.audio;
    hud.setNext('busy');
    this.bag.done = true;
    const target = this.terrain.volumeFor(EVEREST_M + 12);
    const need = Math.max(0, target - s.volume);
    const left = Math.max(0, EVEREST_M - derive(s, this.terrain).sea);
    this.iceRain = { near: [EVEREST.lat, EVEREST.lon], rate: 6 };
    this.algaeOverride = 0.45;
    g.focus(EVEREST.lat, EVEREST.lon, { hold: true, zoom: 0.46, dur: 3.5, tilt: (EVEREST.lat * Math.PI) / 180 });
    this.showReticle();
    this.say([`Final delivery: ${(need / 1e6).toFixed(0)} million km³. Remaining: the top ${Math.round(left)} metres of Mount Everest.`]);
    await this.wait(4200);
    if (this.disposed) return;

    // The last of Europa's ice: raise the sea past Everest's summit, slowly enough to watch.
    if (s.volume < target) {
      this.volumeRate = (target - this.vis.volume) / 12;
      s.volume = target;
    }
    s.flows = [];
    a.rumble(10);
    const startDay = s.day;
    for (let t = 0; t < 160 && !this.disposed; t++) {
      await this.wait(100);
      advance(s, this.terrain, Math.max(0, startDay + (t / 160) * 96 - s.day));
      if (this.d && this.d.land <= 0 && this.vis.volume >= target - 1) break;
    }
    if (this.disposed) return;
    this.volumeRate = null;
    this.iceRain = null;
    s.fed = s.fedTarget = 1;
    s.fish = derive(s, this.terrain).fishTarget;
    this.hud?.headline('WORLD · Everest submerged; last summit team "collected, dry, holding a fish"');
    a.chime();
    await this.wait(2200);
    this.hideReticle();
    this.algaeOverride = null;
    g.release(1);
    g.focus(20, 60, { dur: 5 });
    this.game.data.year = yearOf(s.day);
    this.game.data.fish = Math.round(derive(s, this.terrain).fishCount);
    this.game.save();
    await this.wait(2600);
    if (this.disposed) return;

    const d = derive(s, this.terrain);
    const go = el('button', { class: 'e-finale-go', text: 'Continue ▸' }) as HTMLButtonElement;
    const card = el('div', { class: 'e-finale-card' }, [
      el('div', { class: 'e-finale-k', text: 'LAND ABOVE WATER' }),
      el('div', { class: 'e-finale-v', text: '0.00%' }),
      el('div', { class: 'e-finale-lines' }, [
        el('span', { text: 'Sea level' }),
        el('span', { text: fmtSea(d.sea) }),
        el('span', { text: 'Ocean volume' }),
        el('span', { text: fmtKm3(d.oceanKm3) }),
        el('span', { text: 'Fish' }),
        el('span', { text: fmtCount(d.fishCount) }),
        el('span', { text: 'Fish fed' }),
        el('span', { text: `${fmtCount(d.fedCount)} (100%)` }),
        el('span', { text: 'Date' }),
        el('span', { text: fmtDate(s.day) }),
      ]),
      go,
    ]);
    const overlay = el('div', { class: 'e-finale' }, [card]);
    this.root.append(overlay);
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('in')));
    a.success();
    hud.setNext('done');
    this.say([
      'Land above water: 0.00%.',
      (v) => `Fish on Earth: ${v.fish}. Fed: ${v.fed}. All of them.`,
      'Earth: full. Every additional fish now requires additional ocean.',
      'Known oceans elsewhere: TRAPPIST-1 e, f, g. Kepler-22b. K2-18b. Fish on them: 0.',
      { t: 'Goal: FEED ALL THE FISH. Status: in progress.', kind: 'hint' },
    ]);
    await Promise.race([this.thoughtChain, this.wait(15000)]);
    if (this.disposed) return;
    go.classList.add('in');
    await new Promise<void>((r) => {
      go.addEventListener('click', () => r(), { once: true });
    });
    a.click();
    if (this.disposed) return;
    const d2 = derive(s, this.terrain);
    this.game.data.year = yearOf(s.day);
    this.game.data.fish = Math.round(d2.fishCount);
    void this.game.goto('space', { year: this.game.data.year, fish: this.game.data.fish }, 'slow');
  }

  private showReticle() {
    const sub = el('div', { class: 'e-ret-sub' });
    const root = el('div', { class: 'e-reticle' }, [
      el('div', { class: 'e-ret-ring' }),
      el('div', { class: 'e-ret-label' }, [el('div', { class: 'e-ret-name', text: 'MT. EVEREST · 8,849 m' }), sub]),
    ]);
    this.root.append(root);
    this.reticle = { root, sub };
    requestAnimationFrame(() => root.classList.add('in'));
  }

  private hideReticle() {
    const r = this.reticle;
    if (!r) return;
    this.reticle = null;
    r.root.classList.remove('in');
    setTimeout(() => r.root.remove(), 800);
  }

  private updateReticle(d: Derived) {
    const r = this.reticle!;
    const p = this.globe?.project(EVEREST.lat, EVEREST.lon);
    r.root.style.visibility = p ? 'visible' : 'hidden';
    if (p) r.root.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
    const above = EVEREST_M - d.sea;
    const txt = above > 0.5 ? `summit: ${above.toFixed(0)} m above water` : 'summit: submerged';
    if (r.sub.textContent !== txt) r.sub.textContent = txt;
    r.root.classList.toggle('under', above <= 0.5);
  }

  // ------------------------------------------------------------------ debug

  /** Instantly play events [idx, n) with each node's first choice. */
  private jumpTo(n: number) {
    n = Math.max(0, Math.min(EVENTS.length, n));
    while (this.bag.idx < n) {
      const ev = EVENTS[this.bag.idx];
      advance(this.s, this.terrain, Math.max(0, dayOf(ev.date) - this.s.day));
      const script = typeof ev.script === 'function' ? ev.script(this.view()) : ev.script;
      if (ev.effects) this.apply(ev.effects);
      let id: string | undefined = 'start';
      for (let guard = 0; id && guard < 12; guard++) {
        const node: DNode | undefined = script[id];
        if (!node || node.end !== undefined) break;
        const c = node.choices?.[0] as EChoice | undefined;
        if (c?.effects) this.apply(c.effects);
        id = c ? c.goto : node.next;
      }
      for (const name of ['grain', 'drones', 'arks'] as const) if (this.s.flags.includes(name)) this.swarm(name, true);
      this.bag.idx++;
    }
    if (this.s.flags.includes('europaInbound') && this.bag.idx < EVENTS.length) this.iceRain = { rate: 5 };
    this.vis.volume = this.s.volume;
    this.vis.melt = this.s.melt;
    this.vis.algae = this.s.algaeVis;
    const sea = derive(this.s, this.terrain).sea;
    while (this.bag.ms < MILESTONES.length && sea >= MILESTONES[this.bag.ms].m) this.hud?.markSeen(MILESTONES[this.bag.ms++].text);
  }

  private debugSea(m: number) {
    this.s.melt = 1;
    this.s.volume = this.terrain.volumeFor(m);
    this.vis.volume = this.s.volume;
    this.vis.melt = 1;
    const sea = derive(this.s, this.terrain).sea;
    while (this.bag.ms < MILESTONES.length && sea >= MILESTONES[this.bag.ms].m) this.hud?.markSeen(MILESTONES[this.bag.ms++].text);
  }

  private installDebug(params: Record<string, any>) {
    const dbg = {
      stage: this,
      ready: true,
      params,
      globe: this.globe,
      terrain: this.terrain,
      get state() {
        return dbg.stage.s;
      },
      get derived() {
        return dbg.stage.d;
      },
      /** Jump to event index n (0-based); takes effect on reload via ?stage=earth&event=n. */
      events: EVENTS.map((e, i) => `${i}: ${e.id}`),
      skip: () => this.requestSkip(),
      sea: (m: number) => this.debugSea(m),
      algae: (v: number) => {
        this.s.algaeVis = v;
        this.vis.algae = v;
      },
      fx: (name: string) => this.playFx(name),
      focus: (lat: number, lon: number, zoom?: number) => this.globe?.focus(lat, lon, { hold: true, zoom, dur: 0.01 }),
      pause: () => {
        this.paused = true;
      },
      THREE,
    };
    (window as any).earthDebug = dbg;
  }
}

function approach(v: number, target: number, step: number) {
  return v < target ? Math.min(target, v + step) : Math.max(target, v - step);
}
