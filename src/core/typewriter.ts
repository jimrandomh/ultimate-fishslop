// Reveals rich (already-escaped) HTML one character at a time, preserving markup.

import { sleep } from './dom';

export interface TypeOpts {
  /** Characters per second. */
  cps?: number;
  /** Called every few characters to play a blip. */
  sound?: () => void;
  /** Return true to finish instantly (e.g. the player clicked). */
  skip?: () => boolean;
  /** Return true to stop where we are. */
  cancelled?: () => boolean;
}

export async function typeInto(target: HTMLElement, html: string, opts: TypeOpts = {}) {
  target.innerHTML = html;
  const texts: { node: Text; full: string }[] = [];
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    texts.push({ node, full: node.data });
    node.data = '';
  }
  const cps = opts.cps ?? 45;
  const base = 1000 / cps;
  let count = 0;
  for (const t of texts) {
    for (let i = 0; i < t.full.length; i++) {
      if (opts.cancelled?.()) return;
      if (opts.skip?.()) {
        for (const r of texts) r.node.data = r.full;
        return;
      }
      const ch = t.full[i];
      t.node.data = t.full.slice(0, i + 1);
      if (ch !== ' ' && count++ % 2 === 0) opts.sound?.();
      let delay = base;
      if (ch === '.' || ch === '!' || ch === '?') delay = base * 7;
      else if (ch === ',' || ch === ';' || ch === ':' || ch === '—') delay = base * 3.5;
      // Don't pause on "..." mid-run or decimal points.
      const next = t.full[i + 1];
      if ((ch === '.' && next && next !== ' ' && next !== '\n') || next === '.') delay = base;
      await sleep(delay);
    }
  }
}
