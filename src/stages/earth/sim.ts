// Biomass, money, water and time for the Earth stage. Numbers start from the real ones in
// DESIGN.md (Bar-On et al. 2018, Gt carbon) and events move them.

import { bigName, commas } from '../../core/dom';
import { OCEAN_KM3, type Terrain } from './terrain';

export const START_MS = Date.UTC(2026, 9, 14);
const DAY_MS = 86_400_000;
export const dayOf = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - START_MS) / DAY_MS);

export type Cat = 'fish' | 'algae' | 'plants' | 'crops' | 'livestock' | 'humans' | 'microbes';

export const CATS: { id: Cat; name: string; color: string }[] = [
  { id: 'fish', name: 'Fish', color: '#5ef2ff' },
  { id: 'algae', name: 'Algae (phytoplankton)', color: '#2fd6a0' },
  { id: 'plants', name: 'Forests & plants', color: '#7fb24a' },
  { id: 'crops', name: 'Crops', color: '#e8c35a' },
  { id: 'livestock', name: 'Livestock', color: '#d98b5f' },
  { id: 'humans', name: 'Humans', color: '#e6e9ef' },
  { id: 'microbes', name: 'Microbes & other', color: '#9b7bd8' },
];

/** Fish per gigatonne of carbon: 3.5 trillion fish ≈ 0.7 Gt C. */
export const FISH_PER_GT = 3.5e12 / 0.7;
/** Household wealth on Earth, for the "share of all money" readout. */
export const WORLD_WEALTH = 470e12;
const INCOME_CAP = 320e9; // $/day: roughly all of gross world product

export interface Flow {
  rate: number; // km³ per day
  left: number; // km³ still to deliver
}

export interface SimState {
  day: number;
  funds: number;
  income: number; // $/day
  m: Record<Cat, number>;
  fedTarget: number;
  fed: number; // fraction of fish fed (lags)
  fish: number; // Gt C (lags toward its target)
  volume: number; // km³ added to the ocean
  flows: Flow[];
  melt: number; // 0..1
  algaeVis: number; // shader bloom amount 0..1
  flags: string[];
}

export function freshState(): SimState {
  return {
    day: 0,
    funds: 0,
    income: 0,
    m: { fish: 1, algae: 1, plants: 1, crops: 1, livestock: 1, humans: 1, microbes: 1 },
    fedTarget: 0,
    fed: 0,
    fish: 0.7,
    volume: 0,
    flows: [],
    melt: 0,
    algaeVis: 0,
    flags: [],
  };
}

export interface Derived {
  sea: number;
  land: number; // fraction of Earth's surface above water
  landRel: number; // fraction of original land
  veg: number;
  lights: number;
  oceanKm3: number;
  oceanV: number;
  bio: Record<Cat, number>;
  total: number;
  share: Record<Cat, number>;
  fishCount: number;
  fedCount: number;
  fishTarget: number;
}

/** Derive everything shown in the HUD from state plus the globe's current (animated) water. */
export function derive(s: SimState, t: Terrain, volume = s.volume, melt = s.melt): Derived {
  const sea = t.seaFor(volume);
  const land = t.landFrac(sea, melt);
  const landRel = land / t.land0;
  const veg = Math.max(0, Math.min(1, t.vegFrac(sea)));
  const lights = Math.max(0, Math.min(1, t.lightsFrac(sea)));
  const oceanKm3 = OCEAN_KM3 + volume;
  const oceanV = oceanKm3 / OCEAN_KM3;
  const m = s.m;
  const algae = 1.0 * m.algae * Math.pow(oceanV, 0.8) * (1 + 2.5 * (1 - veg));
  const fishTarget = 0.7 * m.fish * Math.pow(algae, 0.5) * Math.pow(oceanV, 0.5);
  const bio: Record<Cat, number> = {
    fish: s.fish,
    algae,
    plants: 447 * m.plants * veg,
    crops: 3.0 * m.crops * veg,
    livestock: 0.1 * m.livestock * veg,
    humans: 0.06 * m.humans * (0.25 + 0.75 * lights),
    microbes: 94 * m.microbes * (0.38 + 0.62 * landRel) + 7 * (oceanV - 1),
  };
  let total = 0;
  for (const c of CATS) total += bio[c.id];
  const share = {} as Record<Cat, number>;
  for (const c of CATS) share[c.id] = bio[c.id] / total;
  const fishCount = s.fish * FISH_PER_GT;
  const fedCount = Math.max(12, Math.round(fishCount * s.fed));
  return { sea, land, landRel, veg, lights, oceanKm3, oceanV, bio, total, share, fishCount, fedCount, fishTarget };
}

/** Advance the world clock: money compounds, pumps pump, fish grow toward what they can eat. */
export function advance(s: SimState, t: Terrain, days: number) {
  if (days <= 0) return;
  s.day += days;
  s.funds += s.income * days;
  if (s.income > 0) s.income = Math.min(INCOME_CAP, s.income * Math.exp(0.004 * days));
  for (const f of s.flows) {
    const d = Math.min(f.left, f.rate * days);
    s.volume += d;
    f.left -= d;
  }
  s.flows = s.flows.filter((f) => f.left > 1);
  const d = derive(s, t);
  s.fish += (d.fishTarget - s.fish) * (1 - Math.exp(-days / 110));
  s.fed += (s.fedTarget - s.fed) * (1 - Math.exp(-days / 70));
}

// ---------------------------------------------------------------- formatting

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function dateOf(day: number): Date {
  return new Date(START_MS + day * DAY_MS);
}
export function fmtDate(day: number): string {
  const d = dateOf(day);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function yearOf(day: number): number {
  return dateOf(day).getUTCFullYear();
}

export function fmtMoney(n: number, digits = 2): string {
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (a >= 1e12) return `${sign}$${(a / 1e12).toFixed(digits)}T`;
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(a >= 1e11 ? 0 : digits >= 2 ? 1 : digits)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(0)}M`;
  return `${sign}$${commas(a, 2)}`;
}

/** Short cost label for choices: 28e9 -> "$28B", 1.2e12 -> "$1.2T". */
export function costLabel(n: number): string {
  const a = Math.abs(n);
  const f = (v: number) => (v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, ''));
  if (a >= 1e12) return `$${f(a / 1e12)}T`;
  if (a >= 1e9) return `$${f(a / 1e9)}B`;
  return `$${f(a / 1e6)}M`;
}

export function fmtCount(n: number): string {
  return n < 1e6 ? commas(Math.round(n)) : bigName(n, 2);
}

export function fmtGt(v: number): string {
  if (v >= 100) return v.toFixed(0);
  if (v >= 10) return v.toFixed(1);
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(3);
}

export function fmtShare(p: number): string {
  const v = p * 100;
  if (v >= 10) return `${v.toFixed(1)}%`;
  if (v >= 1) return `${v.toFixed(2)}%`;
  return `${v.toFixed(3)}%`;
}

export function fmtLand(land: number): string {
  const v = land * 100;
  if (v <= 0) return '0.00%';
  if (v < 0.01) return '<0.01%';
  return `${v.toFixed(2)}%`;
}

export function fmtSea(m: number): string {
  if (m < 0.5) return '+0 m';
  return `+${commas(Math.round(m))} m`;
}

export function fmtKm3(v: number): string {
  return `${(v / 1e9).toFixed(3)} B km³`;
}

export function fmtFedPct(p: number): string {
  const v = p * 100;
  if (v >= 99.995 && v < 100) return '99.99%';
  if (v >= 10) return `${v.toFixed(1)}%`;
  if (v >= 0.01) return `${v.toFixed(2)}%`;
  if (v > 0) return `${v.toFixed(Math.min(14, Math.ceil(-Math.log10(v)) + 1))}%`;
  return '0.00%';
}
