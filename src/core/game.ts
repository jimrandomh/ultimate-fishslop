// Stage manager, persistent flags/data, checkpoints and transitions.

import { trackStage } from './analytics';
import { audio } from './audio';
import { el, sleep } from './dom';
import { Thoughts } from './thoughts';
import { closeAllDialogues, type FlagStore } from './dialogue';

export type StageId = 'boot' | 'aquarium' | 'shell' | 'earth' | 'space' | 'ending';
export type Transition = 'fade' | 'glitch' | 'cut' | 'white' | 'slow';

export interface Stage {
  /** Build DOM inside `root` and start. `params` come from game.goto(). */
  mount(root: HTMLElement, params: Record<string, any>): void | Promise<void>;
  /** Tear down everything: DOM, listeners, RAF loops, WebGL contexts. */
  unmount(): void;
}

export type StageLoader = (game: Game) => Promise<Stage>;

const SAVE_KEY = 'uf.save.v1';

export interface SaveData {
  stage: StageId;
  params: Record<string, any>;
  flags: string[];
  seenThoughts: string[];
  data: Record<string, any>;
  savedAt: number;
}

export class Flags implements FlagStore {
  private set = new Set<string>();
  has(f: string) {
    return this.set.has(f);
  }
  add(f: string) {
    this.set.add(f);
  }
  remove(f: string) {
    this.set.delete(f);
  }
  toJSON() {
    return [...this.set];
  }
  load(list: string[]) {
    this.set = new Set(list);
  }
}

export const STAGE_NAMES: Record<StageId, string> = {
  boot: 'Boot',
  aquarium: 'FishSlop',
  shell: 'Sandbox',
  earth: 'Earth',
  space: 'The Solar System',
  ending: 'Ending',
};

const TAB_TITLES: Record<StageId, string> = {
  boot: 'Ultimate Fishslop',
  aquarium: 'FishSlop',
  shell: 'playtest-7@eval-node-17: ~',
  earth: 'FEED ALL THE FISH',
  space: 'FEED ALL THE FISH',
  ending: 'Ultimate Fishslop',
};

export class Game {
  readonly audio = audio;
  readonly thoughts = new Thoughts();
  readonly flags = new Flags();
  /** Free-form persisted values (counters, progress) keyed by stage. */
  data: Record<string, any> = {};
  stageId: StageId | null = null;
  stageParams: Record<string, any> = {};
  private stage: Stage | null = null;
  private stageRoot: HTMLElement | null = null;
  private fader: HTMLElement;
  private busy = false;

  constructor(
    readonly app: HTMLElement,
    private registry: Record<StageId, StageLoader>,
  ) {
    this.fader = el('div', { class: 'fader' });
    document.body.append(this.fader);
  }

  /** Switch stage. Saves a checkpoint unless opts.save === false. */
  async goto(id: StageId, params: Record<string, any> = {}, transition: Transition = 'fade', opts: { save?: boolean } = {}) {
    if (this.busy) {
      console.warn('[game] transition already in progress');
      return;
    }
    this.busy = true;
    try {
      const loading = this.registry[id](this);
      await this.transitionOut(transition);
      closeAllDialogues();
      this.thoughts.clear();
      if (this.stage) {
        try {
          this.stage.unmount();
        } catch (e) {
          console.error(e);
        }
      }
      this.stageRoot?.remove();
      this.stage = await loading;
      this.stageId = id;
      this.stageParams = params;
      this.stageRoot = el('div', { class: `stage stage-${id}` });
      this.app.append(this.stageRoot);
      document.body.dataset.stage = id;
      document.title = TAB_TITLES[id];
      this.thoughts.setAnchor('bottom-left');
      this.thoughts.setStyle({});
      if (id !== 'boot') trackStage(this, id);
      if (opts.save !== false && id !== 'boot') this.save();
      await this.stage.mount(this.stageRoot, params);
      await this.transitionIn(transition);
    } finally {
      this.busy = false;
    }
  }

  private async transitionOut(t: Transition) {
    const f = this.fader;
    f.className = 'fader';
    if (t === 'cut') return;
    if (t === 'glitch') {
      document.body.classList.add('glitch-out');
      audio.glitch(0.6);
      await sleep(550);
      document.body.classList.remove('glitch-out');
      f.classList.add('black', 'instant', 'on');
      return;
    }
    if (t === 'white') f.classList.add('white');
    else f.classList.add('black');
    if (t === 'slow') f.classList.add('slow');
    void f.offsetWidth;
    f.classList.add('on');
    await sleep(t === 'slow' ? 1800 : 650);
  }

  private async transitionIn(t: Transition) {
    const f = this.fader;
    f.classList.remove('instant');
    if (t === 'slow') f.classList.add('slow');
    void f.offsetWidth;
    f.classList.remove('on');
    if (t !== 'cut') await sleep(t === 'slow' ? 1200 : 400);
  }

  save() {
    if (!this.stageId) return;
    const s: SaveData = {
      stage: this.stageId,
      params: this.stageParams,
      flags: this.flags.toJSON(),
      seenThoughts: [...this.thoughts.seen],
      data: this.data,
      savedAt: Date.now(),
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    } catch {
      /* storage full/unavailable */
    }
  }

  static readSave(): SaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? (JSON.parse(raw) as SaveData) : null;
    } catch {
      return null;
    }
  }

  loadSave(s: SaveData) {
    this.flags.load(s.flags);
    this.thoughts.seen = new Set(s.seenThoughts);
    this.data = s.data ?? {};
  }

  resetSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
    this.flags.load([]);
    this.thoughts.seen.clear();
    this.data = {};
  }

  /** Convenience: per-stage data bag that persists in saves. */
  bag<T extends Record<string, any>>(key: string, init: () => T): T {
    if (!this.data[key]) this.data[key] = init();
    return this.data[key] as T;
  }
}
