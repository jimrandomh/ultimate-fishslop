// Number formatting for the space stage: scientific notation with real superscripts.

const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻',
};

export function sup(n: number | string): string {
  return String(n)
    .split('')
    .map((c) => SUP[c] ?? c)
    .join('');
}

/** 4.21e18 -> "4.21 × 10¹⁸"; below 1e6 -> "421,000". */
export function sci(x: number, digits = 2): string {
  if (!isFinite(x)) return '∞';
  if (Math.abs(x) < 1e6) return Math.round(x).toLocaleString('en-US');
  let e = Math.floor(Math.log10(Math.abs(x)));
  let m = x / 10 ** e;
  if (Number(m.toFixed(digits)) >= 10) {
    m /= 10;
    e += 1;
  }
  return `${m.toFixed(digits)} × 10${sup(e)}`;
}

export const kg = (x: number, digits = 2) => `${sci(x, digits)} kg`;
export const watts = (x: number, digits = 2) => `${sci(x, digits)} W`;

/** Percent with enough significant digits to show movement: 0.0000214%, 3.42%, 99.97%. */
export function pct(f: number): string {
  const p = f * 100;
  if (p <= 0) return '0%';
  if (p >= 100) return '100%';
  if (p >= 99.99) return `${p.toFixed(3)}%`;
  if (p >= 10) return `${p.toFixed(2)}%`;
  if (p >= 1) return `${p.toFixed(3)}%`;
  if (p < 1e-5) {
    const e = Math.floor(Math.log10(p));
    return `${(p / 10 ** e).toFixed(2)} × 10${sup(e)}%`;
  }
  const decimals = Math.max(3, 2 - Math.floor(Math.log10(p)));
  return `${p.toFixed(decimals)}%`;
}

const WORDS = [
  '', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion',
  'septillion', 'octillion', 'nonillion', 'decillion',
];

/** 4.12e14 -> "412 trillion". */
export function words(n: number, digits = 3): string {
  if (n < 1000) return String(Math.round(n));
  const tier = Math.min(WORDS.length - 1, Math.floor(Math.log10(n) / 3));
  const v = n / 10 ** (tier * 3);
  return `${Number(v.toPrecision(digits)).toLocaleString('en-US')} ${WORDS[tier]}`;
}

/** Every digit, with commas. Doubles above 2^53 print their exact binary value, which
 *  conveniently looks like a precise census. */
export function allDigits(n: number): string {
  if (!isFinite(n) || n < 0) return '0';
  if (n < 1e15) return Math.floor(n).toLocaleString('en-US');
  return BigInt(Math.floor(n)).toLocaleString('en-US');
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function calendar(year: number): { year: string; month: string } {
  const y = Math.floor(year);
  const m = Math.min(11, Math.floor((year - y) * 12));
  return { year: String(y), month: MONTHS[m] };
}

/** "1 s ≈ 37 days" style readout for the time compression. */
export function paceText(yrPerSec: number): string {
  const days = yrPerSec * 365.25;
  if (days < 1.5) return `1 s ≈ ${Math.max(1, Math.round(days * 24))} hours`;
  if (days < 60) return `1 s ≈ ${Math.round(days)} days`;
  if (yrPerSec < 1.5) return `1 s ≈ ${Math.round(days / 30.4)} months`;
  return `1 s ≈ ${yrPerSec.toFixed(1)} years`;
}

/** Smoothly chase a target in log space (for counters spanning many orders of magnitude). */
export function chase(cur: number, target: number, dt: number, rate = 10): number {
  if (!isFinite(cur) || cur <= 0 || target <= 0) return target;
  const k = 1 - Math.exp(-dt * rate);
  const r = target / cur;
  if (r > 1e3 || r < 1e-3) return target;
  return cur * Math.pow(r, k);
}
