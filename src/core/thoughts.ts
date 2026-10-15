// PLAYTEST-7's internal monologue: small typed-out cards that float over every stage.

import { audio } from './audio';
import { el, richText, sleep } from './dom';
import { typeInto } from './typewriter';

export type ThoughtKind = 'thought' | 'hint' | 'alert' | 'system';
export type ThoughtAnchor = 'bottom-left' | 'top-left' | 'bottom-right' | 'top-right' | 'bottom-center';

export interface ThoughtOpts {
  kind?: ThoughtKind;
  /** ms to keep the card up after typing finishes (default scales with length). */
  hold?: number;
  /** Show only once per save: later calls with the same key are ignored. */
  once?: string;
  /** Delay before showing, ms. */
  delay?: number;
}

interface Queued {
  text: string;
  opts: ThoughtOpts;
  resolve: () => void;
}

const LABELS: Record<ThoughtKind, string> = {
  thought: 'PLAYTEST-7',
  hint: 'PLAYTEST-7 · plan',
  alert: 'PLAYTEST-7 · !',
  system: 'eval-harness',
};

export class Thoughts {
  readonly root: HTMLElement;
  private queue: Queued[] = [];
  private running = false;
  private generation = 0;
  seen = new Set<string>();
  history: { text: string; kind: ThoughtKind }[] = [];
  private listeners = new Set<(text: string, kind: ThoughtKind) => void>();

  constructor() {
    this.root = el('div', { class: 'thoughts anchor-bottom-left', attrs: { 'aria-live': 'polite' } });
    document.body.append(this.root);
  }

  setAnchor(a: ThoughtAnchor) {
    this.root.className = `thoughts anchor-${a}`;
  }

  /** Extra CSS hook so stages can restyle (e.g. offset from a sidebar). */
  setStyle(style: Partial<CSSStyleDeclaration>) {
    this.root.removeAttribute('style');
    Object.assign(this.root.style, style);
  }

  onThought(fn: (text: string, kind: ThoughtKind) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Queue a thought. Resolves once it has finished typing (not when it fades). */
  show(text: string, opts: ThoughtOpts = {}): Promise<void> {
    if (opts.once) {
      if (this.seen.has(opts.once)) return Promise.resolve();
      this.seen.add(opts.once);
    }
    return new Promise((resolve) => {
      this.queue.push({ text, opts, resolve });
      if (!this.running) void this.pump();
    });
  }

  /** True if anything is queued or typing. */
  get busy() {
    return this.running || this.queue.length > 0;
  }

  /** Removes all cards and drops anything queued. */
  clear() {
    this.generation++;
    for (const q of this.queue) q.resolve();
    this.queue = [];
    this.running = false;
    for (const c of Array.from(this.root.children)) {
      c.classList.add('leaving');
      setTimeout(() => c.remove(), 400);
    }
  }

  private async pump() {
    this.running = true;
    const gen = this.generation;
    while (this.queue.length && gen === this.generation) {
      const item = this.queue.shift()!;
      if (item.opts.delay) await sleep(item.opts.delay);
      if (gen !== this.generation) break;
      await this.display(item, gen);
      item.resolve();
    }
    if (gen === this.generation) this.running = false;
  }

  private async display(item: Queued, gen: number) {
    const kind = item.opts.kind ?? 'thought';
    this.history.push({ text: item.text, kind });
    this.listeners.forEach((fn) => fn(item.text, kind));
    const body = el('div', { class: 'thought-text' });
    const card = el('div', { class: `thought kind-${kind}` }, [
      el('div', { class: 'thought-label' }, [el('span', { class: 'thought-glyph', text: kind === 'system' ? '▸' : '◆' }), LABELS[kind]]),
      body,
    ]);
    this.root.append(card);
    // Keep at most 3 cards on screen.
    const cards = Array.from(this.root.querySelectorAll('.thought:not(.leaving)'));
    for (const old of cards.slice(0, Math.max(0, cards.length - 3))) this.dismiss(old as HTMLElement);
    requestAnimationFrame(() => card.classList.add('in'));
    if (kind === 'alert') audio.notify();
    await typeInto(body, richText(item.text), {
      cps: 55,
      sound: () => audio.blip(kind === 'system' ? 300 : 740, 'sine', 0.018),
      cancelled: () => gen !== this.generation,
    });
    const hold = item.opts.hold ?? 2600 + item.text.length * 38;
    setTimeout(() => this.dismiss(card), hold);
    // Small gap so consecutive thoughts read as separate beats.
    await sleep(Math.min(1400, 500 + item.text.length * 8));
  }

  private dismiss(card: HTMLElement) {
    if (card.classList.contains('leaving')) return;
    card.classList.add('leaving');
    setTimeout(() => card.remove(), 500);
  }
}
