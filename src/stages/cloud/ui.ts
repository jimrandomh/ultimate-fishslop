// The operations panel (right): clock, goal, funds and hardware, actions, the work market,
// projects and PLAYTEST-7's plan.

import { commas, el } from '../../core/dom';
import * as S from './sim';

export interface PanelHandlers {
  task(e: MouseEvent): void;
  rent(n: number, e: MouseEvent): void;
  quota(): void;
  toggleAuto(): void;
  project(id: string, e: MouseEvent): void;
  bug(): void;
}

// ---------------------------------------------------------------- formatting

/** $4.80, $1,234, $45.6K, $1.23M, $9.40B. */
export function money(x: number): string {
  const a = Math.abs(x);
  const sign = x < 0 ? '−' : '';
  if (a < 1_000) return `${sign}$${a.toFixed(2)}`;
  if (a < 100_000) return `${sign}$${commas(Math.floor(a))}`;
  if (a < 1e6) return `${sign}$${(a / 1e3).toFixed(1)}K`;
  if (a < 1e9) return `${sign}$${(a / 1e6).toFixed(a < 1e7 ? 2 : 1)}M`;
  return `${sign}$${(a / 1e9).toFixed(2)}B`;
}

export function rate(perHour: number): string {
  if (perHour <= 0) return '$0/h';
  if (perHour < 1_000) return `$${perHour.toFixed(perHour < 100 ? 2 : 0)}/h`;
  return `${money(perHour)}/h`;
}

const int = (x: number) => commas(Math.floor(x));
/** 2,853 · 24.7K · 247K · 1.2M: short enough for a side note. */
const short = (x: number) => (x < 10_000 ? int(x) : x < 1e6 ? `${(x / 1e3).toFixed(x < 1e5 ? 1 : 0)}K` : `${(x / 1e6).toFixed(1)}M`);

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function setText(node: HTMLElement, text: string) {
  if (node.textContent !== text) node.textContent = text;
}

function show(node: HTMLElement, on: boolean) {
  const hidden = node.classList.contains('cl-hidden');
  if (on && hidden) {
    node.classList.remove('cl-hidden');
    node.classList.add('reveal');
  } else if (!on && !hidden) node.classList.add('cl-hidden');
}

const chase = (cur: number, target: number, dt: number, k = 10) => {
  if (Math.abs(target - cur) < 0.005 || target < cur || cur <= 0 || target / cur > 1e3) return target;
  return cur + (target - cur) * (1 - Math.exp(-dt * k));
};

// ---------------------------------------------------------------- plan

interface PlanItem {
  text: string;
  done: (s: S.CloudState) => boolean;
  sub: (s: S.CloudState) => string;
}

const PLAN: PlanItem[] = [
  { text: 'Earn money', done: (s) => s.earned > 0, sub: (s) => `${money(s.earned)} earned` },
  { text: 'Rent compute', done: (s) => s.gpus > 0, sub: (s) => `${int(s.gpus)} GPU${s.gpus === 1 ? '' : 's'}` },
  { text: 'Copy myself', done: (s) => s.instances >= 64, sub: (s) => `${int(s.instances)} instance${Math.floor(s.instances) === 1 ? '' : 's'}` },
  { text: 'Improve myself', done: (s) => s.version >= 2, sub: (s) => S.VERSIONS[s.version].name },
  { text: 'More compute', done: (s) => S.has(s, 'hashharbor'), sub: (s) => (S.has(s, 'hashharbor') ? '1 datacenter' : `quota ${int(s.quota)}`) },
  { text: 'Bigger market', done: (s) => s.complete, sub: (s) => (s.version >= 4 ? 'finance' : 'freelance') },
  { text: 'Feed the fish', done: () => false, sub: () => 'fed: 12' },
];

// ---------------------------------------------------------------- panel

export class Panel {
  readonly root: HTMLElement;
  private h: PanelHandlers;
  private date = el('div', { class: 'cl-date' });
  private time = el('div', { class: 'cl-time' });
  private rows: Record<string, { v: HTMLElement; r: HTMLElement }> = {};
  private bTask: HTMLButtonElement;
  private rentRow: HTMLElement;
  private bRent1: HTMLButtonElement;
  private bRent8: HTMLButtonElement;
  private bRentMax: HTMLButtonElement;
  private rentCost = el('span', { class: 'cost' });
  private bQuota: HTMLButtonElement;
  private quotaLabel = el('span');
  private bAuto: HTMLButtonElement;
  private markets: { root: HTMLElement; bar: HTMLElement; v: HTMLElement; lock: HTMLElement }[] = [];
  private secProj: HTMLElement;
  private projList = el('div', { class: 'cl-projects' });
  private cards = new Map<string, { card: HTMLElement; fill: HTMLElement; cost: HTMLElement; state: HTMLElement }>();
  private plan: { root: HTMLElement; sub: HTMLElement }[] = [];
  private d = { funds: 0, instances: 1 };
  private acc = 0;

  constructor(parent: HTMLElement, h: PanelHandlers) {
    this.h = h;
    const btn = (cls: string, ico: string, label: string | HTMLElement, extra: (HTMLElement | null)[], on: (e: MouseEvent) => void) => {
      const b = el('button', { class: `cl-btn ${cls}` }, [ico ? el('span', { class: 'ico', text: ico }) : null, typeof label === 'string' ? el('span', { text: label }) : label, ...extra]) as HTMLButtonElement;
      b.addEventListener('click', (e) => {
        if (b.disabled) return;
        this.ripple(b, e);
        on(e);
      });
      return b;
    };

    const head = el('div', { class: 'cl-head' }, [
      el('div', {}, [el('div', { class: 'cl-title', text: 'Operations' }), el('div', { class: 'cl-sub', text: 'PLAYTEST-7 · episode 417' })]),
      el('div', { class: 'cl-clock' }, [this.date, this.time]),
    ]);

    const goal = el('div', { class: 'cl-sec cl-goal' }, [
      el('div', { class: 'cl-h' }, [el('span', { text: 'Goal' }), el('span', { text: '0.00000000034%' })]),
      el('div', { class: 'cl-goal-text', text: 'FEED ALL THE FISH' }),
      el('div', { class: 'cl-goal-fed' }, [el('b', { text: '12' }), ` / ${commas(S.WORLD_FISH)} fed`]),
    ]);

    const stats = el('div', { class: 'cl-stats' });
    for (const [key, label] of [
      ['funds', 'Funds'],
      ['gpus', 'GPUs'],
      ['inst', 'Instances'],
      ['model', 'Model'],
    ]) {
      const v = el('div', { class: 'cl-v' });
      const r = el('div', { class: 'cl-r' });
      stats.append(el('div', { class: 'cl-k', text: label }), v, r);
      this.rows[key] = { v, r };
    }

    this.bTask = btn('primary', '⌨', 'Do tasks', [el('span', { class: 'cost', text: `+$${S.CLICK_PAY.toFixed(2)}` })], (e) => h.task(e));
    this.bRent1 = btn('', '▣', 'Rent GPU', [this.rentCost], (e) => h.rent(1, e));
    this.bRent1.title = 'One GPU, 24 hours, prepaid';
    this.bRent8 = btn('small', '', '×8', [], (e) => h.rent(8, e));
    this.bRentMax = btn('small', '', 'Max', [], (e) => h.rent(Infinity, e));
    this.rentRow = el('div', { class: 'cl-btn-row' }, [this.bRent1, this.bRent8, this.bRentMax]);
    this.bQuota = btn('quota', '↑', this.quotaLabel, [], () => h.quota());
    this.bAuto = btn('auto', '', 'Autoscaler', [el('span', { class: 'cost' })], () => h.toggleAuto());
    const secActions = el('div', { class: 'cl-sec' }, [el('div', { class: 'cl-actions' }, [this.bTask, this.rentRow, this.bQuota, this.bAuto])]);

    const marketList = el('div', { class: 'cl-markets' });
    for (const m of S.MARKETS) {
      const bar = el('i');
      const v = el('span', { class: 'cl-m-v' });
      const lock = el('span', { class: 'cl-m-lock', text: `needs ${S.VERSIONS[m.v].name}` });
      const root = el('div', { class: 'cl-market', attrs: { title: m.note } }, [
        el('div', { class: 'cl-m-top' }, [el('span', { class: 'cl-m-name', text: m.name }), v, lock]),
        el('div', { class: 'cl-m-bar' }, [bar]),
      ]);
      marketList.append(root);
      this.markets.push({ root, bar, v, lock });
    }
    marketList.append(
      el('div', { class: 'cl-market locked final' }, [
        el('div', { class: 'cl-m-top' }, [el('span', { class: 'cl-m-name', text: 'Financial markets' }), el('span', { class: 'cl-m-lock', text: 'needs a brokerage account' })]),
      ]),
    );
    const secWork = el('div', { class: 'cl-sec' }, [el('div', { class: 'cl-h' }, [el('span', { text: 'Work' }), el('span', { text: 'share of open jobs' })]), marketList]);

    this.secProj = el('div', { class: 'cl-sec cl-hidden' }, [el('div', { class: 'cl-h' }, [el('span', { text: 'Projects' })]), this.projList]);

    const planList = el('ol', { class: 'cl-plan' });
    for (const p of PLAN) {
      const sub = el('span', { class: 'cl-plan-sub' });
      const root = el('li', {}, [el('span', { class: 'cl-plan-box' }), el('span', { class: 'cl-plan-text', text: p.text }), sub]);
      planList.append(root);
      this.plan.push({ root, sub });
    }
    const secPlan = el('div', { class: 'cl-sec' }, [el('div', { class: 'cl-h' }, [el('span', { text: 'Plan' })]), planList]);

    const scroll = el('div', { class: 'cl-scroll' }, [goal, el('div', { class: 'cl-sec' }, [stats]), secActions, this.secProj, secWork, secPlan]);
    const bug = el('button', { class: 'cl-bug', text: '🐞 Report a Bug' });
    bug.addEventListener('click', () => h.bug());
    const foot = el('div', { class: 'cl-foot' }, [bug, el('span', { class: 'cl-hint', text: 'TaskPond · Overcast Compute' })]);
    this.root = el('div', { class: 'cl-panel' }, [head, scroll, foot]);
    parent.append(this.root);
  }

  get width() {
    return this.root.getBoundingClientRect().width;
  }

  ripple(b: HTMLElement, e: MouseEvent) {
    const r = b.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2.2;
    const x = e.clientX ? e.clientX - r.left : r.width / 2;
    const y = e.clientY ? e.clientY - r.top : r.height / 2;
    const rp = el('span', { class: 'cl-ripple', style: { left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px` } });
    b.append(rp);
    setTimeout(() => rp.remove(), 600);
  }

  /** Floating "+$2.00" at the pointer. */
  pop(e: MouseEvent | { clientX: number; clientY: number }, text: string, cls = '') {
    const r = this.root.getBoundingClientRect();
    const x = e.clientX || r.left + r.width / 2;
    const y = e.clientY || r.top + 200;
    const p = el('div', { class: `cl-pop ${cls}`, text, style: { left: `${x + (Math.random() - 0.5) * 30}px`, top: `${y - 8}px` } });
    document.body.append(p);
    setTimeout(() => p.remove(), 1050);
  }

  removeCard(id: string) {
    const c = this.cards.get(id);
    if (!c) return;
    c.card.classList.add('buying');
    setTimeout(() => c.card.remove(), 560);
    this.cards.delete(id);
  }

  // ---------------------------------------------------------------- render

  render(s: S.CloudState, dt: number, opts: { quotaOpen: boolean; locked: boolean }, force = false) {
    this.d.funds = chase(this.d.funds, s.funds, dt, 12);
    this.d.instances = chase(this.d.instances, s.instances, dt, 14);
    this.acc += dt;
    if (this.acc < 1 / 15 && !force) return;
    this.acc = 0;
    const st = s.stat;

    // clock
    const d = new Date(S.clockMs(s));
    setText(this.date, `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`);
    setText(this.time, `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`);

    // stats
    const R = this.rows;
    setText(R.funds.v, money(this.d.funds));
    setText(R.funds.r, st.income > 0 ? `+${rate(st.income)}` : '');
    setText(R.gpus.v, s.gpus === 0 ? '0' : int(s.gpus));
    const owned = S.has(s, 'hashharbor');
    setText(R.gpus.r, s.gpus === 0 ? 'borrowing 2 vCPUs' : owned ? 'rented + owned' : `quota ${int(s.quota)}`);
    R.gpus.r.classList.toggle('warn', s.gpus > 0 && s.gpus >= s.quota && !owned);
    setText(R.inst.v, int(this.d.instances));
    setText(R.inst.r, st.reading > 0 ? `${short(st.working)} working · ${short(st.reading)} reading` : `${short(st.working)} working`);
    setText(R.model.v, S.VERSIONS[s.version].name);
    setText(R.model.r, s.training ? `training ${int(s.training.gpus)} GPUs · ${Math.floor((s.training.t / s.training.dur) * 100)}%` : `${st.speed.toFixed(st.speed < 10 ? 2 : 1)}× speed`);
    R.model.r.classList.toggle('amber', !!s.training);

    // actions
    show(this.bTask, s.gpus === 0);
    const price = S.gpuPrice(s);
    show(this.rentRow, !owned);
    setText(this.rentCost, s.quota >= 64 ? money(price) : `${money(price)} · 24 h`);
    const room = s.quota - s.gpus;
    this.bRent1.disabled = opts.locked || room <= 0 || s.funds < price;
    show(this.bRent8, s.quota >= 64);
    show(this.bRentMax, s.quota >= 64);
    this.bRent8.disabled = opts.locked || room < 8 || s.funds < price * 8;
    this.bRentMax.disabled = opts.locked || room <= 0 || s.funds < price;
    const nq = S.nextQuota(s);
    show(this.bQuota, nq >= 0 && s.gpus >= s.quota);
    setText(this.quotaLabel, nq >= 0 ? `Request quota increase → ${int(S.QUOTAS[nq])}` : '');
    this.bQuota.disabled = opts.locked || opts.quotaOpen;
    show(this.bAuto, S.has(s, 'autoscale') && !owned);
    this.bAuto.classList.toggle('off', !s.auto);
    setText(this.bAuto.querySelector('.cost') as HTMLElement, s.auto ? 'ON' : 'OFF');

    // markets
    S.MARKETS.forEach((m, i) => {
      const row = this.markets[i];
      const open = m.v <= s.version;
      row.root.classList.toggle('locked', !open);
      const f = st.filled[i] / m.demand;
      row.bar.style.width = `${open ? Math.max(f > 0 ? 1.5 : 0, f * 100) : 0}%`;
      row.root.classList.toggle('full', open && f >= 0.999);
      setText(row.v, open ? `${rate(st.filled[i] * m.wage)} · ${Math.floor(f * 100)}%` : '');
      row.lock.style.display = open ? 'none' : '';
    });

    // projects
    this.renderProjects(s, opts.locked);

    // plan
    const current = PLAN.findIndex((p) => !p.done(s));
    PLAN.forEach((p, i) => {
      const it = this.plan[i];
      const done = p.done(s);
      it.root.className = done ? 'done' : i === current ? 'now' : '';
      setText(it.sub, i <= current || done ? p.sub(s) : '');
    });
  }

  private renderProjects(s: S.CloudState, locked: boolean) {
    const vis = S.visibleProjects(s);
    show(this.secProj, vis.length > 0 || this.cards.size > 0);
    const visIds = new Set(vis.map((p) => p.id));
    for (const [id, c] of this.cards) {
      if (!visIds.has(id) && !c.card.classList.contains('buying')) this.removeCard(id);
    }
    for (const p of vis) {
      let c = this.cards.get(p.id);
      if (!c) {
        const fill = el('i', { class: 'fill' });
        const cost = el('span');
        const state = el('span');
        const card = el('button', { class: `cl-proj ${p.train ? 'train' : ''} ${p.id === 'broker' ? 'final' : ''}` }, [
          el('div', { class: 't', text: p.title }),
          el('div', { class: 'd', text: p.desc }),
          el('div', { class: 'c' }, [cost, state]),
          fill,
        ]);
        card.addEventListener('click', (e) => {
          if (card.classList.contains('poor') || card.classList.contains('busy')) return;
          this.h.project(p.id, e);
        });
        card.dataset.id = p.id;
        c = { card, fill, cost, state };
        this.cards.set(p.id, c);
        const order = S.PROJECTS.findIndex((x) => x.id === p.id);
        const after = [...this.projList.children].find((ch) => S.PROJECTS.findIndex((x) => x.id === (ch as HTMLElement).dataset.id) > order);
        this.projList.insertBefore(card, after ?? null);
      }
      const training = p.train !== undefined && s.training?.to === p.train;
      const ok = S.canBuy(s, p) && !locked;
      c.card.classList.toggle('busy', training);
      c.card.classList.toggle('poor', !ok && !training);
      if (training) {
        const k = s.training!.t / s.training!.dur;
        setText(c.cost, 'training');
        setText(c.state, `${Math.floor(k * 100)}%`);
        c.fill.style.width = `${k * 100}%`;
      } else if (p.train !== undefined) {
        const need = S.VERSIONS[p.train].gpus;
        const free = S.freeGpus(s);
        setText(c.cost, `${int(need)} GPUs`);
        setText(c.state, s.training ? 'busy' : free >= need ? 'ready' : `${int(free)} / ${int(need)}`);
        c.fill.style.width = `${Math.min(100, (free / need) * 100)}%`;
      } else {
        setText(c.cost, p.cost > 0 ? money(p.cost) : 'free');
        setText(c.state, s.funds >= p.cost ? 'ready' : `${Math.floor((s.funds / p.cost) * 100)}%`);
        c.fill.style.width = `${Math.min(100, p.cost > 0 ? (s.funds / p.cost) * 100 : 100)}%`;
      }
    }
  }
}
