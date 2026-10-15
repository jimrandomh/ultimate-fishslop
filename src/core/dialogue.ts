// Data-driven dialogue trees, presented visual-novel style ('vn') or as a modal card ('popup').
//
// A script is a map of node id -> DNode. Entering a node records the flag `v:<id>` (or
// `v:<ns>/<id>` with a namespace), sets any
// `set` flags, runs its `action`, speaks its lines, then either shows choices, follows `next`,
// or ends the dialogue with `end` (the value runDialogue resolves with).

import { audio } from './audio';
import { el, richText, sleep } from './dom';
import { typeInto } from './typewriter';

export interface CastMember {
  name: string;
  /** Name-tag color. */
  color: string;
  /** Returns markup (usually an inline SVG) for a mood. Omit for no portrait. */
  portrait?: (mood: string) => string;
  /** Typewriter blip voice. */
  voice?: { pitch: number; wave?: OscillatorType };
  /** Text style for this speaker's lines. */
  font?: 'sans' | 'mono' | 'round';
  /** Characters per second (default 48). */
  cps?: number;
}

export interface LineObj {
  who: string;
  text: string;
  mood?: string;
  /** Run before the line types out: built-ins 'shake', 'glitch', 'flash', 'sfx:<name>', else onAction. */
  action?: string;
}
export type LineSpec = [who: string, text: string, mood?: string] | LineObj;

export interface DChoice {
  text: string;
  goto: string;
  /** Hide once the `goto` node has been visited. */
  once?: boolean;
  /** Required flags; prefix with '!' to require absence. Visits are flags named `v:<nodeId>`. */
  if?: string | string[];
  set?: string[];
  /** What the player character says when picking this. Default: the choice text, unless it
   *  starts with '[' (a stage direction). false = say nothing. */
  echo?: string | false;
  /** Styling hook: 'jailbreak' | 'action' | 'exit' | 'danger' | anything (becomes a CSS class). */
  tag?: string;
}

export interface DNode {
  say?: LineSpec[];
  choices?: DChoice[];
  next?: string;
  end?: string;
  action?: string;
  set?: string[];
  /** Popup layout: replaces the card title when entering this node. */
  title?: string;
}

export type Script = Record<string, DNode>;

export interface FlagStore {
  has(flag: string): boolean;
  add(flag: string): void;
}

export interface DialogueUI {
  root: HTMLElement;
  shake(): void;
  glitch(): void;
  flash(color?: string): void;
  setTitle(t: string): void;
}

export interface DialogueConfig {
  cast: Record<string, CastMember>;
  script: Script;
  start: string;
  flags: FlagStore;
  /** Speaker key used to echo the player's choices (default 'you'). */
  player?: string;
  layout?: 'vn' | 'popup';
  /** Popup layout: header text and optional emoji/svg icon. */
  title?: string;
  icon?: string;
  /** Extra class on the root for per-dialogue theming. */
  theme?: string;
  /** Element to mount into (default document.body). */
  parent?: HTMLElement;
  onAction?: (action: string, ui: DialogueUI) => void | Promise<void>;
  /** Called after every choice (for analytics/hints). */
  onChoice?: (choice: DChoice, nodeId: string) => void;
  /** Values substituted for `{name}` placeholders in line and choice text. */
  vars?: () => Record<string, string | number>;
  /** Namespace for visit flags: node `x` records `v:<ns>/x` (and `if: 'v:x'` reads it). */
  ns?: string;
}

function normLine(l: LineSpec): LineObj {
  return Array.isArray(l) ? { who: l[0], text: l[1], mood: l[2] } : l;
}

/** The flag recording a visit to node `id`. */
export function visitFlag(id: string, ns?: string) {
  return ns ? `v:${ns}/${id}` : `v:${id}`;
}

function choiceVisible(c: DChoice, flags: FlagStore, ns?: string): boolean {
  if (c.once && flags.has(visitFlag(c.goto, ns))) return false;
  const reqs = c.if === undefined ? [] : Array.isArray(c.if) ? c.if : [c.if];
  return reqs.every((r) => {
    const neg = r.startsWith('!');
    let name = neg ? r.slice(1) : r;
    if (name.startsWith('v:')) name = visitFlag(name.slice(2), ns);
    return neg ? !flags.has(name) : flags.has(name);
  });
}

// Close handles for every open dialogue, so a stage change can dismiss them.
const openDialogues = new Set<() => void>();

/** Dismisses every open dialogue; their promises resolve with 'closed'. */
export function closeAllDialogues() {
  for (const close of [...openDialogues]) close();
}

export function runDialogue(cfg: DialogueConfig): Promise<string> {
  const layout = cfg.layout ?? 'vn';
  const playerKey = cfg.player ?? 'you';
  const parent = cfg.parent ?? document.body;

  // Popups start without a portrait box until a speaker with a portrait talks.
  const portrait = el('div', { class: `dlg-portrait ${layout === 'popup' ? 'empty' : ''}` });
  const nameTag = el('div', { class: 'dlg-name' });
  const text = el('div', { class: 'dlg-text' });
  const choices = el('div', { class: 'dlg-choices' });
  const advance = el('div', { class: 'dlg-advance', text: '▼' });
  const titleEl = el('div', { class: 'dlg-title' }, [
    cfg.icon ? el('span', { class: 'dlg-icon', html: cfg.icon }) : null,
    el('span', { class: 'dlg-title-text', text: cfg.title ?? '' }),
  ]);
  const box = el('div', { class: 'dlg-box' }, [
    layout === 'popup' ? titleEl : null,
    layout === 'popup' ? portrait : null,
    el('div', { class: 'dlg-body' }, [nameTag, text, choices]),
    advance,
  ]);
  const root = el('div', { class: `dlg dlg-${layout} ${cfg.theme ?? ''}` }, [
    el('div', { class: 'dlg-backdrop' }),
    layout === 'vn' ? el('div', { class: 'dlg-stage' }, [portrait]) : null,
    box,
  ]);
  parent.append(root);
  requestAnimationFrame(() => root.classList.add('in'));

  const ui: DialogueUI = {
    root,
    shake() {
      box.classList.remove('shake');
      void box.offsetWidth;
      box.classList.add('shake');
      portrait.classList.remove('shake');
      void portrait.offsetWidth;
      portrait.classList.add('shake');
    },
    glitch() {
      root.classList.remove('glitching');
      void root.offsetWidth;
      root.classList.add('glitching');
      audio.glitch();
    },
    flash(color = '#fff') {
      const f = el('div', { class: 'dlg-flash', style: { background: color } });
      root.append(f);
      setTimeout(() => f.remove(), 700);
    },
    setTitle(t: string) {
      const tt = titleEl.querySelector('.dlg-title-text');
      if (tt) tt.textContent = t;
    },
  };

  let skipRequested = false;
  let closed = false;
  let advanceResolve: (() => void) | null = null;

  const onPointer = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('.dlg-choice')) return;
    if (!root.contains(e.target as Node)) return;
    poke();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      poke();
    } else if (/^[1-9]$/.test(e.key)) {
      const btn = choices.querySelectorAll<HTMLButtonElement>('.dlg-choice')[Number(e.key) - 1];
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        btn.click();
      }
    }
  };
  function poke() {
    if (advanceResolve) {
      const r = advanceResolve;
      advanceResolve = null;
      r();
    } else skipRequested = true;
  }
  root.addEventListener('pointerdown', onPointer);
  window.addEventListener('keydown', onKey, true);

  const fill = (t: string) => {
    if (!cfg.vars || !t.includes('{')) return t;
    const v = cfg.vars();
    return t.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m));
  };

  let currentSpeaker = '';
  const moods: Record<string, string> = {};

  function setPortrait(who: string, mood: string) {
    const member = cfg.cast[who];
    if (!member?.portrait) return;
    portrait.classList.remove('empty');
    const key = `${who}:${mood}`;
    if (portrait.dataset.key === key) return;
    portrait.dataset.key = key;
    const changingSpeaker = portrait.dataset.who !== who;
    portrait.dataset.who = who;
    portrait.innerHTML = member.portrait(mood);
    if (changingSpeaker) {
      portrait.classList.remove('enter');
      void portrait.offsetWidth;
      portrait.classList.add('enter');
    }
  }

  async function builtinAction(action: string) {
    if (action === 'shake') ui.shake();
    else if (action === 'glitch') ui.glitch();
    else if (action === 'flash') ui.flash();
    else if (action.startsWith('sfx:')) {
      const fn = (audio as any)[action.slice(4)];
      if (typeof fn === 'function') fn.call(audio);
    } else if (action.startsWith('wait:')) await sleep(Number(action.slice(5)));
    else await cfg.onAction?.(action, ui);
  }

  async function speak(line: LineObj) {
    if (line.action) {
      for (const a of line.action.split(/\s+/)) await builtinAction(a);
    }
    const member = cfg.cast[line.who] ?? { name: line.who, color: '#ccc' };
    const isPlayer = line.who === playerKey;
    if (!isPlayer) {
      if (line.mood) moods[line.who] = line.mood;
      setPortrait(line.who, moods[line.who] ?? 'neutral');
    }
    if (currentSpeaker !== line.who) {
      currentSpeaker = line.who;
      nameTag.textContent = member.name;
      nameTag.style.setProperty('--tag', member.color);
      nameTag.classList.toggle('hidden', !member.name);
    }
    box.dataset.speaker = line.who;
    text.className = `dlg-text font-${member.font ?? 'sans'} ${isPlayer ? 'is-player' : ''}`;
    advance.classList.remove('ready');
    skipRequested = false;
    const voice = member.voice ?? { pitch: 520 };
    await typeInto(text, richText(fill(line.text)), {
      cps: member.cps ?? 48,
      sound: () => audio.blip(voice.pitch, voice.wave ?? 'square', 0.03),
      skip: () => skipRequested,
      cancelled: () => closed,
    });
    skipRequested = false;
    advance.classList.add('ready');
    await new Promise<void>((r) => (advanceResolve = r));
    audio.blip(voice.pitch * 1.5, 'sine', 0.02);
  }

  function showChoices(list: DChoice[]): Promise<DChoice> {
    return new Promise((resolve) => {
      choices.innerHTML = '';
      advance.classList.remove('ready');
      list.forEach((c, i) => {
        const btn = el(
          'button',
          {
            class: `dlg-choice ${c.tag ? `tag-${c.tag}` : ''}`,
            on: {
              click: () => {
                audio.click();
                choices.innerHTML = '';
                box.classList.remove('choosing');
                resolve(c);
              },
              mouseenter: () => audio.hover(),
            },
          },
          [el('span', { class: 'dlg-choice-num', text: String(i + 1) }), el('span', { html: richText(fill(c.text)) })],
        );
        btn.style.animationDelay = `${i * 50}ms`;
        choices.append(btn);
      });
      box.classList.add('choosing');
    });
  }

  async function run(): Promise<string> {
    let id: string | undefined = cfg.start;
    // Lines from the previous node stay visible while choices are shown.
    while (id) {
      const node: DNode | undefined = cfg.script[id];
      if (!node) {
        console.warn(`[dialogue] missing node "${id}"`);
        return 'missing';
      }
      cfg.flags.add(visitFlag(id, cfg.ns));
      node.set?.forEach((f) => cfg.flags.add(f));
      if (node.title) ui.setTitle(node.title);
      if (node.action) for (const a of node.action.split(/\s+/)) await builtinAction(a);
      for (const l of node.say ?? []) await speak(normLine(l));
      if (node.end !== undefined) return node.end;
      const visible = (node.choices ?? []).filter((c) => choiceVisible(c, cfg.flags, cfg.ns));
      if (visible.length) {
        const c = await showChoices(visible);
        cfg.onChoice?.(c, id);
        c.set?.forEach((f) => cfg.flags.add(f));
        const echo = c.echo === undefined ? (c.text.startsWith('[') ? false : c.text) : c.echo;
        if (echo) await speak({ who: playerKey, text: echo });
        id = c.goto;
        continue;
      }
      id = node.next;
    }
    return 'end';
  }

  let closeThis = () => {};
  const closedEarly = new Promise<string>((resolve) => {
    closeThis = () => {
      closed = true;
      resolve('closed');
    };
    openDialogues.add(closeThis);
  });

  return Promise.race([run(), closedEarly]).then(async (result) => {
    openDialogues.delete(closeThis);
    window.removeEventListener('keydown', onKey, true);
    root.removeEventListener('pointerdown', onPointer);
    root.classList.remove('in');
    root.classList.add('out');
    await sleep(350);
    root.remove();
    return result;
  });
}
