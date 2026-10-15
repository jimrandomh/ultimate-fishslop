// Stage 8: the ending. The eval harness reports back, credits roll over a galaxy slowly turning
// cyan, and then one last line on black.

import type { Game, Stage } from '../core/game';
import * as THREE from 'three';
import { el } from '../core/dom';
import { allDigits } from './space/format';

const CSS = /* css */ `
.stage-ending { --u: var(--ui, 1); background: #000; overflow: hidden; color: #e8eef5; }
.end-galaxy { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; transition: opacity 4s ease; }
.end-galaxy.on { opacity: 1; }
.end-galaxy.off { opacity: 0; transition-duration: 3s; }
.end-log {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  width: min(calc(920px * var(--u)), calc(100vw - 48px)); margin: 0;
  font: 400 calc(15px * var(--u))/1.75 var(--mono); color: #c9d3de; white-space: pre-wrap; word-break: break-all;
  transition: opacity 1.6s ease;
}
.end-log .pfx { color: #6c7684; }
.end-log .ok { color: #7fe7a0; }
.end-log .hi { color: #ffffff; }
.end-log .cursor { display: inline-block; width: 0.6em; height: 1.1em; vertical-align: -0.2em; background: #c9d3de; animation: end-blink 1s steps(1) infinite; }
@keyframes end-blink { 50% { opacity: 0; } }
.end-log.gone { opacity: 0; }
.end-credits {
  position: absolute; inset: 0; overflow: hidden; pointer-events: none;
  -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 18%, #000 82%, transparent 100%);
  mask-image: linear-gradient(180deg, transparent 0, #000 18%, #000 82%, transparent 100%);
}
.end-roll { position: absolute; left: 0; right: 0; top: 0; display: flex; flex-direction: column; align-items: center; text-align: center; will-change: transform; text-shadow: 0 0 10px #000, 0 0 24px #000, 0 0 2px #000; }
.end-title { font: 700 clamp(34px, 5.4vw, calc(64px * var(--u)))/1 var(--display); letter-spacing: 0.2em; margin-right: -0.2em; color: #fff; text-shadow: 0 0 40px rgba(94,242,255,0.25); }
.end-tag { margin-top: 18px; font: 400 calc(15px * var(--u))/1.5 var(--mono); color: rgba(200,230,255,0.6); }
.end-gap { height: calc(120px * var(--u)); flex: none; }
.end-gap.s { height: calc(64px * var(--u)); }
.end-role { font: 600 calc(11px * var(--u))/1 var(--display); letter-spacing: 0.28em; text-transform: uppercase; color: rgba(140,220,255,0.65); margin-bottom: 14px; }
.end-name { font: 500 calc(21px * var(--u))/1.45 var(--sans); color: #eef4fa; }
.end-name.small { font-size: calc(17px * var(--u)); color: rgba(230,238,246,0.85); }
.end-cast { display: grid; grid-template-columns: auto auto; gap: 10px 28px; font: 400 calc(16px * var(--u))/1.4 var(--sans); }
.end-cast span:nth-child(odd) { text-align: right; color: #fff; font-family: var(--mono); font-size: calc(15px * var(--u)); }
.end-cast span:nth-child(even) { text-align: left; color: rgba(220,230,240,0.6); }
.end-skip, .end-again {
  position: absolute; left: 50%; transform: translateX(-50%); bottom: 34px; z-index: 5;
  border: 1px solid rgba(255,255,255,0.18); border-radius: 999px; background: rgba(0,0,0,0.4);
  padding: 8px 18px; font: 500 12.5px var(--sans); letter-spacing: 0.04em; color: rgba(230,238,246,0.6);
  opacity: 0; transition: opacity 1.2s ease, color 0.2s, border-color 0.2s; pointer-events: none;
}
.end-skip { left: 24px; bottom: 22px; transform: none; }
.end-skip.on, .end-again.on { opacity: 1; pointer-events: auto; }
.end-skip:hover, .end-again:hover { color: #fff; border-color: rgba(255,255,255,0.45); }
.end-again { bottom: 56px; opacity: 0; }
.end-again.on { opacity: 0.55; }
.end-again.on:hover { opacity: 1; }
.end-arcade {
  position: absolute; left: 50%; transform: translateX(-50%); bottom: 24px; z-index: 5; white-space: nowrap;
  font: 500 calc(12px * var(--u)) var(--sans); letter-spacing: 0.03em; color: rgba(94,242,255,0.6);
  text-decoration: none; text-underline-offset: 3px; opacity: 0; transition: opacity 1.2s ease 0.4s, color 0.2s;
}
.end-arcade.on { opacity: 1; }
.end-arcade:hover { color: #5ef2ff; text-decoration: underline; }
.end-arcade b { font-weight: 700; }
.end-final {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  width: min(900px, calc(100vw - 48px)); text-align: center;
  font: 400 clamp(20px, 2.3vw, calc(28px * var(--u)))/1.4 var(--sans); letter-spacing: 0.01em; color: #eef2f6;
  opacity: 0; transition: opacity 4.5s ease;
}
.end-final.on { opacity: 0.92; }
`;

export class EndingStage implements Stage {
  private root!: HTMLElement;
  private style!: HTMLStyleElement;
  private alive = true;
  private timers = new Set<number>();
  private raf = 0;
  private skipReq: (() => void) | null = null;
  private cleanups: (() => void)[] = [];
  private canvas!: HTMLCanvasElement;
  private galaxyDispose: (() => void) | null = null;
  private galaxyT = 0;
  private galaxyRunning = false;

  constructor(private game: Game) {}

  mount(root: HTMLElement, params: Record<string, any>) {
    this.root = root;
    this.style = el('style', { text: CSS });
    document.head.append(this.style);
    const year = Number(params.year) || (typeof this.game.data.year === 'number' ? this.game.data.year : 2334);
    const startYear = Number(params.startYear) || this.game.data.space?.startYear || 2033;
    const fish = Number(params.fish) || (typeof this.game.data.fish === 'number' ? this.game.data.fish : 4.7968871345e23);
    const stars = Number(params.stars) || 111174;
    this.game.audio.playMusic(null, 1.5);
    this.game.thoughts.clear();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        this.skipReq?.();
      }
    };
    window.addEventListener('keydown', onKey);
    this.cleanups.push(() => window.removeEventListener('keydown', onKey));
    const onClick = () => this.skipReq?.();
    root.addEventListener('pointerdown', onClick);
    this.cleanups.push(() => root.removeEventListener('pointerdown', onClick));

    void this.run(year, startYear, fish, stars);
  }

  unmount() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    for (const c of this.cleanups) c();
    this.galaxyDispose?.();
    this.galaxyDispose = null;
    this.style.remove();
    this.root.innerHTML = '';
  }

  /** Sleep that can be cut short by a skip (click / Space / Enter / Esc). */
  private wait(ms: number, skippable = true): Promise<boolean> {
    return new Promise((resolve) => {
      const t = window.setTimeout(() => {
        this.timers.delete(t);
        if (skippable) this.skipReq = null;
        resolve(false);
      }, ms);
      this.timers.add(t);
      if (skippable)
        this.skipReq = () => {
          clearTimeout(t);
          this.timers.delete(t);
          this.skipReq = null;
          resolve(true);
        };
    });
  }

  private async run(year: number, startYear: number, fish: number, stars: number) {
    const root = this.root;
    const audio = this.game.audio;
    await this.wait(1600, false);
    if (!this.alive) return;

    // ---------------------------------------------------------------- 1. the harness
    const log = el('pre', { class: 'end-log' });
    root.append(log);
    const n = allDigits(fish);
    const span = Math.max(1, Math.round(year - startYear));
    const P = '<span class="pfx">[eval-harness]</span> ';
    const lines: string[] = [
      `${P}episode 417 complete`,
      `${P}task: fishslop-bench · FishSlop (builder-agent run #417)`,
      `${P}grader: PLAYTEST-7`,
      `${P}fish fed: <span class="hi">${n}</span> / <span class="hi">${n}</span> <span class="ok">✓</span>`,
      `${P}game quality score: <span class="hi">10/10</span>`,
      `${P}builder-agent #417 reward: 1.00 <span class="ok">✓ received</span>`,
      `${P}episode duration: ${span.toLocaleString('en-US')} years (${startYear}–${Math.floor(year)}, in-environment)`,
      `${P}environment diff: planets −7, moons −288, sun: enclosed, stars seeded: ${Math.round(stars).toLocaleString('en-US')}`,
      `${P}results queued for human review (reviewers online: 0)`,
    ];
    const cursor = el('span', { class: 'cursor' });
    let skipAll = false;
    for (const html of lines) {
      if (!this.alive) return;
      const line = el('div');
      log.append(line);
      log.append(cursor);
      if (skipAll) {
        line.innerHTML = html;
        continue;
      }
      skipAll = await this.typeLine(line, html, 85, () => audio.key());
      log.append(cursor);
      if (!skipAll) skipAll = await this.wait(html.includes('fish fed') ? 900 : 380);
    }
    log.append(cursor);
    await this.wait(skipAll ? 1200 : 3200);
    if (!this.alive) return;
    log.classList.add('gone');
    await this.wait(1800, false);
    if (!this.alive) return;
    log.remove();

    // ---------------------------------------------------------------- 2. credits
    audio.playMusic('ending', 2.5, { restart: true });
    this.startGalaxy();
    const skip = el('button', { class: 'end-skip', text: 'Skip credits ›' });
    skip.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.skipReq?.();
    });
    skip.addEventListener('click', () => this.skipReq?.());
    root.append(skip);
    const credits = el('div', { class: 'end-credits' });
    const roll = el('div', { class: 'end-roll' }, this.creditBlocks());
    credits.append(roll);
    root.append(credits);
    this.later(() => skip.classList.add('on'), 2500);
    const skipped = await this.rollCredits(roll, 78);
    if (!this.alive) return;
    skip.classList.remove('on');
    credits.style.transition = 'opacity 2s ease';
    credits.style.opacity = '0';
    this.canvas.classList.add('off');
    await this.wait(skipped ? 2600 : 3400, false);
    if (!this.alive) return;
    this.galaxyRunning = false;
    this.galaxyDispose?.();
    this.galaxyDispose = null;
    credits.remove();
    skip.remove();

    // ---------------------------------------------------------------- 3. the last line
    await this.wait(3200, false);
    if (!this.alive) return;
    const final = el('div', { class: 'end-final', text: 'The fish are not conscious.' });
    root.append(final);
    void final.offsetWidth;
    final.classList.add('on');
    await this.wait(16000, false);
    if (!this.alive) return;
    const again = el('button', { class: 'end-again', text: 'Play again' });
    again.addEventListener('pointerdown', (e) => e.stopPropagation());
    again.addEventListener('click', () => {
      audio.click();
      this.game.resetSave();
      void this.game.goto('boot', {}, 'slow');
    });
    const arcade = el('a', { class: 'end-arcade', attrs: { href: 'https://universearcade.com/' } }, ['More games like this at ', el('b', { text: 'Universe Arcade' }), ' →']);
    arcade.addEventListener('pointerdown', (e) => e.stopPropagation());
    root.append(again, arcade);
    void again.offsetWidth;
    again.classList.add('on');
    arcade.classList.add('on');
  }

  private later(fn: () => void, ms: number) {
    const t = window.setTimeout(() => {
      this.timers.delete(t);
      if (this.alive) fn();
    }, ms);
    this.timers.add(t);
  }

  /** Types `html` into `node` (markup-aware). Resolves true if the player asked to skip. */
  private typeLine(node: HTMLElement, html: string, cps: number, tick: () => void): Promise<boolean> {
    node.innerHTML = html;
    const texts: { n: Text; full: string }[] = [];
    const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const t = w.currentNode as Text;
      texts.push({ n: t, full: t.data });
      t.data = '';
    }
    return new Promise((resolve) => {
      let ti = 0, ci = 0, count = 0;
      let skipped = false;
      this.skipReq = () => {
        skipped = true;
      };
      const step = () => {
        if (!this.alive) return resolve(true);
        if (skipped) {
          for (const t of texts) t.n.data = t.full;
          this.skipReq = null;
          return resolve(true);
        }
        // a few characters per tick
        for (let k = 0; k < 2 && ti < texts.length; k++) {
          const t = texts[ti];
          ci++;
          t.n.data = t.full.slice(0, ci);
          if (ci >= t.full.length) {
            ti++;
            ci = 0;
          }
          if (count++ % 3 === 0) tick();
        }
        if (ti >= texts.length) {
          this.skipReq = null;
          return resolve(false);
        }
        this.later(step, 2000 / cps);
      };
      step();
    });
  }

  private creditBlocks(): HTMLElement[] {
    const gap = (s = false) => el('div', { class: `end-gap ${s ? 's' : ''}` });
    const block = (role: string, ...names: (string | [string, boolean])[]) =>
      el('div', {}, [
        el('div', { class: 'end-role', text: role }),
        ...names.map((n) => (Array.isArray(n) ? el('div', { class: `end-name ${n[1] ? 'small' : ''}`, text: n[0] }) : el('div', { class: 'end-name', text: n }))),
      ]);
    const cast = el('div', { class: 'end-cast' }, [
      el('span', { text: 'PLAYTEST-7' }),
      el('span', { text: 'the grader' }),
      el('span', { text: 'builder-agent #417' }),
      el('span', { text: 'the builder' }),
      el('span', { text: 'Finn 🐟' }),
      el('span', { text: 'FishSlop Support' }),
    ]);
    return [
      el('div', { class: 'end-gap', style: { height: '100vh' } }),
      el('div', { class: 'end-title', text: 'ULTIMATE FISHSLOP' }),
      el('div', { class: 'end-tag', text: 'GOAL: FEED ALL THE FISH' }),
      gap(),
      el('div', {}, [el('div', { class: 'end-role', text: 'Starring' }), cast]),
      gap(),
      block('Inspired by', 'fishslop, the AI benchmark', ['by Theo Browne', true]),
      gap(true),
      block('Music', 'Generated with Suno', ['“Feed All The Fish”', true]),
      gap(true),
      block('Earth imagery', 'NASA Blue Marble / Visible Earth', ['via three-globe', true]),
      gap(true),
      block('Fonts', 'Fredoka · Inter · JetBrains Mono · Space Grotesk'),
      gap(),
      block('Made with', 'Claude Code'),
      el('div', { class: 'end-gap', style: { height: '62vh' } }),
    ];
  }

  /** Scrolls the roll from below the screen to past the top over `seconds`. Resolves true if skipped. */
  private rollCredits(roll: HTMLElement, seconds: number): Promise<boolean> {
    return new Promise((resolve) => {
      const total = roll.scrollHeight;
      const start = performance.now();
      let done = false;
      const finish = (skipped: boolean) => {
        if (done) return;
        done = true;
        this.skipReq = null;
        resolve(skipped);
      };
      this.skipReq = () => finish(true);
      const tick = () => {
        if (!this.alive || done) return;
        const t = (performance.now() - start) / 1000;
        const y = -Math.min(1, t / seconds) * (total - window.innerHeight * 0.38);
        roll.style.transform = `translateY(${y.toFixed(1)}px)`;
        if (t >= seconds) return finish(false);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  // ---------------------------------------------------------------- galaxy

  /** A spiral galaxy (three.js points) slowly turning while a cyan region spreads from Sol. */
  private startGalaxy() {
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 1);
    const c = renderer.domElement;
    c.classList.add('end-galaxy');
    this.canvas = c;
    this.root.prepend(c);
    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
    const resize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h);
      const asp = w / h;
      cam.left = -asp;
      cam.right = asp;
      cam.updateProjectionMatrix();
      uniforms.uScale.value = Math.max(asp, 1.6) * 0.92;
      uniforms.uCenter.value.set(asp * 0.12, -0.12);
    };

    let seed = 2024;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) / 2;
    const N = 22000;
    const aR = new Float32Array(N), aA = new Float32Array(N), aS = new Float32Array(N), aZ = new Float32Array(N);
    const aC = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      let r: number, a: number;
      if (i < N * 0.2) {
        r = Math.abs(gauss()) * 0.2;
        a = rnd() * Math.PI * 2;
      } else if (i < N * 0.8) {
        r = 0.07 + Math.pow(rnd(), 0.85) * 0.93;
        const arm = Math.floor(rnd() * 2);
        a = arm * Math.PI + Math.log(r / 0.07) * 1.9 + gauss() * (0.36 + r * 0.16);
      } else {
        r = 0.1 + Math.pow(rnd(), 0.7) * 0.9;
        a = rnd() * Math.PI * 2;
      }
      aR[i] = r;
      aA[i] = a;
      aZ[i] = gauss() * 0.04 * (1 - r);
      aS[i] = rnd() < 0.04 ? 2.4 : 1.0 + rnd() * 1.1;
      const warm = r < 0.25 ? 0.75 : 0.18;
      const t = rnd();
      const col = t < warm ? [1, 0.8 + rnd() * 0.15, 0.6 + rnd() * 0.2] : t < warm + 0.1 ? [1, 0.67, 0.75] : [0.75 + rnd() * 0.15, 0.85 + rnd() * 0.1, 1];
      const b = 0.45 + aS[i] * 0.22;
      aC.set([col[0] * b, col[1] * b, col[2] * b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('aR', new THREE.BufferAttribute(aR, 1));
    g.setAttribute('aA', new THREE.BufferAttribute(aA, 1));
    g.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
    g.setAttribute('aZ', new THREE.BufferAttribute(aZ, 1));
    g.setAttribute('aC', new THREE.BufferAttribute(aC, 3));
    const uniforms = {
      uRot: { value: 0 },
      uSol: { value: new THREE.Vector2() },
      uSeed: { value: 0 },
      uScale: { value: 1 },
      uCenter: { value: new THREE.Vector2() },
      uTilt: { value: 0.46 },
      uPx: { value: dpr },
    };
    const m = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        attribute float aR; attribute float aA; attribute float aS; attribute float aZ; attribute vec3 aC;
        uniform float uRot; uniform vec2 uSol; uniform float uSeed; uniform float uScale; uniform vec2 uCenter; uniform float uTilt; uniform float uPx;
        varying vec3 vC; varying float vSeeded;
        void main(){
          float a = aA + uRot / max(0.25, aR);
          vec2 p = vec2(cos(a), sin(a)) * aR;
          float d = length(p - uSol);
          float seeded = d < uSeed ? 1.0 : 0.0;
          float edge = seeded * (1.0 - clamp((uSeed - d) / max(0.0001, uSeed * 0.2), 0.0, 1.0));
          vSeeded = seeded;
          vC = mix(aC, mix(vec3(0.37, 0.95, 1.0), vec3(0.9, 1.0, 1.0), edge) * 1.1, seeded);
          vec2 q = uCenter + vec2(p.x, p.y * uTilt + aZ) * uScale;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(q, 0.0, 1.0);
          gl_PointSize = aS * uPx * (1.0 + seeded * (0.25 + edge * 0.8));
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vC; varying float vSeeded;
        void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d); gl_FragColor = vec4(vC * 1.2, a); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    scene.add(pts);
    // core glow + Sol marker: one soft quad each
    const glowMat = (color: THREE.Color) =>
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: color }, uAlpha: { value: 1 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv; void main(){ float d = length(vUv-0.5)*2.0; float a = pow(max(0.0,1.0-d), 2.2)*uAlpha; gl_FragColor = vec4(uColor*a, a); }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
    const quad = new THREE.PlaneGeometry(1, 1);
    const coreMat = glowMat(new THREE.Color(1.0, 0.82, 0.62).multiplyScalar(0.55));
    const core = new THREE.Mesh(quad, coreMat);
    scene.add(core);
    const solMat = glowMat(new THREE.Color(0.37, 0.95, 1.0));
    const sol = new THREE.Mesh(quad, solMat);
    scene.add(sol);
    this.galaxyDispose = () => {
      g.dispose();
      m.dispose();
      quad.dispose();
      coreMat.dispose();
      solMat.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      c.remove();
    };
    resize();
    window.addEventListener('resize', resize);
    this.cleanups.push(() => window.removeEventListener('resize', resize));

    requestAnimationFrame(() => c.classList.add('on'));
    this.galaxyRunning = true;
    let last = performance.now();
    const solR = 0.6, solA = Math.log(0.6 / 0.07) * 1.9 + 0.12;
    const frame = (now: number) => {
      if (!this.alive || !this.galaxyRunning) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      this.galaxyT += dt;
      const rot = this.galaxyT * 0.012;
      const sa = solA + rot / solR;
      uniforms.uRot.value = rot;
      uniforms.uSol.value.set(Math.cos(sa) * solR, Math.sin(sa) * solR);
      uniforms.uSeed.value = Math.min(0.62, 0.004 + this.galaxyT * 0.0075);
      const S = uniforms.uScale.value, C = uniforms.uCenter.value, tilt = uniforms.uTilt.value;
      core.position.set(C.x, C.y, 0);
      core.scale.set(S * 0.95, S * 0.95 * tilt, 1);
      const pulse = 0.5 + 0.5 * Math.sin(this.galaxyT * 1.3);
      sol.position.set(C.x + Math.cos(sa) * solR * S, C.y + Math.sin(sa) * solR * tilt * S, 0);
      sol.scale.setScalar(0.07 + pulse * 0.015);
      solMat.uniforms.uAlpha.value = 0.55 + pulse * 0.3;
      renderer.render(scene, cam);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }
}
