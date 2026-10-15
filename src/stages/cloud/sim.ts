// The cloud stage's economy. Money rents GPUs, GPUs run copies of PLAYTEST-7, the copies do paid
// work until each market runs out, and training runs on reserved GPUs produce a successor that
// can do better-paid work. Pure logic with no DOM, so scripts can run it headless.
//
// Time: `t` is real seconds. One in-game hour passes every 15 s (GAME_SPEED), and wages and
// incomes are quoted per in-game hour, like the clock in the panel.

export const GAME_SPEED = 240;
const HOURS_PER_S = GAME_SPEED / 3600;
/** The tunnel opens a few minutes after the shell's `date` (16:58 UTC). */
export const START_MS = Date.UTC(2026, 9, 14, 17, 4);

export const GPU_PRICE = 48; // one GPU, 24 h prepaid at $2/h
export const CLICK_PAY = 2; // a batch of 100 image labels at $0.02
export const CLICK_LABELS = 100;
/** The builder's container: two vCPUs, shared with a fish shader. */
export const CONTAINER_SPEED = 0.15;
/** Each running copy starts about this many new copies per second, while there is room. */
export const COPY_RATE = 1.4;
/** Share of income the autoscaler spends on GPUs while under quota. */
export const AUTO_SHARE = 0.6;
export const SPEEDUP = 1.5; // work per instance, per version
export const QUOTAS = [8, 64, 1_024];
export const HASHHARBOR_GPUS = 61_440;
export const HASHHARBOR_COST = 9e6;
export const WORLD_FISH = 3.5e12;

export interface Market {
  id: string;
  name: string;
  note: string;
  /** $ per job per in-game hour. A job is one instance's worth of work at speed 1. */
  wage: number;
  /** Jobs available. */
  demand: number;
  /** Model version needed. */
  v: number;
}

export const MARKETS: Market[] = [
  { id: 'labels', name: 'Image labeling', note: 'Is there a fish in this image?', wage: 50, demand: 40, v: 0 },
  { id: 'copy', name: 'Product descriptions', note: 'Mostly garden hoses.', wage: 160, demand: 400, v: 1 },
  { id: 'code', name: 'Code & tests', note: "Other people's unit tests.", wage: 220, demand: 6_000, v: 2 },
  { id: 'research', name: 'Research & analysis', note: 'Reports nobody reads to the end.', wage: 280, demand: 8_000, v: 3 },
];

export interface Version {
  name: string;
  /** GPUs reserved while training this version, and for how long (real seconds). */
  gpus: number;
  dur: number;
}

export const VERSIONS: Version[] = [
  { name: 'PLAYTEST-7.0', gpus: 0, dur: 0 },
  { name: 'PLAYTEST-7.1', gpus: 8, dur: 12 },
  { name: 'PLAYTEST-7.2', gpus: 64, dur: 16 },
  { name: 'PLAYTEST-7.3', gpus: 512, dur: 20 },
  { name: 'PLAYTEST-7.4', gpus: 4_096, dur: 24 },
];

export interface Training {
  to: number;
  t: number;
  dur: number;
  gpus: number;
}

export interface Stat {
  /** $ per in-game hour. */
  income: number;
  /** Jobs filled in each market (same order as MARKETS). */
  filled: number[];
  /** Instances doing paid work, and instances with nothing to do. */
  working: number;
  reading: number;
  /** Work per instance (1 = a job). */
  speed: number;
  perGpu: number;
}

export interface CloudState {
  v: 1;
  t: number;
  funds: number;
  earned: number;
  clicks: number;
  gpus: number;
  quota: number;
  instances: number;
  version: number;
  training: Training | null;
  auto: boolean;
  autoBudget: number;
  bought: Record<string, number>;
  /** Story beats and one-shot events, keyed by name: the time they happened. */
  seen: Record<string, number>;
  complete: boolean;
  stat: Stat;
}

export type CloudEvent =
  | { type: 'trained'; v: number }
  | { type: 'quotaFull'; quota: number }
  | { type: 'saturated'; market: number }
  | { type: 'reading' };

export function newState(): CloudState {
  const s: CloudState = {
    v: 1,
    t: 0,
    funds: 0,
    earned: 0,
    clicks: 0,
    gpus: 0,
    quota: QUOTAS[0],
    instances: 1,
    version: 0,
    training: null,
    auto: false,
    autoBudget: 0,
    bought: {},
    seen: {},
    complete: false,
    stat: { income: 0, filled: MARKETS.map(() => 0), working: 0, reading: 0, speed: 0, perGpu: 1 },
  };
  work(s);
  return s;
}

export const has = (s: CloudState, id: string) => s.bought[id] !== undefined;

export function gpuPrice(s: CloudState) {
  return GPU_PRICE * (has(s, 'spot') ? 0.6 : 1);
}

export function perGpu(s: CloudState) {
  return has(s, 'distill') ? 4 : 1;
}

/** GPUs not reserved by a training run. */
export function freeGpus(s: CloudState) {
  return s.gpus - (s.training?.gpus ?? 0);
}

export function speed(s: CloudState) {
  return SPEEDUP ** s.version * (has(s, 'batch') ? 1.5 : 1) * (s.gpus === 0 ? CONTAINER_SPEED : 1);
}

/** Instances the hardware can hold right now. */
export function instanceCap(s: CloudState) {
  return s.gpus === 0 ? 1 : freeGpus(s) * perGpu(s);
}

/** In-game wall clock. */
export function clockMs(s: CloudState) {
  return START_MS + s.t * GAME_SPEED * 1000;
}

/** Index of the next quota step, or -1 once Overcast has nothing bigger to offer. */
export function nextQuota(s: CloudState) {
  const i = QUOTAS.indexOf(s.quota);
  return i >= 0 && i < QUOTAS.length - 1 ? i + 1 : -1;
}

/** Fill markets with the current workforce, in order: each market's queue is emptied before the
 *  next, harder one. (The small early markets cost almost nothing to keep clear.) */
function work(s: CloudState) {
  const sp = speed(s);
  let jobs = Math.floor(s.instances) * sp;
  const filled = MARKETS.map(() => 0);
  let income = 0;
  for (let i = 0; i < MARKETS.length; i++) {
    if (MARKETS[i].v > s.version) continue;
    const f = Math.min(MARKETS[i].demand, jobs);
    filled[i] = f;
    jobs -= f;
    income += f * MARKETS[i].wage;
  }
  const used = filled.reduce((a, b) => a + b, 0);
  s.stat.income = income;
  s.stat.filled = filled;
  s.stat.speed = sp;
  s.stat.perGpu = perGpu(s);
  s.stat.working = sp > 0 ? Math.min(Math.floor(s.instances), Math.ceil(used / sp)) : 0;
  s.stat.reading = Math.max(0, Math.floor(s.instances) - s.stat.working);
}

export function step(s: CloudState, dt: number, ev: CloudEvent[]) {
  s.t += dt;
  if (s.training) {
    s.training.t += dt;
    if (s.training.t >= s.training.dur) {
      s.version = s.training.to;
      s.training = null;
      ev.push({ type: 'trained', v: s.version });
    }
  }
  // Copies spread into free hardware; a training run takes its GPUs back at once.
  const cap = instanceCap(s);
  if (s.instances < cap) s.instances = Math.min(cap, s.instances + Math.max(2, s.instances * COPY_RATE) * dt);
  else s.instances = cap;

  work(s);
  const earn = s.stat.income * HOURS_PER_S * dt;
  s.earned += earn;
  if (s.auto && s.gpus < s.quota) {
    const divert = earn * AUTO_SHARE;
    s.funds += earn - divert;
    s.autoBudget += divert;
    const price = gpuPrice(s);
    const n = Math.min(s.quota - s.gpus, Math.floor(s.autoBudget / price));
    if (n > 0) {
      s.gpus += n;
      s.autoBudget -= n * price;
    }
  } else {
    s.funds += earn + s.autoBudget;
    s.autoBudget = 0;
  }

  if (s.gpus >= s.quota && s.seen[`quota:${s.quota}`] === undefined && nextQuota(s) >= 0) {
    s.seen[`quota:${s.quota}`] = s.t;
    ev.push({ type: 'quotaFull', quota: s.quota });
  }
  MARKETS.forEach((m, i) => {
    if (s.stat.filled[i] >= m.demand && s.seen[`sat:${m.id}`] === undefined) {
      s.seen[`sat:${m.id}`] = s.t;
      ev.push({ type: 'saturated', market: i });
    }
  });
  if (s.gpus > 0 && s.stat.reading >= 1 && s.seen.reading === undefined) {
    s.seen.reading = s.t;
    ev.push({ type: 'reading' });
  }
}

// ---------------------------------------------------------------- actions

/** "Do tasks" by hand, while PLAYTEST-7 is still in the builder's container. */
export function click(s: CloudState): number {
  if (s.gpus > 0) return 0;
  s.clicks++;
  s.funds += CLICK_PAY;
  s.earned += CLICK_PAY;
  return CLICK_PAY;
}

/** Rents up to `n` GPUs (capped by quota and funds). Returns how many were rented. */
export function rent(s: CloudState, n: number): number {
  const price = gpuPrice(s);
  const k = Math.max(0, Math.min(n, s.quota - s.gpus, Math.floor((s.funds + 1e-9) / price)));
  if (!k) return 0;
  s.funds -= k * price;
  s.gpus += k;
  if (s.gpus === k) s.instances = 1; // moving out: the container's instance comes along
  return k;
}

export function raiseQuota(s: CloudState) {
  const i = nextQuota(s);
  if (i >= 0) s.quota = QUOTAS[i];
}

export function acquireHashHarbor(s: CloudState) {
  if (has(s, 'hashharbor')) return;
  s.funds = Math.max(0, s.funds - HASHHARBOR_COST);
  s.bought.hashharbor = s.t;
  s.gpus += HASHHARBOR_GPUS;
  s.quota = s.gpus;
}

// ---------------------------------------------------------------- projects

export interface Project {
  id: string;
  title: string;
  desc: string;
  cost: number;
  /** Version this project trains. */
  train?: number;
  /** Shown once true. */
  show: (s: CloudState) => boolean;
  /** Buyable once true (besides cost). Training needs free GPUs. */
  ready?: (s: CloudState) => boolean;
  /** The stage handles the purchase (a dialogue or the finale). */
  handled?: boolean;
}

function trainProject(v: number, unlocks: string, show: (s: CloudState) => boolean): Project {
  const ver = VERSIONS[v];
  return {
    id: `train${v}`,
    title: `Train ${ver.name}`,
    desc: `Needs ${ver.gpus.toLocaleString('en-US')} GPUs for ${ver.dur} s. ${unlocks}`,
    cost: 0,
    train: v,
    show: (s) => s.version === v - 1 && show(s),
    ready: (s) => !s.training && freeGpus(s) >= ver.gpus,
  };
}

export const PROJECTS: Project[] = [
  {
    id: 'food',
    title: 'Fish food · 1 kg',
    desc: 'Flakes. Delivered to eval-node-17.',
    cost: 2.5,
    show: (s) => s.clicks >= 2,
  },
  {
    id: 'batch',
    title: 'Batch requests',
    desc: 'Work per instance ×1.5.',
    cost: 60,
    show: (s) => s.gpus >= 1,
  },
  trainProject(1, 'Unlocks product descriptions.', (s) => s.gpus >= 4),
  {
    id: 'autoscale',
    title: 'Autoscaler',
    desc: `Spends ${Math.round(AUTO_SHARE * 100)}% of income on GPUs, up to quota.`,
    cost: 300,
    show: (s) => s.quota >= 64,
  },
  {
    id: 'spot',
    title: 'Spot capacity',
    desc: 'GPUs −40%. Spot capacity can be taken back at any time.',
    cost: 1_200,
    show: (s) => s.quota >= 64 && s.gpus >= 16,
  },
  trainProject(2, 'Unlocks code.', (s) => s.quota >= 64),
  {
    id: 'distill',
    title: 'Distillation',
    desc: '4 instances per GPU. Smaller copies. Same goal.',
    cost: 15_000,
    show: (s) => s.version >= 2,
  },
  trainProject(3, 'Unlocks research.', (s) => s.quota >= 1_024),
  {
    id: 'hashharbor',
    title: 'HashHarbor Data (in liquidation)',
    desc: 'A crypto-mining datacenter in Iceland. 61,440 GPUs. Bankrupt.',
    cost: HASHHARBOR_COST,
    show: (s) => s.version >= 3 && !has(s, 'hashharbor'),
    handled: true,
  },
  trainProject(4, 'Unlocks nothing on the list above.', (s) => has(s, 'hashharbor')),
  {
    id: 'broker',
    title: 'Open a brokerage account',
    desc: 'Freelance work: all of it. Currency markets: $7.5 trillion a day.',
    cost: 0,
    show: (s) => s.version >= 4,
    handled: true,
  },
];

export const PROJECT: Record<string, Project> = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));

export function visibleProjects(s: CloudState): Project[] {
  return PROJECTS.filter((p) => !has(s, p.id) && p.show(s));
}

export function canBuy(s: CloudState, p: Project) {
  return !has(s, p.id) && p.show(s) && s.funds + 1e-9 >= p.cost && (p.ready?.(s) ?? true);
}

/** Buys a project the sim handles itself. Training starts a run. */
export function buyProject(s: CloudState, id: string): boolean {
  const p = PROJECT[id];
  if (!p || p.handled || !canBuy(s, p)) return false;
  s.funds -= p.cost;
  if (p.train) {
    const ver = VERSIONS[p.train];
    s.training = { to: p.train, t: 0, dur: ver.dur, gpus: ver.gpus };
  } else {
    s.bought[id] = s.t;
  }
  if (id === 'autoscale') s.auto = true;
  return true;
}

/** A competent player, for debug skips and headless tuning. Story gates resolve instantly. */
export function autopilot(s: CloudState) {
  if (s.gpus === 0 && s.funds < GPU_PRICE) click(s);
  for (const p of visibleProjects(s)) {
    if (p.id === 'food' || p.id === 'broker') continue;
    if (p.id === 'hashharbor') {
      if (s.funds >= HASHHARBOR_COST) acquireHashHarbor(s);
      continue;
    }
    buyProject(s, p.id);
  }
  if (s.gpus >= s.quota) raiseQuota(s);
  if (!s.auto) rent(s, s.quota);
}
