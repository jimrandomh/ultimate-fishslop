// The clicker panel (left), the interstellar card (top right) and floating body labels.

import { el } from '../../core/dom';
import * as S from './sim';
import { allDigits, calendar, chase, kg, paceText, pct, sci, sup, watts, words } from './format';

export interface PanelHandlers {
  mine(e: MouseEvent): void;
  drones(n: number, e: MouseEvent): void;
  project(id: string, card: HTMLElement, e: MouseEvent): void;
  probe(e: MouseEvent): void;
  ocean(e: MouseEvent): void;
  alloc(v: number): void;
  toggleAuto(): void;
  bug(): void;
}

const SHORT: Record<string, string> = {
  moon: 'Moon',
  mercury: 'Mercury',
  mars: 'Mars',
  belt: 'Belt',
  venus: 'Venus',
  jovian: 'Jovian moons',
  saturnian: 'Rings',
  uranus: 'Uranus',
  neptune: 'Neptune',
  kuiper: 'Kuiper',
  saturn: 'Saturn',
  jupiter: 'Jupiter',
};

function energy(jPerKg: number) {
  if (jPerKg >= 1e9) return `${(jPerKg / 1e9).toFixed(2)} GJ/kg`;
  if (jPerKg >= 1e6) return `${(jPerKg / 1e6).toFixed(jPerKg >= 1e8 ? 0 : 1)} MJ/kg`;
  return `${(jPerKg / 1e3).toFixed(0)} kJ/kg`;
}

function perYr(x: number) {
  if (x <= 0) return '';
  return `+${sci(x, 1)}/yr`;
}

function setText(node: HTMLElement, text: string) {
  if (node.textContent !== text) node.textContent = text;
}

function show(node: HTMLElement, on: boolean) {
  const hidden = node.classList.contains('sp-hidden');
  if (on && hidden) {
    node.classList.remove('sp-hidden');
    node.classList.add('reveal');
  } else if (!on && !hidden) node.classList.add('sp-hidden');
}

export class Panel {
  readonly root: HTMLElement;
  readonly stars: HTMLElement;
  private h: PanelHandlers;
  // header
  private year = el('div', { class: 'sp-year' });
  private pace = el('div', { class: 'sp-pace' });
  // fish
  private fishNum = el('div', { class: 'sp-fish-num' });
  private fishWords = el('span');
  private fishRate = el('span', { class: 'up' });
  // dyson
  private secDyson: HTMLElement;
  private dysonPct = el('div', { class: 'sp-dyson-pct' });
  private dysonBar = el('i');
  private dysonLog = el('i');
  private dysonSub = el('div', { class: 'sp-mini' });
  // stats
  private rows: Record<string, { k: HTMLElement; v: HTMLElement; r: HTMLElement }> = {};
  // actions
  private bMine: HTMLButtonElement;
  private bMineCost = el('span', { class: 'cost' });
  private droneRow: HTMLElement;
  private bDrone1: HTMLButtonElement;
  private bDrone10: HTMLButtonElement;
  private bDrone100: HTMLButtonElement;
  private bProbe: HTMLButtonElement;
  private probeCharge = el('span', { class: 'charge' });
  private probeCost = el('span', { class: 'cost' });
  private bOcean: HTMLButtonElement;
  private oceanCost = el('span', { class: 'cost' });
  // alloc
  private secAlloc: HTMLElement;
  private range: HTMLInputElement;
  private allocD = el('b');
  private allocS = el('b');
  private limit = el('span', { class: 'lim' });
  private autoBtn: HTMLButtonElement;
  // target
  private tName = el('span');
  private tPct = el('span');
  private tBar = el('i');
  private tFact = el('div', { class: 'sp-fact' });
  private tMeta = el('div', { class: 'sp-mini' });
  private chips: Record<string, HTMLElement> = {};
  // projects
  private secProj: HTMLElement;
  private projList = el('div', { class: 'sp-projects' });
  private cards = new Map<string, { card: HTMLElement; fill: HTMLElement; cost: HTMLElement; afford: HTMLElement }>();
  // interstellar
  private starsN = el('div', { class: 'sp-stars-n' });
  private starsSub = el('div', { class: 'sp-mini' });
  private starsSpeed = el('b');
  private starsList = el('div', { class: 'sp-stars-list' });
  private starRows = new Map<number, HTMLElement>();
  private starsKey = '';
  // smoothed displays
  private d = { fish: 0, matter: 0, power: 0, drones: 0, shell: 0, water: 0, fishRate: 0 };
  private lastDrones = 0;
  private lastYears = 0;
  private droneRate = 0;
  private acc = 0;
  private fishAcc = 0;
  private panelWidth = 360;

  constructor(parent: HTMLElement, h: PanelHandlers) {
    this.h = h;
    const btn = (cls: string, ico: string, label: string, extra: (HTMLElement | null)[], on: (e: MouseEvent) => void) => {
      const b = el('button', { class: `sp-btn ${cls}` }, [ico ? el('span', { class: 'ico', text: ico }) : null, el('span', { text: label }), ...extra]) as HTMLButtonElement;
      b.addEventListener('click', (e) => {
        if (b.disabled) return;
        this.ripple(b, e);
        on(e);
      });
      return b;
    };

    // ---- header
    const head = el('div', { class: 'sp-head' }, [
      el('div', {}, [el('div', { class: 'sp-title', text: 'The Solar System' }), el('div', { class: 'sp-sub', text: 'PLAYTEST-7 · episode 417' })]),
      el('div', { class: 'sp-date' }, [this.year, this.pace]),
    ]);

    // ---- fish
    const secFish = el('div', { class: 'sp-sec' }, [
      el('div', { class: 'sp-h' }, [el('span', { text: '🐟 Fish' }), el('span', { text: 'all fed' })]),
      this.fishNum,
      el('div', { class: 'sp-fish-sub' }, [this.fishWords, this.fishRate]),
    ]);

    // ---- dyson
    this.secDyson = el('div', { class: 'sp-sec sp-hidden' }, [
      el('div', { class: 'sp-h' }, [el('span', { text: 'Dyson shell · 2.0 AU' }), el('span', { text: 'goal: 100%' })]),
      el('div', { class: 'sp-dyson-row' }, [this.dysonPct]),
      el('div', { class: 'sp-bar' }, [this.dysonBar]),
      el('div', { class: 'sp-bar log', attrs: { title: 'Orders of magnitude, 10⁻¹² to 1' } }, [this.dysonLog]),
      this.dysonSub,
    ]);

    // ---- stats
    const stats = el('div', { class: 'sp-stats' });
    for (const [key, label] of [
      ['matter', 'Matter'],
      ['power', 'Power'],
      ['drones', 'Drones'],
      ['water', 'Water'],
      ['oceans', 'Oceans'],
    ]) {
      const k = el('div', { class: 'sp-k', text: label });
      const v = el('div', { class: 'sp-v' });
      const r = el('div', { class: 'sp-r' });
      stats.append(k, v, r);
      this.rows[key] = { k, v, r };
    }
    const secStats = el('div', { class: 'sp-sec' }, [stats]);

    // ---- actions
    this.bMine = btn('', '⛏', 'Mine regolith', [this.bMineCost], (e) => h.mine(e));
    this.bDrone1 = btn('', '🤖', 'Assemble drone', [el('span', { class: 'cost', text: `${S.DRONE_KG.toLocaleString()} kg` })], (e) => h.drones(1, e));
    this.bDrone10 = btn('small', '', '×10', [], (e) => h.drones(10, e));
    this.bDrone100 = btn('small', '', '×100', [], (e) => h.drones(100, e));
    this.bDrone10.style.flex = '0 0 64px';
    this.bDrone100.style.flex = '0 0 70px';
    this.droneRow = el('div', { class: 'sp-btn-row' }, [this.bDrone1, this.bDrone10, this.bDrone100]);
    this.bProbe = btn('', '🚀', 'Launch probe', [this.probeCost, this.probeCharge], (e) => h.probe(e));
    this.bOcean = btn('sea', '🌊', 'Assemble ocean world', [this.oceanCost], (e) => h.ocean(e));
    const secActions = el('div', { class: 'sp-sec' }, [el('div', { class: 'sp-actions' }, [this.bMine, this.droneRow, this.bProbe, this.bOcean])]);

    // ---- allocation
    this.range = el('input', { class: 'sp-range', attrs: { type: 'range', min: '0', max: '100', step: '1', 'aria-label': 'Fabrication split' } }) as HTMLInputElement;
    this.range.addEventListener('input', () => h.alloc(Number(this.range.value) / 100));
    this.autoBtn = el('button', { class: 'sp-auto sp-hidden', text: 'AUTO' }) as HTMLButtonElement;
    this.autoBtn.addEventListener('click', () => h.toggleAuto());
    this.secAlloc = el('div', { class: 'sp-sec sp-hidden' }, [
      el('div', { class: 'sp-h' }, [el('span', { text: 'Fabrication' }), this.autoBtn]),
      el('div', { class: 'sp-alloc-top' }, [el('span', { class: 'd' }, ['Drones', this.allocD]), el('span', { class: 's' }, ['Shell', this.allocS])]),
      this.range,
      el('div', { class: 'sp-limit' }, [el('span', {}, ['Limited by: ', this.limit])]),
    ]);

    // ---- target
    const chipsRow = el('div', { class: 'sp-bodies' });
    for (const b of S.BODIES) {
      const c = el('span', { class: 'sp-chip', text: SHORT[b.id], attrs: { title: `${b.name}: ${sci(b.mass)} kg${b.water ? `, ${Math.round((b.water / b.mass) * 100)}% water` : ''}` } });
      this.chips[b.id] = c;
      chipsRow.append(c);
    }
    const secTarget = el('div', { class: 'sp-sec sp-target' }, [
      el('div', { class: 'sp-h' }, [el('span', { text: 'Disassembling' })]),
      el('div', { class: 'sp-target-name' }, [this.tName, this.tPct]),
      el('div', { class: 'sp-bar' }, [this.tBar]),
      this.tFact,
      this.tMeta,
      chipsRow,
    ]);

    // ---- projects
    this.secProj = el('div', { class: 'sp-sec sp-hidden' }, [el('div', { class: 'sp-h' }, [el('span', { text: 'Projects' })]), this.projList]);

    const scroll = el('div', { class: 'sp-scroll' }, [secFish, this.secDyson, secStats, secActions, this.secAlloc, this.secProj, secTarget]);
    const bug = el('button', { class: 'sp-bug', text: '🐞 Report a Bug' });
    bug.addEventListener('click', () => h.bug());
    const foot = el('div', { class: 'sp-foot' }, [bug, el('span', { class: 'sp-hint', text: 'drag · scroll to look around' })]);
    this.root = el('div', { class: 'sp-panel' }, [head, scroll, foot]);

    // ---- interstellar card
    this.stars = el('div', { class: 'sp-stars hidden' }, [
      el('div', { class: 'sp-h' }, [el('span', { text: 'Interstellar' }), el('span', {}, ['probe speed ', this.starsSpeed])]),
      el('div', { class: 'sp-stars-big' }, [this.starsN, el('div', { class: 'sp-k', text: 'stars seeded' })]),
      this.starsSub,
      this.starsList,
    ]);

    parent.append(this.root, this.stars);
  }

  get width() {
    return this.root.getBoundingClientRect().width;
  }

  ripple(b: HTMLElement, e: MouseEvent) {
    const r = b.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2.2;
    const x = e.clientX ? e.clientX - r.left : r.width / 2;
    const y = e.clientY ? e.clientY - r.top : r.height / 2;
    const rp = el('span', { class: 'sp-ripple', style: { left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px` } });
    b.append(rp);
    setTimeout(() => rp.remove(), 600);
  }

  /** Floating "+250 kg" number at the pointer. */
  pop(e: MouseEvent | { clientX: number; clientY: number }, text: string, cls = '') {
    const x = e.clientX || this.root.getBoundingClientRect().width / 2;
    const y = e.clientY || 200;
    const p = el('div', { class: `sp-pop ${cls}`, text, style: { left: `${x + (Math.random() - 0.5) * 30}px`, top: `${y - 8}px` } });
    document.body.append(p);
    setTimeout(() => p.remove(), 1050);
  }

  // ---------------------------------------------------------------- render

  render(s: S.SimState, dt: number, force = false) {
    const st = s.stat;
    // Smoothed numbers every frame (cheap), DOM writes at ~20 Hz.
    this.d.fish = chase(this.d.fish, st.fish, dt, 6);
    this.d.matter = chase(this.d.matter, s.matter, dt, 12);
    this.d.power = chase(this.d.power, st.power, dt, 8);
    this.d.drones = chase(this.d.drones, s.drones, dt, 10);
    this.d.shell = s.shell <= 0 ? 0 : chase(this.d.shell, s.shell, dt, 8);
    this.d.water = chase(this.d.water, s.water, dt, 10);
    const dy = s.years - this.lastYears;
    if (dy > 1e-6) {
      const r = (s.drones - this.lastDrones) / dy;
      this.droneRate += (Math.max(0, r) - this.droneRate) * Math.min(1, dt * 3);
      this.lastDrones = s.drones;
      this.lastYears = s.years;
    }
    this.fishAcc += dt;
    if (this.fishAcc > 1 / 30 || force) {
      this.fishAcc = 0;
      this.renderFish();
    }
    this.acc += dt;
    if (this.acc < 1 / 15 && !force) return;
    this.acc = 0;

    // header
    const cal = calendar(S.year(s));
    const yHtml = `${cal.year}<small>${cal.month}</small>`;
    if (this.year.innerHTML !== yHtml) this.year.innerHTML = yHtml;
    setText(this.pace, paceText(s.pace));

    // fish sub
    setText(this.fishWords, words(st.fish));
    setText(this.fishRate, st.fishRate > st.fish * 1e-4 ? `+${words(st.fishRate, 2)}/yr` : '');

    // dyson
    const c = S.completion(s);
    show(this.secDyson, s.seen.shell !== undefined);
    const cShown = this.d.shell / S.SHELL_REQ;
    setText(this.dysonPct, pct(Math.min(1, cShown)));
    this.dysonBar.style.width = `${c > 0 ? Math.max(0.6, Math.min(100, cShown * 100)) : 0}%`;
    const lg = cShown > 0 ? Math.max(0, Math.min(1, (Math.log10(cShown) + 12) / 12)) : 0;
    this.dysonLog.style.width = `${lg * 100}%`;
    setText(this.dysonSub, `${sci(this.d.shell)} of ${sci(S.SHELL_REQ)} kg · captures ${watts(S.P_SUN * Math.min(1, cShown), 2)}`);

    // stats
    const R = this.rows;
    setText(R.matter.v, kg(this.d.matter));
    setText(R.matter.r, perYr(st.matterRate));
    const showPower = S.has(s, 'replicate') || s.seen.shell !== undefined;
    for (const k of ['k', 'v', 'r'] as const) {
      show(R.power[k], showPower);
      show(R.drones[k], s.drones > 0 || s.matter >= S.DRONE_KG || S.has(s, 'replicate'));
      show(R.water[k], s.water > 0 || s.oceanWorlds > 0);
      show(R.oceans[k], S.has(s, 'oceans'));
    }
    setText(R.power.v, watts(this.d.power));
    if (st.idle > 0.02 && st.body && (s.alloc > 0.04 || !S.has(s, 'shell'))) {
      setText(R.power.r, `${Math.round(st.idle * 100)}% drones idle`);
      R.power.r.classList.add('warn');
    } else if (st.idle > 0.02 && st.body) {
      setText(R.power.r, 'drones in surplus');
      R.power.r.classList.remove('warn');
    } else {
      setText(R.power.r, st.power > S.P0 * 1.01 ? `${pct(Math.min(1, c))} of Sun` : 'lunar array');
      R.power.r.classList.remove('warn');
    }
    setText(R.drones.v, this.d.drones < 1e6 ? Math.floor(this.d.drones).toLocaleString('en-US') : sci(this.d.drones));
    setText(R.drones.r, S.has(s, 'replicate') && s.drones > 0 && s.recycling === 0 ? perYr(this.droneRate) : '');
    setText(R.water.v, kg(this.d.water));
    setText(R.water.r, s.water >= S.OCEAN_WORLD_WATER ? `${Math.floor(s.water / S.OCEAN_WORLD_WATER).toLocaleString()} oceans' worth` : '');
    setText(R.oceans.v, `${(s.oceanWorlds + 1).toLocaleString('en-US')} worlds`);
    setText(R.oceans.r, 'incl. Earth');

    // actions
    const moonLeft = !S.isDone(s, 'moon');
    show(this.bMine, moonLeft && !S.has(s, 'superconduct'));
    setText(this.bMineCost, `+${S.clickYield(s).toLocaleString()} kg`);
    show(this.droneRow, !S.has(s, 'shell') && (s.matter >= S.DRONE_KG || s.drones > 0));
    this.bDrone1.disabled = s.matter < S.DRONE_KG;
    show(this.bDrone10, S.has(s, 'bulk'));
    show(this.bDrone100, S.has(s, 'bulk'));
    this.bDrone10.disabled = s.matter < S.DRONE_KG * 10;
    this.bDrone100.disabled = s.matter < S.DRONE_KG * 100;
    show(this.bProbe, S.has(s, 'probes') && !s.complete);
    this.bProbe.disabled = !S.canLaunchProbe(s);
    this.probeCharge.style.width = `${Math.min(1, s.probeCharge) * 100}%`;
    const nextStar = S.STARS.findIndex((_, i) => !s.flights.some((f) => f.star === i) && s.seededAt[i] === undefined);
    setText(this.probeCost, nextStar >= 0 ? `→ ${S.STARS[nextStar].name}` : '→ elsewhere');
    show(this.bOcean, S.has(s, 'oceans') && !S.has(s, 'oceanauto'));
    this.bOcean.disabled = !S.canAssembleOcean(s);
    setText(this.oceanCost, kg(S.OCEAN_WORLD_WATER, 1));

    // allocation
    show(this.secAlloc, S.has(s, 'shell') && !s.complete && s.recycling === 0);
    const ap = Math.round(s.alloc * 100);
    if (document.activeElement !== this.range || s.auto) this.range.value = String(ap);
    this.range.style.setProperty('--p', `${ap}%`);
    this.range.classList.toggle('auto', s.auto);
    setText(this.allocD, `${ap}%`);
    setText(this.allocS, `${100 - ap}%`);
    show(this.autoBtn, S.has(s, 'autobalance'));
    this.autoBtn.classList.toggle('off', !s.auto);
    setText(this.autoBtn, s.auto ? 'AUTO' : 'MANUAL');
    const lim =
      st.limit === 'power' ? 'power → more shell' : st.limit === 'drones' ? 'drones → more drones' : st.limit === 'body' ? 'transfer orbits (fine)' : 'nothing to mine';
    setText(this.limit, lim);
    this.limit.className = `lim ${st.limit}`;

    // target
    const body = S.activeBody(s);
    if (body) {
      setText(this.tName, body.name);
      const f = S.bodyFrac(s, body.id);
      setText(this.tPct, pct(f));
      this.tBar.style.width = `${f > 0 ? Math.max(0.5, f * 100) : 0}%`;
      setText(this.tFact, body.fact);
      setText(this.tMeta, `${sci(s.mined[body.id])} of ${sci(body.mass)} kg · ${energy(S.energyPerKg(s, body))}${body.water ? ` · ${Math.round((body.water / body.mass) * 100)}% water` : ''}`);
    } else if (S.BODIES.every((b) => S.isDone(s, b.id))) {
      setText(this.tName, 'Nothing left');
      setText(this.tPct, '');
      this.tBar.style.width = '100%';
      setText(this.tFact, 'Every planet except Earth: 0 kg.');
      setText(this.tMeta, '');
    } else {
      const nb = S.nextBody(s);
      setText(this.tName, nb ? `Next: ${nb.name}` : 'Idle');
      setText(this.tPct, '');
      this.tBar.style.width = '0%';
      setText(this.tFact, 'Drones idle. Unlock the next target in Projects.');
      setText(this.tMeta, nb ? `${sci(nb.mass)} kg` : '');
    }
    for (const b of S.BODIES) {
      const chip = this.chips[b.id];
      const cls = S.isDone(s, b.id) ? 'done' : body?.id === b.id ? 'active' : b.unlock && !S.has(s, b.unlock) ? 'locked' : '';
      const want = `sp-chip ${cls}`;
      if (chip.className !== want) chip.className = want;
    }

    // projects
    this.renderProjects(s);

    // interstellar
    this.renderStars(s);
  }

  private renderFish() {
    const txt = allDigits(this.d.fish);
    if (this.fishNum.textContent !== txt) {
      this.fishNum.textContent = txt;
      // Shrink to fit as the number gets absurd.
      const inner = Math.max(200, this.panelWidth - 40);
      const size = Math.max(11, Math.min(25, inner / (txt.length * 0.6)));
      this.fishNum.style.fontSize = `${size.toFixed(1)}px`;
    }
  }

  measure() {
    this.panelWidth = this.root.getBoundingClientRect().width || 360;
  }

  private renderProjects(s: S.SimState) {
    const vis = S.visibleProjects(s);
    show(this.secProj, vis.length > 0 || this.cards.size > 0);
    const visIds = new Set(vis.map((p) => p.id));
    for (const [id, c] of this.cards) {
      if (!visIds.has(id) && !c.card.classList.contains('buying')) {
        c.card.classList.add('buying');
        setTimeout(() => c.card.remove(), 560);
        this.cards.delete(id);
      }
    }
    for (const p of vis) {
      let c = this.cards.get(p.id);
      if (!c) {
        const fill = el('i', { class: 'fill' });
        const cost = el('span');
        const afford = el('span');
        const card = el('button', { class: 'sp-proj' }, [el('div', { class: 't', text: p.title }), el('div', { class: 'd', text: p.desc }), el('div', { class: 'c' }, [cost, afford]), fill]);
        card.addEventListener('click', (e) => {
          if (card.classList.contains('poor')) return;
          this.h.project(p.id, card, e);
        });
        c = { card, fill, cost, afford };
        this.cards.set(p.id, c);
        // keep PROJECTS order
        const order = S.PROJECTS.findIndex((x) => x.id === p.id);
        const after = [...this.projList.children].find((ch) => S.PROJECTS.findIndex((x) => x.id === (ch as HTMLElement).dataset.id) > order);
        card.dataset.id = p.id;
        this.projList.insertBefore(card, after ?? null);
      }
      const cost = S.projectCost(s, p);
      const ok = s.matter >= cost;
      c.card.classList.toggle('poor', !ok);
      setText(c.cost, cost > 0 ? kg(cost, 1) : 'free');
      setText(c.afford, ok ? 'ready' : `${Math.floor((s.matter / cost) * 100)}%`);
      c.fill.style.width = `${Math.min(100, (s.matter / Math.max(1, cost)) * 100)}%`;
    }
  }

  private renderStars(s: S.SimState) {
    const on = S.has(s, 'probes');
    this.stars.classList.toggle('hidden', !on);
    if (!on) return;
    const v = S.probeSpeed(s);
    setText(this.starsSpeed, `${v}c`);
    const n = s.stat.stars;
    setText(this.starsN, n < 1e6 ? n.toLocaleString('en-US') : sci(n));
    const fishOut = s.fishStars;
    setText(
      this.starsSub,
      `${s.probesLaunched.toLocaleString()} launched from Sol${s.frontier > 0 ? ` · frontier ${s.frontier < 100 ? s.frontier.toFixed(1) : Math.round(s.frontier).toLocaleString()} ly` : ''}${fishOut > 1 ? ` · ${words(fishOut, 3)} fish out there` : ''}`,
    );
    // Window of named stars around the frontier.
    const firstOpen = S.STARS.findIndex((_, i) => s.seededAt[i] === undefined);
    const lo = firstOpen < 0 ? S.STARS.length - 8 : Math.max(0, firstOpen - 3);
    const idx: number[] = [];
    for (let i = lo; i < S.STARS.length && idx.length < 8; i++) idx.push(i);
    const key = idx.join(',');
    if (key !== this.starsKey) {
      this.starsKey = key;
      this.starsList.innerHTML = '';
      this.starRows.clear();
      for (const i of idx) {
        const row = el('div', { class: 'sp-star' }, [el('span', { class: 'n', text: S.STARS[i].name }), el('span', { class: 's' })]);
        if (S.STARS[i].ocean) row.append(el('span', { class: 'o', text: `${S.STARS[i].ocean} · ocean world` }));
        this.starRows.set(i, row);
        this.starsList.append(row);
      }
    }
    for (const [i, row] of this.starRows) {
      const sEl = row.children[1] as HTMLElement;
      const star = S.STARS[i];
      let cls = 'sp-star';
      let txt: string;
      if (s.seededAt[i] !== undefined) {
        cls += ' seeded';
        txt = `✓ seeded ${Math.floor(s.startYear + s.seededAt[i])}`;
      } else {
        const eta = S.probeEta(s, i);
        if (eta !== null) {
          cls += ' flying';
          const y = s.startYear + eta;
          txt = `ETA ${y < 1e5 ? Math.floor(y) : Math.floor(y).toLocaleString('en-US')}`;
        } else txt = `${star.d < 1000 ? star.d : star.d.toExponential(1).replace('e+', ' × 10^')} ly`;
      }
      if (txt.includes('10^')) txt = txt.replace(/10\^(\d+)/, (_, e) => `10${sup(e)}`);
      setText(sEl, txt);
      if (!row.className.startsWith(cls) || row.className.replace(' fresh', '') !== cls) {
        const wasSeeded = row.classList.contains('seeded');
        row.className = cls;
        if (!wasSeeded && cls.includes('seeded')) {
          void row.offsetWidth;
          row.classList.add('fresh');
        }
      }
    }
  }

  flashCard(card: HTMLElement) {
    card.classList.add('buying');
  }

  /** Called by the stage when a project is bought so the card animates out immediately. */
  removeCard(id: string) {
    const c = this.cards.get(id);
    if (!c) return;
    c.card.classList.add('buying');
    setTimeout(() => c.card.remove(), 560);
    this.cards.delete(id);
  }
}

// ==================================================================== labels over the 3D view

export class Labels {
  readonly root = el('div', { class: 'sp-labels' });
  private items = new Map<string, { node: HTMLElement; name: HTMLElement; p: HTMLElement }>();

  constructor(parent: HTMLElement) {
    parent.append(this.root);
  }

  set(id: string, text: string, x: number, y: number, opts: { active?: boolean; sub?: string; cls?: string; visible: boolean }) {
    let it = this.items.get(id);
    if (!it) {
      const name = el('span');
      const p = el('span', { class: 'p' });
      const node = el('div', { class: `sp-label ${opts.cls ?? ''}` }, [name, p]);
      this.root.append(node);
      it = { node, name, p };
      this.items.set(id, it);
    }
    setText(it.name, text);
    setText(it.p, opts.sub ?? '');
    it.p.style.display = opts.sub ? '' : 'none';
    it.node.classList.toggle('active', !!opts.active);
    it.node.style.opacity = opts.visible ? '1' : '0';
    it.node.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, 0)`;
  }

  hide(id: string) {
    const it = this.items.get(id);
    if (it) it.node.style.opacity = '0';
  }
}
