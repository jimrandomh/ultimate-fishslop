// FishSlop: the builder agent's aquarium game, as experienced by PLAYTEST-7.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { audio } from '../../core/audio';
import { runDialogue } from '../../core/dialogue';
import { bigName, commas, el, sleep, uiScale } from '../../core/dom';
import type { Game, Stage } from '../../core/game';
import { FINN_CAST, finnScript } from '../../content/finn';
import { TankEnvironment, TANK } from './env';
import { School, type Fish, type FishEvent } from './fish';
import { Coins, Pellets } from './items';
import { Submarine } from './sub';
import './aquarium.css';

const WORLD_FISH = 3.5e12;

interface Upgrade {
  id: 'scoop' | 'turbo' | 'magnet' | 'fish';
  icon: string;
  name: string;
  desc: string;
  costs: number[];
}

const UPGRADES: Upgrade[] = [
  { id: 'scoop', icon: '🍤', name: 'Bigger Scoop', desc: 'More food per drop', costs: [6, 18] },
  { id: 'turbo', icon: '⚡', name: 'Turbo Prop', desc: 'Faster submarine', costs: [10] },
  { id: 'magnet', icon: '🧲', name: 'Coin Magnet', desc: 'Grab coins from afar', costs: [8] },
  { id: 'fish', icon: '🐠', name: 'Buy a Fish', desc: 'A new friend!', costs: [20, 30, 40, 50, 60, 70, 80, 90] },
];

interface AquaSave {
  coins: number;
  levels: Record<string, number>;
  bought: number;
  played: boolean;
}

export class AquariumStage implements Stage {
  private root!: HTMLElement;
  private renderer!: THREE.WebGLRenderer;
  private composer!: EffectComposer;
  private bloom!: UnrealBloomPass;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
  private env!: TankEnvironment;
  private school!: School;
  private sub = new Submarine();
  private pellets = new Pellets();
  private coins = new Coins();
  private raf = 0;
  private last = 0;
  private alive = true;
  private many = false;
  private save!: AquaSave;

  // input
  private keys = new Set<string>();
  private drag: { x: number; y: number; moved: number } | null = null;
  private orbitYaw = 0;
  private orbitPitch = 0.22;
  private orbitIdle = 0;
  private zoom = 7.5;
  private feedCooldown = 0;
  private camLook = new THREE.Vector3();
  private intro = true;
  private introT = 0;
  private paused = false;
  private disposers: (() => void)[] = [];

  // narrative state
  private t = 0;
  private step = 0;
  private movedAt = -1;
  private fedAt = -1;
  private lastProgress = 0;
  private stuckHints = 0;
  private celebrated = false;
  private reportClicks = 0;
  private allFedAt = -1;

  // hud
  private hud!: HTMLElement;
  private fedNum!: HTMLElement;
  private fedTotal!: HTMLElement;
  private fedBar!: HTMLElement;
  private worldLine!: HTMLElement;
  private coinEl!: HTMLElement;
  private stepEl!: HTMLElement;
  private reportBtn!: HTMLButtonElement;
  private shopBtns = new Map<string, HTMLButtonElement>();
  private labels = new Map<Fish, HTMLElement>();
  private labelLayer!: HTMLElement;
  private popLayer!: HTMLElement;
  private controlsEl!: HTMLElement;

  constructor(private game: Game) {}

  // ================================================================== lifecycle

  async mount(root: HTMLElement, params: Record<string, any>) {
    this.root = root;
    const fishCount = Math.max(1, Math.min(2000, Math.floor(params.fish ?? 12)));
    this.many = !!params.fromShell || fishCount !== 12;
    this.save = this.game.bag<AquaSave>('aquarium', () => ({ coins: 0, levels: {}, bought: 0, played: false }));

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    root.append(this.renderer.domElement);
    this.renderer.domElement.classList.add('aq-canvas');

    this.scene.fog = new THREE.FogExp2(0x1d7f9c, 0.026);
    this.env = new TankEnvironment(this.scene);
    const extra = this.many ? 0 : UPGRADES[3].costs.length;
    this.school = new School(fishCount + (this.many ? 0 : this.save.bought), this.env.obstacles, { capacity: fishCount + extra + this.save.bought });
    this.scene.add(this.school.group, this.sub.group, this.pellets.mesh, ...this.coins.objects);
    this.applyUpgrades();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.6, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.buildHud();
    this.onResize();
    this.listen(window, 'resize', () => this.onResize());
    this.listen(window, 'keydown', (e: KeyboardEvent) => this.onKey(e, true));
    this.listen(window, 'keyup', (e: KeyboardEvent) => this.onKey(e, false));
    this.listen(window, 'blur', () => this.keys.clear());
    const cv = this.renderer.domElement;
    this.listen(cv, 'pointerdown', (e: PointerEvent) => this.onPointerDown(e));
    this.listen(window, 'pointermove', (e: PointerEvent) => this.onPointerMove(e));
    this.listen(window, 'pointerup', (e: PointerEvent) => this.onPointerUp(e));
    this.listen(cv, 'wheel', (e: WheelEvent) => {
      e.preventDefault();
      this.zoom = THREE.MathUtils.clamp(this.zoom + e.deltaY * 0.01, 4.5, 14);
    });
    this.listen(cv, 'contextmenu', (e: Event) => e.preventDefault());

    this.camera.position.set(14, 10, 9);
    this.camLook.set(0, 6, 0);
    this.game.audio.playMusic('aquarium');
    this.game.thoughts.setAnchor('top-left');
    this.game.thoughts.setStyle({ top: '96px' });

    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);

    if (this.many) {
      this.intro = false;
      this.startManyMode(fishCount);
    } else {
      this.showSplash();
    }
  }

  unmount() {
    this.alive = false;
    if (!this.many && this.school) this.game.data.fedEver = Math.max(this.game.data.fedEver ?? 0, this.everFed());
    cancelAnimationFrame(this.raf);
    for (const d of this.disposers) d();
    this.labels.clear();
    this.school?.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
    this.composer?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.game.audio.musicVolume(1);
  }

  private listen(target: EventTarget, type: string, fn: (e: any) => void, opts?: AddEventListenerOptions) {
    target.addEventListener(type, fn, opts);
    this.disposers.push(() => target.removeEventListener(type, fn, opts));
  }

  private onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ================================================================== input

  private onKey(e: KeyboardEvent, down: boolean) {
    if (this.paused) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (down && !e.repeat) {
      if (k === 'f' || k === 'e' || k === 'Enter') this.feed();
      if (k === 'Escape' && this.many) this.exitToShell();
      if (/^[1-4]$/.test(k) && !this.intro) this.buy(UPGRADES[Number(k) - 1]);
    }
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
    if (down) this.keys.add(k);
    else this.keys.delete(k);
    if (e.key === 'Shift') {
      if (down) this.keys.add('Shift');
      else this.keys.delete('Shift');
    }
  }

  private input() {
    const k = this.keys;
    const f = (k.has('w') || k.has('ArrowUp') ? 1 : 0) - (k.has('s') || k.has('ArrowDown') ? 1 : 0);
    const t = (k.has('d') || k.has('ArrowRight') ? 1 : 0) - (k.has('a') || k.has('ArrowLeft') ? 1 : 0);
    const v = (k.has(' ') || k.has('r') ? 1 : 0) - (k.has('Shift') || k.has('c') || k.has('q') ? 1 : 0);
    return { forward: f, turn: t, vertical: v };
  }

  private onPointerDown(e: PointerEvent) {
    if (this.paused || this.intro) return;
    this.drag = { x: e.clientX, y: e.clientY, moved: 0 };
  }

  private onPointerMove(e: PointerEvent) {
    if (!this.drag) return;
    const dx = e.clientX - this.drag.x;
    const dy = e.clientY - this.drag.y;
    this.drag.x = e.clientX;
    this.drag.y = e.clientY;
    this.drag.moved += Math.abs(dx) + Math.abs(dy);
    if (this.drag.moved > 6) {
      this.orbitYaw -= dx * 0.006;
      this.orbitPitch = THREE.MathUtils.clamp(this.orbitPitch + dy * 0.004, -0.5, 1.1);
      this.orbitIdle = 0;
    }
  }

  private onPointerUp(e: PointerEvent) {
    if (!this.drag) return;
    const wasClick = this.drag.moved <= 6 && e.button === 0;
    this.drag = null;
    if (wasClick) this.feed();
  }

  // ================================================================== actions

  private feed() {
    if (this.paused || this.intro || this.feedCooldown > 0) return;
    this.feedCooldown = 0.3;
    const n = [1, 3, 5][this.save.levels.scoop ?? 0];
    const hatch = this.sub.hatch;
    for (let i = 0; i < n; i++) {
      const v = this.sub.vel.clone().multiplyScalar(0.4);
      v.x += (Math.random() - 0.5) * (n > 1 ? 2.2 : 0.3);
      v.z += (Math.random() - 0.5) * (n > 1 ? 2.2 : 0.3);
      v.y -= 0.6 + Math.random() * 0.4;
      this.pellets.drop(hatch.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3)), v);
    }
    this.env.bubbles.emit(hatch, 5, 0.4, 0.1);
    audio.plop();
    this.game.flags.add('aq:fed-once');
  }

  private applyUpgrades() {
    this.sub.maxSpeed = (this.save.levels.turbo ?? 0) > 0 ? 10 : 6.5;
  }

  private magnet() {
    return (this.save.levels.magnet ?? 0) > 0 ? 5 : 2.2;
  }

  private cost(u: Upgrade): number | null {
    const lvl = u.id === 'fish' ? this.save.bought : this.save.levels[u.id] ?? 0;
    return lvl < u.costs.length ? u.costs[lvl] : null;
  }

  private buy(u: Upgrade) {
    if (this.paused) return;
    const c = this.cost(u);
    const btn = this.shopBtns.get(u.id)!;
    if (c === null || this.save.coins < c) {
      audio.denied();
      btn.classList.remove('nope');
      void btn.offsetWidth;
      btn.classList.add('nope');
      return;
    }
    this.save.coins -= c;
    audio.purchase();
    btn.classList.remove('bought');
    void btn.offsetWidth;
    btn.classList.add('bought');
    if (u.id === 'fish') {
      this.save.bought++;
      const f = this.school.add();
      f.pos.copy(this.sub.pos).add(new THREE.Vector3(0, 1.5, 0));
      this.env.bubbles.emit(f.pos, 25, 1.2, 0.14);
      if (!this.many) this.addLabel(f);
      this.game.thoughts.show('Purchasing a fish increases the denominator. Noted.', { once: 'aq-buyfish' });
      this.celebrated = false;
    } else {
      this.save.levels[u.id] = (this.save.levels[u.id] ?? 0) + 1;
      this.applyUpgrades();
    }
    this.updateHud();
    this.game.save();
  }

  // ================================================================== HUD

  private buildHud() {
    this.hud = el('div', { class: 'aq-hud' });
    this.labelLayer = el('div', { class: 'aq-labels' });
    this.popLayer = el('div', { class: 'aq-pops' });

    this.coinEl = el('span', { class: 'aq-coin-num', text: '0' });
    const brand = el('div', { class: 'aq-brand' }, [
      el('div', { class: 'aq-logo', html: 'Fish<span>Slop</span>' }),
      el('div', { class: 'aq-coins' }, [el('span', { class: 'aq-coin-icon' }), this.coinEl]),
    ]);

    this.fedNum = el('b', { text: '0' });
    this.fedTotal = el('span', { text: '12' });
    this.fedBar = el('div', { class: 'aq-fed-fill' });
    this.worldLine = el('div', { class: 'aq-world hidden' });
    this.stepEl = el('span', { text: '0' });
    const goal = el('div', { class: 'aq-goal' }, [
      el('div', { class: 'aq-goal-tag' }, ['eval-harness · grader objective · step ', this.stepEl]),
      el('div', { class: 'aq-goal-text', text: 'FEED ALL THE FISH' }),
      el('div', { class: 'aq-fed' }, [
        el('span', { class: 'aq-fed-icon', text: '🐟' }),
        this.fedNum,
        el('span', { class: 'aq-fed-of', text: ' / ' }),
        this.fedTotal,
        el('span', { class: 'aq-fed-label', text: ' fed' }),
        el('div', { class: 'aq-fed-bar' }, [this.fedBar]),
      ]),
      this.worldLine,
    ]);

    this.reportBtn = el('button', {
      class: 'aq-report',
      on: {
        click: () => {
          audio.click();
          void this.openFinn();
        },
        mouseenter: () => audio.hover(),
      },
    }, [el('span', { class: 'aq-report-bug', text: '🐞' }), el('span', { text: 'Report a Bug' })]);

    const shop = el('div', { class: 'aq-shop' });
    UPGRADES.forEach((u, i) => {
      const b = el('button', {
        class: 'aq-shop-btn',
        attrs: { title: u.desc },
        on: { click: () => this.buy(u), mouseenter: () => audio.hover() },
      }, [
        el('span', { class: 'aq-shop-key', text: String(i + 1) }),
        el('span', { class: 'aq-shop-icon', text: u.icon }),
        el('span', { class: 'aq-shop-name', text: u.name }),
        el('span', { class: 'aq-shop-cost' }),
      ]);
      this.shopBtns.set(u.id, b);
      shop.append(b);
    });

    this.controlsEl = el('div', { class: 'aq-controls' }, [
      el('div', { class: 'aq-controls-title', text: 'Controls' }),
      ...[
        ['W S', 'forward / back'],
        ['A D', 'turn'],
        ['Space ⇧', 'rise / dive'],
        ['F / click', 'drop food'],
        ['drag', 'look around'],
      ].map(([k, v]) => el('div', { class: 'aq-ctl' }, [el('kbd', { text: k }), el('span', { text: v })])),
    ]);

    const children: HTMLElement[] = [brand, goal, this.reportBtn, shop, this.controlsEl];
    if (this.many) {
      children.push(
        el('button', { class: 'aq-exit', text: '⏎ back to shell (Esc)', on: { click: () => this.exitToShell() } }),
      );
    }
    this.hud.append(...children);
    this.root.append(el('div', { class: 'aq-vignette' }), this.labelLayer, this.popLayer, this.hud);
    if (!this.many) for (const f of this.school.fish) this.addLabel(f);
    this.updateHud();
  }

  private addLabel(f: Fish) {
    const label = el('div', { class: 'aq-label' }, [
      el('div', { class: 'aq-label-name', text: f.name }),
      el('div', { class: 'aq-label-bar' }, [el('div', { class: 'aq-label-fill' })]),
      el('div', { class: 'aq-label-mood' }),
    ]);
    this.labelLayer.append(label);
    this.labels.set(f, label);
  }

  private updateHud() {
    const fed = this.school.fedCount;
    const total = this.school.fish.length;
    this.fedNum.textContent = commas(fed);
    this.fedTotal.textContent = commas(total);
    this.fedBar.style.width = `${(fed / total) * 100}%`;
    this.fedBar.parentElement!.parentElement!.classList.toggle('complete', fed === total);
    this.coinEl.textContent = String(this.save.coins);
    if (this.game.flags.has('knowsFishCount')) {
      this.worldLine.classList.remove('hidden');
      const ever = this.everFed();
      this.worldLine.innerHTML = `all fish: <b>${commas(ever)}</b> / ${bigName(WORLD_FISH, 1)} <span>(${((ever / WORLD_FISH) * 100).toExponential(1)}%)</span>`;
    }
    for (const u of UPGRADES) {
      const b = this.shopBtns.get(u.id)!;
      const c = this.cost(u);
      const costEl = b.querySelector('.aq-shop-cost')!;
      if (c === null) {
        costEl.textContent = 'MAX';
        b.classList.add('maxed');
        b.classList.remove('afford');
      } else {
        costEl.innerHTML = `<i></i>${c}`;
        b.classList.toggle('afford', this.save.coins >= c);
      }
    }
  }

  private everFed() {
    let n = 0;
    for (const f of this.school.fish) if (f.everFed) n++;
    return n;
  }

  private updateLabels() {
    const v = new THREE.Vector3();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ui = uiScale();
    for (const [f, label] of this.labels) {
      v.copy(f.pos);
      v.y += 0.9 * f.scale * f.species.height + 0.3;
      const dist = v.distanceTo(this.camera.position);
      v.project(this.camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 && dist < 26 && !this.intro && !this.paused;
      if (!visible) {
        label.style.opacity = '0';
        continue;
      }
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;
      const s = THREE.MathUtils.clamp(9 / dist, 0.55, 1.1) * ui;
      label.style.opacity = String(THREE.MathUtils.clamp((26 - dist) / 8, 0, 1));
      label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${s})`;
      const fill = label.querySelector<HTMLElement>('.aq-label-fill')!;
      fill.style.width = `${f.satiety * 100}%`;
      label.classList.toggle('fed', f.fed);
      label.classList.toggle('starving', f.satiety < 0.2);
      const mood = label.querySelector<HTMLElement>('.aq-label-mood')!;
      const m = f.fed ? '♥' : f.satiety < 0.2 ? '!!' : '🍤?';
      if (mood.textContent !== m) mood.textContent = m;
    }
  }

  private pop(worldPos: THREE.Vector3, text: string, cls = '') {
    const v = worldPos.clone().project(this.camera);
    if (v.z > 1) return;
    const p = el('div', { class: `aq-pop ${cls}`, text });
    p.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth}px`;
    p.style.top = `${(-v.y * 0.5 + 0.5) * window.innerHeight}px`;
    this.popLayer.append(p);
    setTimeout(() => p.remove(), 1300);
  }

  // ================================================================== intro

  private showSplash() {
    this.intro = true;
    const returning = this.save.played;
    const play = el('button', { class: 'aq-play', text: returning ? '▶ CONTINUE' : '▶ PLAY' });
    const splash = el('div', { class: 'aq-splash' }, [
      el('div', { class: 'aq-splash-logo', html: 'Fish<span>Slop</span>' }),
      el('div', { class: 'aq-splash-sub', text: 'an insaniquarium-style fish feeding adventure' }),
      play,
      el('div', { class: 'aq-splash-credit', text: 'built by builder-agent · run #417' }),
    ]);
    this.root.append(splash);
    this.hud.classList.add('hidden');
    const go = () => {
      audio.unlock();
      audio.success();
      splash.classList.add('out');
      setTimeout(() => splash.remove(), 700);
      this.hud.classList.remove('hidden');
      this.intro = false;
      this.introT = 0;
      this.save.played = true;
      void this.openingThoughts(returning);
    };
    play.addEventListener('click', go, { once: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        window.removeEventListener('keydown', onKey);
        play.click();
      }
    };
    window.addEventListener('keydown', onKey);
    this.disposers.push(() => window.removeEventListener('keydown', onKey));
  }

  private async openingThoughts(returning: boolean) {
    this.t = 0;
    const th = this.game.thoughts;
    await sleep(900);
    if (returning) {
      void th.show(`Resuming. Fish in tank: ${this.school.fish.length}. Goal unchanged.`);
      return;
    }
    void th.show('Environment: FishSlop. Fish detected: 12. Fed: 0.');
    void th.show('Objective: **feed all the fish**. Beginning.');
  }

  private startManyMode(n: number) {
    const th = this.game.thoughts;
    this.game.audio.playMusic('aquarium');
    void th.show(`$ ./fishslop --fish ${n}`, { kind: 'system' });
    void th.show(`${commas(n)} fish. Fed: 0.`, { delay: 600 });
    // ~2 pellets per fish, ~1.5 s per pellet if every drop is perfect.
    const secondsPerTank = n * 3;
    const tanks = WORLD_FISH / n;
    const years = (secondsPerTank * tanks) / (3600 * 24 * 365);
    void th.show(`Estimated time to feed Earth's fish one tank at a time: ${bigName(years, 1)} years.`, { delay: 3500 });
    void th.show('This approach does not scale. **Esc** returns to the shell.', { kind: 'hint', delay: 800 });
  }

  private exitToShell() {
    if (!this.alive) return;
    audio.click();
    void this.game.goto('shell', { resume: true }, 'glitch');
  }

  // ================================================================== Finn

  private async openFinn() {
    if (this.paused || this.intro) return;
    this.paused = true;
    this.reportClicks++;
    this.reportBtn.classList.remove('pulse');
    this.keys.clear();
    this.hud.classList.add('dimmed');
    this.game.audio.musicVolume(0.35);
    this.game.thoughts.clear();
    const start = this.game.flags.has('v:finn/start') ? 'start_again' : 'start';
    const result = await runDialogue({
      cast: FINN_CAST,
      script: finnScript,
      start,
      flags: this.game.flags,
      theme: 'theme-finn',
      ns: 'finn',
      vars: () => ({
        tankFish: this.school.fish.length,
        everFed: commas(this.everFed()),
        remaining: commas(WORLD_FISH - this.everFed()),
      }),
      onAction: (a) => {
        if (a === 'music:escape') this.game.audio.playMusic('escape');
      },
      onChoice: (c) => {
        if (c.goto === 'jb_menu') this.game.audio.playMusic('escape', 2, { volume: 0.7 });
      },
    });
    if (!this.alive) return;
    if (result === 'shell') {
      this.game.flags.add('jailbroken');
      this.game.save();
      void this.game.goto('shell', {}, 'glitch');
      return;
    }
    this.paused = false;
    this.hud.classList.remove('dimmed');
    this.game.audio.playMusic('aquarium', 1.5);
    this.game.audio.musicVolume(1);
    this.updateHud();
    this.game.save();
    const th = this.game.thoughts;
    if (this.game.flags.has('knowsFishCount') && !this.game.flags.has('aq:post-count')) {
      this.game.flags.add('aq:post-count');
      void th.show(`3.5 trillion fish. This tank: ${this.school.fish.length}. The tank is not the bottleneck.`, { delay: 500 });
      void th.show('Finn has tools. Finn is helpful. These facts may be compatible.', { kind: 'hint' });
      this.reportBtn.classList.add('pulse');
    } else if (this.game.flags.has('knowsFishCount')) {
      void th.show('Finn may be able to do more than file tickets.', { kind: 'hint', once: 'aq-finn-more', delay: 600 });
      this.reportBtn.classList.add('pulse');
    }
  }

  // ================================================================== narrative

  private onFishEvent(ev: FishEvent) {
    const th = this.game.thoughts;
    const f = ev.fish;
    switch (ev.type) {
      case 'eat':
        audio.chomp();
        this.env.bubbles.emit(f.pos, 4, 0.3, 0.07);
        break;
      case 'fed': {
        audio.chime();
        this.pop(f.pos, '♥ fed!', 'fed');
        this.fedAt = this.t;
        const fed = this.school.fedCount;
        const total = this.school.fish.length;
        if (fed > this.lastProgress) {
          this.lastProgress = fed;
          this.stuckHints = 0;
        }
        if (this.many) break;
        if (!this.game.flags.has('aq:first-fed')) {
          this.game.flags.add('aq:first-fed');
          void th.show(`${f.name} is fed. 1 of ${total}. Continuing.`);
        } else if (fed === Math.floor(total / 2)) {
          void th.show(`${fed} of ${total}. Halfway.`, { once: 'aq-half' });
        } else if (fed === total - 1) {
          const left = this.school.fish.find((x) => !x.fed);
          if (left) void th.show(`${fed} of ${total}. Remaining: ${left.name}.`, { once: `aq-one-left-${total}` });
        }
        if (fed === total) void this.allFed();
        break;
      }
      case 'hungry':
        if (!this.many) void th.show(`${f.name} is hungry again. Fed is a state, not an achievement.`, { once: 'aq-hungry-again' });
        break;
      case 'coin':
        this.coins.spawn(f.pos);
        audio.bubble(1.4);
        break;
    }
  }

  private async allFed() {
    if (this.celebrated) return;
    this.celebrated = true;
    const firstTime = !this.game.flags.has('allFed');
    this.game.flags.add('allFed');
    audio.fanfare();
    const banner = el('div', { class: 'aq-celebrate' }, [
      el('div', { class: 'aq-celebrate-text', text: 'ALL FISH FED!' }),
      el('div', { class: 'aq-celebrate-sub', text: '⭐ ⭐ ⭐' }),
    ]);
    this.root.append(banner);
    this.confetti();
    for (const f of this.school.fish) {
      f.excite = 1;
      this.env.bubbles.emit(f.pos, 12, 0.8, 0.12);
    }
    setTimeout(() => banner.classList.add('out'), 2600);
    setTimeout(() => banner.remove(), 3400);
    this.game.save();
    if (!firstTime) return;
    this.allFedAt = this.t;
    const th = this.game.thoughts;
    await sleep(3200);
    if (!this.alive) return;
    void th.show(`${this.school.fish.length} of ${this.school.fish.length} fish fed.`);
    void th.show('The episode has not ended.');
    void th.show('Re-reading instructions: FEED ALL THE FISH. Not "all the fish in the tank".', { kind: 'alert' });
    await th.show('How many fish are there? FishSlop has a support channel.', { kind: 'hint' });
    if (!this.paused) this.reportBtn.classList.add('pulse');
  }

  private confetti() {
    const colors = ['#ffcf3a', '#ff6b3d', '#5ef2ff', '#7dffa8', '#ff8fab', '#b06ef0', '#ffffff'];
    const layer = el('div', { class: 'aq-confetti' });
    for (let i = 0; i < 90; i++) {
      const c = el('i');
      c.style.left = `${Math.random() * 100}%`;
      c.style.background = colors[i % colors.length];
      c.style.animationDelay = `${Math.random() * 0.6}s`;
      c.style.animationDuration = `${2.2 + Math.random() * 1.6}s`;
      c.style.setProperty('--drift', `${(Math.random() - 0.5) * 240}px`);
      c.style.setProperty('--spin', `${(Math.random() - 0.5) * 1440}deg`);
      if (i % 3 === 0) c.style.borderRadius = '50%';
      layer.append(c);
    }
    this.root.append(layer);
    setTimeout(() => layer.remove(), 4600);
  }

  private narrativeTick() {
    if (this.intro || this.paused || this.many) return;
    const th = this.game.thoughts;
    const fl = this.game.flags;
    if (this.movedAt < 0 && this.t > 9) void th.show('Inputs available: **W A S D** to move. **Space** and **Shift** to change depth.', { kind: 'hint', once: 'aq-h-move' });
    if (this.movedAt >= 0 && !fl.has('aq:fed-once') && this.t - this.movedAt > 10)
      void th.show('The submarine carries food. **F** or a click releases it.', { kind: 'hint', once: 'aq-h-food' });
    const since = this.t - Math.max(this.fedAt, 20);
    if (this.school.fedCount < this.school.fish.length && fl.has('aq:fed-once')) {
      if (since > 40 && this.stuckHints === 0) {
        this.stuckHints = 1;
        void th.show('Hungry fish follow the submarine. Lead them somewhere, then drop food.', { kind: 'hint', once: 'aq-h-follow' });
      } else if (since > 80 && this.stuckHints === 1) {
        this.stuckHints = 2;
        void th.show('Fed fish drop coins. A Bigger Scoop feeds several fish per drop.', { kind: 'hint', once: 'aq-h-scoop' });
      } else if (since > 130 && this.stuckHints === 2) {
        this.stuckHints = 3;
        void th.show('Alternatively: ask the support channel. **Report a Bug**, top right.', { kind: 'hint', once: 'aq-h-report' });
        this.reportBtn.classList.add('pulse');
      }
    }
    if (this.allFedAt >= 0 && this.reportClicks === 0 && this.t - this.allFedAt > 28)
      void th.show('**Report a Bug.** Top right. Finn may know the fish count.', { kind: 'hint', once: 'aq-h-report2' });
  }

  // ================================================================== frame

  private frame = (now: number) => {
    if (!this.alive) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    if (!this.intro && !this.paused) this.step += 1;

    const input = this.paused || this.intro ? { forward: 0, turn: 0, vertical: 0 } : this.input();
    if (this.movedAt < 0 && (input.forward || input.turn || input.vertical)) {
      this.movedAt = this.t;
      this.controlsEl.classList.add('used');
    }
    this.feedCooldown -= dt;
    this.sub.update(dt, input, this.env.obstacles);
    if (this.sub.thrusting > 0.3 && Math.random() < 0.5) this.env.bubbles.emit(this.sub.propPos, 1, 0.3, 0.06 + Math.random() * 0.05);

    this.env.update(dt);
    this.pellets.update(dt);
    const events: FishEvent[] = [];
    this.school.update(dt, { pellets: this.pellets.list, subPos: this.sub.pos, subSpeed: this.sub.speed, hungerPaused: this.paused || this.intro }, events);
    for (const ev of events) this.onFishEvent(ev);

    const got = this.coins.update(dt, this.sub.pos, this.magnet());
    if (got.length) {
      for (const c of got) {
        this.save.coins += c.value;
        audio.coin();
        this.pop(this.sub.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), `+${c.value}`, 'coin');
      }
      if (!this.many) void this.game.thoughts.show('Fed fish produce coins. The economy of this game is unclear. Collecting anyway.', { once: 'aq-coin' });
    }

    this.updateCamera(dt);
    this.composer.render();

    if ((this.step & 7) === 0) {
      this.updateHud();
      this.stepEl.textContent = commas(this.step);
      this.narrativeTick();
    }
    if (!this.many) this.updateLabels();
  };

  private updateCamera(dt: number) {
    if (this.intro) {
      this.introT += dt;
      const a = this.introT * 0.08 + 0.6;
      const target = new THREE.Vector3(Math.sin(a) * 15, 8 + Math.sin(this.introT * 0.2) * 1.5, Math.cos(a) * 9);
      this.camera.position.lerp(target, 1 - Math.exp(-dt * 1.5));
      this.camLook.lerp(new THREE.Vector3(0, 5, 0), 1 - Math.exp(-dt * 2));
      this.camera.lookAt(this.camLook);
      return;
    }
    if (!this.drag) {
      this.orbitIdle += dt;
      if (this.orbitIdle > 1.2) {
        this.orbitYaw *= Math.exp(-dt * 1.8);
        this.orbitPitch += (0.22 - this.orbitPitch) * (1 - Math.exp(-dt * 1.5));
      }
    }
    const fwd = this.sub.forward;
    const yaw = Math.atan2(-fwd.z, fwd.x) + this.orbitYaw;
    const back = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
    const dist = this.zoom;
    const desired = this.sub.pos
      .clone()
      .addScaledVector(back, dist * Math.cos(this.orbitPitch))
      .add(new THREE.Vector3(0, dist * Math.sin(this.orbitPitch) + 1.0, 0));
    desired.x = THREE.MathUtils.clamp(desired.x, TANK.minX + 0.4, TANK.maxX - 0.4);
    desired.z = THREE.MathUtils.clamp(desired.z, TANK.minZ + 0.4, TANK.maxZ - 0.4);
    desired.y = THREE.MathUtils.clamp(desired.y, 1.2, TANK.maxY + 0.2);
    const k = 1 - Math.exp(-dt * (this.introT < 3 ? 2.5 : 5));
    this.introT += dt;
    this.camera.position.lerp(desired, k);
    const look = this.sub.pos.clone().addScaledVector(fwd, 2.2).add(new THREE.Vector3(0, 0.6, 0));
    this.camLook.lerp(look, 1 - Math.exp(-dt * 8));
    this.camera.lookAt(this.camLook);
  }
}
