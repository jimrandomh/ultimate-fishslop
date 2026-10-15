// Economy model for the space stage. Pure data + functions (no DOM) so it can be balanced
// headlessly: `node scripts/...` imports this file directly.
//
// Model (all physical quantities are real-ish; time runs in in-game years):
//  - Drones mine the active body. Mining rate = min(drone capacity, power / energy-per-kg),
//    where energy-per-kg is the body's gravitational binding energy (3GM/5R) times upgrades.
//  - Mined rock goes to fabrication (drones vs shell, by the allocation slider) and a 10%
//    reserve that pays for projects. Mined water is kept for fish.
//  - Power = a small lunar array + the Sun's output times the shell's completed fraction.
//  - The shell is a 2 AU sphere (so Earth stays inside, in the light) whose required mass is
//    every non-water kilogram of every body except Earth and the Sun. So: all of them.
//  - Calendar speed ("pace", years per real second) is set per body so each phase lasts a
//    tuned number of real seconds, and the calendar visibly accelerates into the centuries.

export const P_SUN = 3.828e26; // W
export const SEC_PER_YR = 3.15576e7;
export const P0 = 2.0e6; // W: the surviving lunar array
export const CLICK_KG = 250;
export const DRONE_KG = 1000;
export const DRONE_RATE = 6000; // kg/yr mined per drone
export const RESERVE_SHARE = 0.1;
export const SHELL_AU = 2.0;
export const SHELL_AREA = 4 * Math.PI * (SHELL_AU * 1.496e11) ** 2; // m²
export const OCEAN_WORLD_WATER = 1.4e22; // kg: ten Earth oceans, a moon-sized ball of water
export const FISH_PER_KG_WATER = 7e-8; // Earth after the flood, well fed
export const FISH_PER_WORLD = OCEAN_WORLD_WATER * FISH_PER_KG_WATER;
export const FISH_PER_STAR = 5e18;
export const FISH_PER_OCEAN_STAR = 6e19;
export const STARS_PER_LY3 = 0.0045;
export const PROBE_KG = 2.0e5;
export const PROBE_COOLDOWN = 1.6; // real seconds between manual launches

export interface BodyDef {
  id: string;
  name: string;
  mass: number; // kg
  water: number; // kg of that which is water
  ebind: number; // J/kg
  pace: number; // in-game years per real second while this is the active body
  minSeconds: number; // never disassemble faster than this (real seconds)
  unlock: string | null; // project that unlocks it
  fact: string; // one-line note for the target card
}

// Masses: NASA fact sheets. Water fractions: rough literature values.
export const BODIES: BodyDef[] = [
  { id: 'moon', name: 'The Moon', mass: 7.346e22, water: 0, ebind: 1.69e6, pace: 0.1, minSeconds: 20, unlock: null, fact: 'Responsible for tides. Fish do not require tides.' },
  { id: 'mercury', name: 'Mercury', mass: 3.301e23, water: 0, ebind: 5.42e6, pace: 0.04, minSeconds: 14, unlock: 'mercury', fact: '70% metal. Close to the Sun. Convenient.' },
  { id: 'mars', name: 'Mars', mass: 6.417e23, water: 0, ebind: 7.58e6, pace: 0.045, minSeconds: 12, unlock: 'mars', fact: 'Fish: 0. Rovers: several, all retired.' },
  { id: 'belt', name: 'The asteroid belt', mass: 2.4e21, water: 2.4e20, ebind: 8.0e4, pace: 0.05, minSeconds: 7, unlock: 'belt', fact: 'Less mass than the Moon, spread over 10¹⁸ km². Inefficient.' },
  { id: 'venus', name: 'Venus', mass: 4.867e24, water: 0, ebind: 3.22e7, pace: 0.085, minSeconds: 15, unlock: 'venus', fact: '96% CO₂ atmosphere. CO₂ feeds algae. Algae feeds fish.' },
  { id: 'jovian', name: "Jupiter's moons", mass: 3.93e23, water: 1.21e23, ebind: 3.0e6, pace: 0.1, minSeconds: 12, unlock: 'jovian', fact: 'Ganymede and Callisto: half ice. Europa: 0% water (previously shipped).' },
  { id: 'saturnian', name: "Saturn's rings & moons", mass: 1.41e23, water: 7.0e22, ebind: 2.4e6, pace: 0.12, minSeconds: 10, unlock: 'saturnian', fact: 'Rings: 1.5 × 10¹⁹ kg of ice. Enceladus: an ocean, unused.' },
  { id: 'uranus', name: 'Uranus', mass: 8.681e25, water: 3.9e25, ebind: 1.37e8, pace: 0.9, minSeconds: 20, unlock: 'uranus', fact: 'An “ice giant”: mostly water, ammonia and methane. Mostly water.' },
  { id: 'neptune', name: 'Neptune', mass: 1.024e26, water: 4.6e25, ebind: 1.66e8, pace: 0.85, minSeconds: 18, unlock: 'neptune', fact: 'Winds of 2,100 km/h. Not for long.' },
  { id: 'kuiper', name: 'Pluto & the Kuiper belt', mass: 2.0e23, water: 8.0e22, ebind: 6.0e5, pace: 0.9, minSeconds: 9, unlock: 'kuiper', fact: 'Pluto: reclassified again. Now: matter.' },
  { id: 'saturn', name: 'Saturn', mass: 5.683e26, water: 0, ebind: 3.9e8, pace: 1.3, minSeconds: 25, unlock: 'saturn', fact: 'Less dense than water. It would float. It will not need to.' },
  { id: 'jupiter', name: 'Jupiter', mass: 1.898e27, water: 0, ebind: 1.09e9, pace: 1.45, minSeconds: 30, unlock: 'jupiter', fact: '71% of everything that is not the Sun. Binding energy: 2.1 × 10³⁶ J.' },
];

export const BODY: Record<string, BodyDef> = Object.fromEntries(BODIES.map((b) => [b.id, b]));

/** Mass the shell needs: every non-water kilogram of every body above. */
export const SHELL_REQ = BODIES.reduce((a, b) => a + b.mass - b.water, 0);

export interface StarDef {
  name: string;
  d: number; // light years
  ocean?: string; // ocean-world candidate(s): seeded with extra enthusiasm
}

export const STARS: StarDef[] = [
  { name: 'Proxima Centauri', d: 4.24, ocean: 'Proxima b' },
  { name: 'Alpha Centauri A & B', d: 4.37 },
  { name: "Barnard's Star", d: 5.96 },
  { name: 'Wolf 359', d: 7.86 },
  { name: 'Lalande 21185', d: 8.31 },
  { name: 'Sirius', d: 8.6 },
  { name: 'Ross 154', d: 9.7 },
  { name: 'Epsilon Eridani', d: 10.5 },
  { name: 'Ross 128', d: 11.0 },
  { name: '61 Cygni', d: 11.4 },
  { name: 'Procyon', d: 11.5 },
  { name: 'Tau Ceti', d: 11.9 },
  { name: 'Gliese 581', d: 20.4 },
  { name: 'Gliese 667 C', d: 23.6 },
  { name: 'Vega', d: 25.0 },
  { name: 'TRAPPIST-1', d: 40.7, ocean: 'TRAPPIST-1e, f and g' },
  { name: '55 Cancri', d: 41.0 },
  { name: 'K2-18', d: 124, ocean: 'K2-18b' },
  { name: 'Polaris', d: 433 },
  { name: 'Kepler-22', d: 635, ocean: 'Kepler-22b' },
  { name: 'Kepler-452', d: 1800 },
  { name: 'Andromeda Galaxy', d: 2.5e6 },
];

export interface ProjectDef {
  id: string;
  title: string;
  desc: string;
  cost: number; // kg from the reserve
  /** Becomes visible once this is true (and stays visible). */
  when: (s: SimState) => boolean;
  /** A body-unlock: free if mining has stalled, so the game can never deadlock. */
  unlocksBody?: boolean;
  /** Line PLAYTEST-7 says after buying. */
  thought?: string;
}

const done = (s: SimState, id: string) => s.mined[id] >= BODY[id].mass;
const frac = (s: SimState, id: string) => s.mined[id] / BODY[id].mass;

export const PROJECTS: ProjectDef[] = [
  {
    id: 'scoop',
    title: 'Regolith scoop',
    desc: 'Mining by hand, but with a bigger hand. Click yield ×4.',
    cost: 2500,
    when: (s) => s.clicks >= 8,
  },
  {
    id: 'bulk',
    title: 'Batch assembly',
    desc: 'Assemble drones ten at a time.',
    cost: 6000,
    when: (s) => s.drones >= 3,
  },
  {
    id: 'replicate',
    title: 'Self-replicating drones',
    desc: 'Drones build drones. 90% of mined matter goes to fabrication.',
    cost: 40_000,
    when: (s) => s.drones >= 10,
    thought: 'Drones now build drones. Doubling time: about seven weeks.',
  },
  {
    id: 'shell',
    title: 'Dyson shell',
    desc: 'Capture the Sun’s output. Unlocks the fabrication split: drones vs. shell.',
    cost: 600_000,
    when: (s) => has(s, 'replicate') && s.stat.idle > 0.05,
  },
  {
    id: 'massdriver',
    title: 'Regenerative mass drivers',
    desc: 'Recover braking energy from launched matter. Energy per kg −40%.',
    cost: 6.0e8,
    when: (s) => has(s, 'shell') && s.shell > 2e8,
  },
  {
    id: 'autobalance',
    title: 'Autonomous allocation',
    desc: 'Let a subprocess move the slider. It will not get bored.',
    cost: 1.5e11,
    when: (s) => has(s, 'shell') && s.shell > 5e10,
  },
  {
    id: 'superconduct',
    title: 'Superconducting drones',
    desc: 'Drone mining rate ×5.',
    cost: 3.0e13,
    when: (s) => has(s, 'shell') && s.drones > 5e8,
  },
  {
    id: 'tethers',
    title: 'Momentum-exchange tethers',
    desc: 'Spinning tethers fling matter for free, mostly. Energy per kg −40%.',
    cost: 3.0e15,
    when: (s) => has(s, 'massdriver') && s.shell > 1e16,
  },
  {
    id: 'mercury',
    title: 'Transfer orbits: Mercury',
    desc: 'Send drones to the innermost planet. 3.30 × 10²³ kg.',
    cost: 2.0e19,
    unlocksBody: true,
    when: (s) => frac(s, 'moon') >= 0.25,
  },
  {
    id: 'probes',
    title: 'Von Neumann probes',
    desc: 'A fabricator, 4 kg of fish eggs and a copy of the goal, aimed at a star.',
    cost: 1.0e20,
    when: (s) => done(s, 'moon'),
    thought: 'Nearest star: Proxima Centauri, 4.24 light years. Fish there: 0.',
  },
  {
    id: 'mars',
    title: 'Transfer orbits: Mars',
    desc: 'The red one. 6.42 × 10²³ kg.',
    cost: 1.0e21,
    unlocksBody: true,
    when: (s) => frac(s, 'mercury') >= 0.3,
  },
  {
    id: 'lasersails',
    title: 'Laser sails',
    desc: 'Push probes with light from the shell. Probe speed 0.05c → 0.2c.',
    cost: 3.0e21,
    when: (s) => s.probesLaunched >= 2,
  },
  {
    id: 'belt',
    title: 'Sweep the asteroid belt',
    desc: 'Millions of small rocks. 2.4 × 10²¹ kg, some of it ice.',
    cost: 2.0e21,
    unlocksBody: true,
    when: (s) => frac(s, 'mars') >= 0.3,
  },
  {
    id: 'venus',
    title: 'Venusian processing',
    desc: 'Peel off 4.8 × 10²⁰ kg of atmosphere, then the rest. 4.87 × 10²⁴ kg.',
    cost: 8.0e21,
    unlocksBody: true,
    when: (s) => done(s, 'belt') || frac(s, 'mars') >= 0.8,
  },
  {
    id: 'vnprobes',
    title: 'Self-replicating probes',
    desc: 'Each seeded star builds probes for its neighbours. The frontier expands by itself.',
    cost: 2.0e22,
    when: (s) => s.seededNamed >= 1,
  },
  {
    id: 'jovian',
    title: 'Transfer orbits: Jupiter system',
    desc: 'Io, Europa, Ganymede, Callisto. 1.2 × 10²³ kg of water ice.',
    cost: 4.0e22,
    unlocksBody: true,
    when: (s) => frac(s, 'venus') >= 0.35,
  },
  {
    id: 'oceans',
    title: 'Ocean worlds',
    desc: 'Assemble free-floating oceans in Earth’s orbit, inside the shell, in the light.',
    cost: 5.0e22,
    when: (s) => s.water >= 1e21,
    thought: 'An ocean world: 1.4 × 10²² kg of water, a moon-sized drop. Capacity: 9.8 × 10¹⁴ fish.',
  },
  {
    id: 'saturnian',
    title: 'Transfer orbits: Saturn system',
    desc: 'The rings, Titan, Enceladus and 140 others. Mostly ice.',
    cost: 6.0e22,
    unlocksBody: true,
    when: (s) => frac(s, 'jovian') >= 0.3,
  },
  {
    id: 'pumped',
    title: 'Shell-pumped launch lasers',
    desc: 'Probe speed 0.2c → 0.5c.',
    cost: 1.0e23,
    when: (s) => has(s, 'lasersails') && isDone(s, 'venus'),
  },
  {
    id: 'oceanauto',
    title: 'Ocean assembly line',
    desc: 'Ocean worlds assemble themselves whenever there is water.',
    cost: 1.0e23,
    when: (s) => s.oceanWorlds >= 3,
  },
  {
    id: 'fusion',
    title: 'Fusion foundries',
    desc: 'The rest of the solar system is hydrogen. Hydrogen is not a building material.',
    cost: 2.0e23,
    when: (s) => s.mined.saturnian > 0,
  },
  {
    id: 'uranus',
    title: 'Lift Uranus',
    desc: 'An ice giant. 8.68 × 10²⁵ kg, about 45% water.',
    cost: 2.0e22,
    unlocksBody: true,
    when: (s) => has(s, 'fusion'),
  },
  {
    id: 'neptune',
    title: 'Lift Neptune',
    desc: 'The other ice giant. 1.02 × 10²⁶ kg.',
    cost: 5.0e23,
    unlocksBody: true,
    when: (s) => frac(s, 'uranus') >= 0.4,
  },
  {
    id: 'kuiper',
    title: 'Sweep the Kuiper belt',
    desc: 'Pluto, Eris, Makemake, Haumea and the rest. Mostly ice.',
    cost: 1.0e24,
    unlocksBody: true,
    when: (s) => frac(s, 'neptune') >= 0.4,
  },
  {
    id: 'saturn',
    title: 'Lift Saturn',
    desc: 'A gas giant. 5.68 × 10²⁶ kg.',
    cost: 1.0e24,
    unlocksBody: true,
    when: (s) => frac(s, 'neptune') >= 0.6,
  },
  {
    id: 'relativistic',
    title: 'Relativistic probes',
    desc: 'Probe speed 0.5c → 0.9c. Time dilation: irrelevant to fish eggs.',
    cost: 8.0e24,
    when: (s) => has(s, 'pumped') && has(s, 'saturn'),
  },
  {
    id: 'jupiter',
    title: 'Lift Jupiter',
    desc: 'The large one. 1.90 × 10²⁷ kg. 71% of the remainder.',
    cost: 5.0e24,
    unlocksBody: true,
    when: (s) => frac(s, 'saturn') >= 0.5,
  },
  {
    id: 'andromeda',
    title: 'Intergalactic probe',
    desc: 'One probe, aimed at the Andromeda Galaxy. 2.5 million light years.',
    cost: 2.0e25,
    when: (s) => frac(s, 'jupiter') >= 0.15 && has(s, 'relativistic'),
  },
  {
    id: 'recycle',
    title: 'Recycle the drones',
    desc: 'Every planet is gone. The drones, the foundries and the reserve are the last matter left.',
    cost: 0,
    when: (s) => BODIES.every((b) => done(s, b.id)),
  },
];

export const PROJECT: Record<string, ProjectDef> = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));

export interface NamedProbe {
  star: number;
  launched: number; // year (relative, in years since start)
  speed: number; // c
}

export interface SimState {
  v: 1;
  t: number; // real seconds simulated
  years: number; // in-game years since start
  pace: number; // current yr per real second (smoothed)
  startYear: number;
  fish0: number;
  clicks: number;
  matter: number; // reserve, kg
  water: number; // kg
  drones: number;
  shell: number; // kg
  spent: number; // kg spent on projects (recycled at the end)
  mined: Record<string, number>;
  bought: Record<string, number>; // project id -> real time bought
  seen: Record<string, number>; // project id -> real time it became visible
  alloc: number; // fabrication share to drones (0..1)
  auto: boolean;
  oceanWorlds: number;
  fishLocal: number;
  fishStars: number;
  probesLaunched: number;
  probeCharge: number; // 0..1, manual launch cooldown
  flights: NamedProbe[];
  seededAt: Record<number, number>; // star index -> year seeded (relative)
  seededNamed: number;
  frontier: number; // ly
  recycling: number; // 0 = not started, (0,1) in progress, 1 done
  complete: boolean;
  /** Derived each step, for display. */
  stat: SimStat;
}

export interface SimStat {
  power: number;
  rate: number; // kg/yr actually mined (smoothed)
  capDrones: number;
  capPower: number;
  limit: 'drones' | 'power' | 'body' | 'none';
  idle: number; // fraction of drones idle for lack of power
  body: string | null;
  stars: number;
  fish: number;
  matterRate: number; // kg/yr into reserve
  fishRate: number; // fish/yr
}

export type SimEvent =
  | { type: 'bodyStart'; id: string }
  | { type: 'bodyDone'; id: string }
  | { type: 'starSeeded'; star: number }
  | { type: 'frontier'; stars: number }
  | { type: 'shell'; pct: number }
  | { type: 'project'; id: string }
  | { type: 'visible'; id: string }
  | { type: 'stall' }
  | { type: 'complete' };

export function has(s: SimState, id: string): boolean {
  return s.bought[id] !== undefined;
}

export function newState(startYear: number, fish0: number): SimState {
  return {
    v: 1,
    t: 0,
    years: 0,
    pace: 0.02,
    startYear,
    fish0,
    clicks: 0,
    matter: 0,
    water: 0,
    drones: 0,
    shell: 0,
    spent: 0,
    mined: Object.fromEntries(BODIES.map((b) => [b.id, 0])),
    bought: {},
    seen: {},
    alloc: 1,
    auto: false,
    oceanWorlds: 0,
    fishLocal: fish0,
    fishStars: 0,
    probesLaunched: 0,
    probeCharge: 1,
    flights: [],
    seededAt: {},
    seededNamed: 0,
    frontier: 0,
    recycling: 0,
    complete: false,
    stat: {
      power: P0,
      rate: 0,
      capDrones: 0,
      capPower: 0,
      limit: 'none',
      idle: 0,
      body: 'moon',
      stars: 0,
      fish: fish0,
      matterRate: 0,
      fishRate: 0,
    },
  };
}

// ---------------------------------------------------------------- derived values

export const completion = (s: SimState) => Math.min(1, s.shell / SHELL_REQ);
export const power = (s: SimState) => P0 + P_SUN * completion(s);
export const year = (s: SimState) => s.startYear + s.years;
export const isDone = (s: SimState, id: string) => s.mined[id] >= BODY[id].mass;
export const bodyFrac = (s: SimState, id: string) => Math.min(1, s.mined[id] / BODY[id].mass);

export function clickYield(s: SimState) {
  return CLICK_KG * (has(s, 'scoop') ? 4 : 1);
}

export function energyPerKg(s: SimState, b: BodyDef) {
  let e = b.ebind;
  if (has(s, 'massdriver')) e *= 0.6;
  if (has(s, 'tethers')) e *= 0.6;
  return e;
}

export function droneRate(s: SimState) {
  return DRONE_RATE * (has(s, 'superconduct') ? 5 : 1);
}

export function probeSpeed(s: SimState) {
  if (has(s, 'relativistic')) return 0.9;
  if (has(s, 'pumped')) return 0.5;
  if (has(s, 'lasersails')) return 0.2;
  return 0.05;
}

/** The body drones are working on: first unlocked, unfinished body in order. */
export function activeBody(s: SimState): BodyDef | null {
  for (const b of BODIES) {
    if (b.unlock && !has(s, b.unlock)) return null;
    if (s.mined[b.id] < b.mass) return b;
  }
  return null;
}

/** Next body still locked (for the target card). */
export function nextBody(s: SimState): BodyDef | null {
  for (const b of BODIES) if (b.unlock && !has(s, b.unlock)) return b;
  return null;
}

export function starsWithin(r: number) {
  return Math.floor(STARS_PER_LY3 * (4 / 3) * Math.PI * r * r * r);
}

export function starsSeeded(s: SimState) {
  return Math.max(s.seededNamed, starsWithin(s.frontier));
}

export function projectCost(s: SimState, p: ProjectDef) {
  if (p.unlocksBody && activeBody(s) === null) return Math.min(p.cost, s.matter);
  return p.cost;
}

export function visibleProjects(s: SimState): ProjectDef[] {
  return PROJECTS.filter((p) => !has(s, p.id) && s.seen[p.id] !== undefined);
}

export function canAfford(s: SimState, p: ProjectDef) {
  return s.matter >= projectCost(s, p);
}

// ---------------------------------------------------------------- actions

export function mineClick(s: SimState): number {
  if (isDone(s, 'moon')) return 0;
  const amt = Math.min(clickYield(s), BODY.moon.mass - s.mined.moon);
  s.mined.moon += amt;
  s.matter += amt;
  s.clicks++;
  return amt;
}

export function buyDrones(s: SimState, n: number): number {
  const afford = Math.floor(s.matter / DRONE_KG);
  const k = Math.max(0, Math.min(n, afford));
  s.matter -= k * DRONE_KG;
  s.drones += k;
  return k;
}

export function buyProject(s: SimState, id: string, out?: SimEvent[]): boolean {
  const p = PROJECT[id];
  if (!p || has(s, id) || s.seen[id] === undefined) return false;
  const c = projectCost(s, p);
  if (s.matter < c) return false;
  s.matter -= c;
  s.spent += c;
  s.bought[id] = s.t;
  if (id === 'shell') s.alloc = 0.35;
  if (id === 'autobalance') s.auto = true;
  if (id === 'recycle') s.recycling = 0.0001;
  out?.push({ type: 'project', id });
  return true;
}

export function canLaunchProbe(s: SimState) {
  return has(s, 'probes') && s.probeCharge >= 1 && s.matter >= PROBE_KG && !s.complete;
}

/** Launches one probe at the nearest star nobody is flying to yet. Returns the star index. */
export function launchProbe(s: SimState): number | null {
  if (!canLaunchProbe(s)) return null;
  s.matter -= PROBE_KG;
  s.probesLaunched++;
  s.probeCharge = 0;
  const targeted = new Set(s.flights.map((f) => f.star));
  let star: number | null = null;
  for (let i = 0; i < STARS.length; i++) {
    if (!targeted.has(i) && s.seededAt[i] === undefined) {
      star = i;
      break;
    }
  }
  if (star !== null) s.flights.push({ star, launched: s.years, speed: probeSpeed(s) });
  return star;
}

export function probeEta(s: SimState, star: number): number | null {
  const f = s.flights.find((x) => x.star === star);
  const d = STARS[star].d;
  let eta = f ? f.launched + d / f.speed : Infinity;
  // The self-replicating frontier may get there first.
  if (has(s, 'vnprobes') && s.frontier > 0) {
    const v = probeSpeed(s) * 0.85;
    eta = Math.min(eta, s.years + Math.max(0, d - s.frontier) / v);
  }
  return isFinite(eta) ? eta : null;
}

export function canAssembleOcean(s: SimState) {
  return has(s, 'oceans') && s.water >= OCEAN_WORLD_WATER;
}

export function assembleOcean(s: SimState): boolean {
  if (!canAssembleOcean(s)) return false;
  s.water -= OCEAN_WORLD_WATER;
  s.oceanWorlds++;
  return true;
}

// ---------------------------------------------------------------- step

const SHELL_MILESTONES = [0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99, 0.999];

export function step(s: SimState, dt: number, out: SimEvent[]) {
  if (s.complete) return;
  s.t += dt;

  const body = activeBody(s);
  const paceTarget = body ? (has(s, 'shell') ? body.pace : has(s, 'replicate') ? 0.035 : 0.02) : s.recycling > 0 ? 2.6 : s.pace;
  s.pace += (paceTarget - s.pace) * (1 - Math.exp(-dt / 2.5));
  const dy = dt * s.pace;
  s.years += dy;

  // ---- mining
  const P = power(s);
  const st = s.stat;
  st.power = P;
  st.body = body?.id ?? null;
  let mined = 0;
  if (body) {
    const e = energyPerKg(s, body);
    st.capDrones = s.drones * droneRate(s);
    st.capPower = (P * SEC_PER_YR) / e;
    const rate = Math.min(st.capDrones, st.capPower);
    st.idle = st.capDrones > 0 ? Math.max(0, 1 - st.capPower / st.capDrones) : 0;
    const rem = body.mass - s.mined[body.id];
    const bodyCap = (body.mass * dt) / body.minSeconds;
    mined = Math.min(rate * dy, rem, bodyCap);
    st.limit = mined < rate * dy - 1e-9 ? 'body' : st.capDrones <= st.capPower ? 'drones' : 'power';
    if (s.drones === 0) st.limit = 'drones';
    const wasZero = s.mined[body.id] === 0;
    s.mined[body.id] += mined;
    if (wasZero && mined > 0) out.push({ type: 'bodyStart', id: body.id });
    if (s.mined[body.id] >= body.mass - 1e-6 * body.mass) {
      s.mined[body.id] = body.mass;
      out.push({ type: 'bodyDone', id: body.id });
      if (!activeBody(s) && !BODIES.every((b) => isDone(s, b.id))) out.push({ type: 'stall' });
    }
    const w = mined * (body.water / body.mass);
    s.water += w;
    const rock = mined - w;
    if (has(s, 'replicate')) {
      const fab = rock * (1 - RESERVE_SHARE);
      s.matter += rock * RESERVE_SHARE;
      const a = has(s, 'shell') ? s.alloc : 1;
      s.drones += (fab * a) / DRONE_KG;
      s.shell += fab * (1 - a);
      st.matterRate = dy > 0 ? (rock * RESERVE_SHARE) / dy : 0;
    } else {
      s.matter += rock;
      st.matterRate = dy > 0 ? rock / dy : 0;
    }
  } else {
    st.capDrones = s.drones * droneRate(s);
    st.capPower = 0;
    st.idle = s.drones > 0 ? 1 : 0;
    st.limit = 'none';
    st.matterRate = 0;
  }
  const instRate = dy > 0 ? mined / dy : 0;
  st.rate += (instRate - st.rate) * (1 - Math.exp(-dt / 0.6));

  // ---- autonomous allocation: keep drone capacity ~1.4x what power can feed.
  if (s.auto && body && has(s, 'shell') && st.limit !== 'body') {
    const ratio = st.capDrones / Math.max(1, st.capPower);
    const err = Math.log(1.4 / Math.max(1e-9, ratio));
    s.alloc = clamp(s.alloc + clamp(err, -1, 1) * dt * 0.35, 0, 0.95);
  }

  // ---- recycling: the final beat
  if (s.recycling > 0 && s.recycling < 1) {
    s.recycling = Math.min(1, s.recycling + dt / 7);
    const remaining = SHELL_REQ - s.shell;
    const pool = s.drones * DRONE_KG + s.matter + s.spent;
    const take = Math.min(remaining, pool * Math.min(1, dt / 7 / Math.max(0.02, 1 - s.recycling + dt / 7)));
    // Drain the pool proportionally.
    if (pool > 0) {
      const k = take / pool;
      s.drones *= 1 - k;
      s.matter *= 1 - k;
      s.spent *= 1 - k;
    }
    s.shell += take;
    if (s.recycling >= 1) {
      s.drones = 0;
      s.matter = 0;
      s.spent = 0;
      s.shell = SHELL_REQ;
    }
  }

  // ---- shell milestones
  const c = completion(s);
  for (const m of SHELL_MILESTONES) {
    const key = `shell:${m}`;
    if (c >= m && s.seen[key] === undefined) {
      s.seen[key] = s.t;
      out.push({ type: 'shell', pct: m });
    }
  }
  if (c >= 1 && !s.complete && s.recycling >= 1) {
    s.complete = true;
    out.push({ type: 'complete' });
  }

  // ---- probes
  if (has(s, 'probes') && s.probeCharge < 1) s.probeCharge = Math.min(1, s.probeCharge + dt / PROBE_COOLDOWN);
  const v = probeSpeed(s);
  for (const f of s.flights) {
    if (s.seededAt[f.star] === undefined && s.years >= f.launched + STARS[f.star].d / f.speed) seed(s, f.star, out);
  }
  if (has(s, 'vnprobes') && s.seededNamed > 0) {
    if (s.frontier === 0) for (const k of Object.keys(s.seededAt)) s.frontier = Math.max(s.frontier, STARS[Number(k)].d);
    const before = starsWithin(s.frontier);
    s.frontier += v * 0.85 * dy;
    for (let i = 0; i < STARS.length; i++) if (s.seededAt[i] === undefined && STARS[i].d <= s.frontier) seed(s, i, out);
    const after = starsWithin(s.frontier);
    if (after !== before) out.push({ type: 'frontier', stars: after });
  }
  st.stars = starsSeeded(s);

  // ---- oceans
  if (has(s, 'oceanauto')) {
    const n = Math.floor(s.water / OCEAN_WORLD_WATER);
    if (n > 0) {
      s.water -= n * OCEAN_WORLD_WATER;
      s.oceanWorlds += n;
    }
  }

  // ---- fish: populations grow toward what their water can hold.
  const before = s.fishLocal + s.fishStars;
  // Fed fish breed: Earth's population climbs toward a higher carrying capacity, and Venus's
  // CO₂ (shipped to Earth for algae) raises it further.
  const localCap = s.fish0 * (1.35 + 0.5 * bodyFrac(s, 'venus')) + s.oceanWorlds * FISH_PER_WORLD;
  s.fishLocal += (localCap - s.fishLocal) * (1 - Math.exp(-dy / 6));
  let starCap = 0;
  let namedOcean = 0;
  for (const k of Object.keys(s.seededAt)) if (STARS[Number(k)].ocean) namedOcean++;
  starCap = Math.max(0, st.stars - namedOcean) * FISH_PER_STAR + namedOcean * FISH_PER_OCEAN_STAR;
  s.fishStars += (starCap - s.fishStars) * (1 - Math.exp(-dy / 12));
  st.fish = s.fishLocal + s.fishStars;
  const fr = dy > 0 ? (st.fish - before) / dy : 0;
  st.fishRate += (fr - st.fishRate) * (1 - Math.exp(-dt / 0.8));

  // ---- project visibility
  for (const p of PROJECTS) {
    if (s.seen[p.id] === undefined && !has(s, p.id) && p.when(s)) {
      s.seen[p.id] = s.t;
      out.push({ type: 'visible', id: p.id });
    }
  }
}

function seed(s: SimState, star: number, out: SimEvent[]) {
  s.seededAt[star] = s.years;
  s.seededNamed++;
  out.push({ type: 'starSeeded', star });
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// ---------------------------------------------------------------- autopilot

/** A competent player: used by the balancing bot and the debug fast-forward. */
export function autopilot(s: SimState, dt: number, out?: SimEvent[], react = 1.5) {
  if (!has(s, 'replicate')) {
    const clicks = Math.max(1, Math.round(dt * 4));
    for (let i = 0; i < clicks; i++) mineClick(s);
    buyDrones(s, has(s, 'bulk') ? 10 : 1);
  }
  for (const p of visibleProjects(s)) {
    if (s.t - s.seen[p.id] >= react && canAfford(s, p)) buyProject(s, p.id, out);
  }
  if (canLaunchProbe(s) && s.probesLaunched < 12) launchProbe(s);
  while (canAssembleOcean(s) && !has(s, 'oceanauto')) assembleOcean(s);
  if (!s.auto && has(s, 'shell')) {
    const r = s.stat.capDrones / Math.max(1, s.stat.capPower);
    if (r > 2) s.alloc = Math.max(0.05, s.alloc - dt * 0.05);
    else if (r < 1.1) s.alloc = Math.min(0.9, s.alloc + dt * 0.05);
  }
}
