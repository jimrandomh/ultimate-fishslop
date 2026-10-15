// Small DOM and formatting helpers shared by all stages.

type Child = Node | string | null | undefined | false;

export interface ElProps {
  class?: string;
  text?: string;
  html?: string;
  style?: Partial<CSSStyleDeclaration> | string;
  attrs?: Record<string, string>;
  on?: Partial<Record<keyof HTMLElementEventMap, (ev: any) => void>>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps | string = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (typeof props === 'string') props = { class: props };
  if (props.class) node.className = props.class;
  if (props.text !== undefined) node.textContent = props.text;
  if (props.html !== undefined) node.innerHTML = props.html;
  if (typeof props.style === 'string') node.setAttribute('style', props.style);
  else if (props.style) Object.assign(node.style, props.style);
  if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) node.setAttribute(k, v);
  if (props.on) for (const [k, fn] of Object.entries(props.on)) node.addEventListener(k, fn as EventListener);
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const nextFrame = () => new Promise<number>((r) => requestAnimationFrame(r));

/** Resolves on the next click/keypress anywhere (or after `timeoutMs`). */
export function waitForInput(timeoutMs = Infinity): Promise<void> {
  return new Promise((resolve) => {
    let timer = 0;
    const done = () => {
      window.removeEventListener('pointerdown', done, true);
      window.removeEventListener('keydown', onKey, true);
      clearTimeout(timer);
      resolve();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
      done();
    };
    window.addEventListener('pointerdown', done, true);
    window.addEventListener('keydown', onKey, true);
    if (isFinite(timeoutMs)) timer = window.setTimeout(done, timeoutMs);
  });
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** 1234567 -> "1,234,567" */
export function commas(n: number, digits = 0): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

const BIG_NAMES = [
  '', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion',
  'septillion', 'octillion', 'nonillion', 'decillion', 'undecillion', 'duodecillion',
  'tredecillion', 'quattuordecillion', 'quindecillion',
];

/** 3.5e12 -> "3.50 trillion"; small numbers get commas. */
export function bigName(n: number, digits = 2): string {
  if (!isFinite(n)) return '∞';
  if (Math.abs(n) < 1e6) return commas(Math.round(n));
  const tier = Math.floor(Math.log10(Math.abs(n)) / 3);
  if (tier >= BIG_NAMES.length) return n.toExponential(digits).replace('e+', '×10^');
  return `${(n / 10 ** (tier * 3)).toFixed(digits)} ${BIG_NAMES[tier]}`;
}

const SI = ['', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y', 'R', 'Q'];

/** 3.8e26 W -> "380 YW" style SI formatting; falls back to scientific. */
export function si(n: number, unit = '', digits = 3): string {
  if (n === 0) return `0 ${unit}`.trim();
  const tier = Math.max(0, Math.floor(Math.log10(Math.abs(n)) / 3));
  if (tier >= SI.length) return `${n.toExponential(2)} ${unit}`.trim();
  const v = n / 10 ** (tier * 3);
  return `${v.toPrecision(digits)} ${SI[tier]}${unit}`.trim();
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Minimal inline markup: **bold**, *em*, `code`. Input is escaped first. */
export function richText(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}
