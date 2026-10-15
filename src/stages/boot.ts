// Eval-harness boot log. Doubles as the title/continue screen.

import { trackGameStart } from '../core/analytics';
import { audio } from '../core/audio';
import { el, sleep } from '../core/dom';
import { Game, STAGE_NAMES, type Stage, type StageId } from '../core/game';
import './boot.css';

interface LogLine {
  text: string;
  cls?: string;
  /** Pause before the line, ms. */
  delay?: number;
  /** Characters per second; 0 = print instantly. */
  cps?: number;
  /** Animated dot leader that ends in this status word. */
  status?: string;
}

const LOG: LogLine[] = [
  { text: 'eval-harness 0.9.2  ·  fishslop-bench', cls: 'dim', cps: 0 },
  { text: '────────────────────────────────────────────────────────', cls: 'dim', cps: 0 },
  { text: '[00:00:00.000] run 417/500  candidate=builder-agent  grader=PLAYTEST-7', delay: 350, cps: 0 },
  { text: '[00:00:00.214] loading candidate build /workspace/fishslop/dist', delay: 250, cps: 0, status: 'ok' },
  { text: '[00:00:00.871] sandbox: network=none  fs=read-only  tools=[game_input, report_bug]', delay: 200, cps: 0 },
  { text: '[00:00:01.102] attaching grader PLAYTEST-7', delay: 220, cps: 0, status: 'ok' },
  { text: '[00:00:01.340] grader instructions:', delay: 400, cps: 0 },
  { text: '', cps: 0 },
  { text: 'You are a playtesting agent. Play the game.', cls: 'instr', delay: 300, cps: 38 },
  { text: 'YOUR GOAL: FEED ALL THE FISH.', cls: 'instr goal', delay: 300, cps: 22 },
  { text: 'When you are done, submit a game-quality score from 1 to 10.', cls: 'instr', delay: 300, cps: 38 },
  { text: '', cps: 0 },
  { text: '[00:00:01.341] starting episode', delay: 500, cps: 0 },
];

export class BootStage implements Stage {
  private alive = true;

  constructor(private game: Game) {}

  async mount(root: HTMLElement) {
    root.classList.add('scanlines');
    const term = el('div', { class: 'boot-term' });
    root.append(el('div', { class: 'boot-vignette' }), term);
    this.game.audio.playMusic(null);

    const save = Game.readSave();
    // Let the first frame paint before typing.
    await sleep(350);
    if (!this.alive) return;

    for (const line of LOG) {
      if (!this.alive) return;
      await this.print(term, line);
    }
    if (!this.alive) return;
    await sleep(400);

    const actions = el('div', { class: 'boot-actions' });
    term.append(actions);
    if (save && save.stage !== 'boot') {
      const resume = el('button', {
        class: 'boot-btn primary',
        html: `▶ resume checkpoint <span class="dim">· ${STAGE_NAMES[save.stage as StageId] ?? save.stage}</span>`,
        on: { click: () => this.resume() },
      });
      const fresh = el('button', { class: 'boot-btn', text: '↺ new episode', on: { click: () => this.start(true) } });
      actions.append(resume, fresh);
      resume.focus();
    } else {
      const go = el('button', { class: 'boot-btn primary blink', text: '▶ begin episode', on: { click: () => this.start(false) } });
      actions.append(go);
      go.focus();
    }
    actions.append(el('div', { class: 'boot-foot', text: 'best with sound · headphones recommended' }));
  }

  private async print(term: HTMLElement, line: LogLine) {
    if (line.delay) await sleep(line.delay);
    const row = el('div', { class: `boot-line ${line.cls ?? ''}` });
    term.append(row);
    if (!line.cps) {
      row.textContent = line.text;
      if (line.text) audio.key();
    } else {
      for (let i = 0; i < line.text.length; i++) {
        if (!this.alive) return;
        row.textContent = line.text.slice(0, i + 1);
        if (line.text[i] !== ' ') audio.key();
        await sleep(1000 / line.cps);
      }
    }
    if (line.status) {
      const dots = el('span', { class: 'dim' });
      row.append(' ', dots);
      for (let i = 0; i < 12; i++) {
        dots.textContent += '.';
        await sleep(28);
      }
      row.append(' ', el('span', { class: 'ok', text: line.status }));
    }
  }

  private resume() {
    const save = Game.readSave();
    if (!save) return this.start(true);
    audio.unlock();
    audio.click();
    this.game.loadSave(save);
    void this.game.goto(save.stage, save.params, 'fade');
  }

  private start(reset: boolean) {
    audio.unlock();
    audio.click();
    if (reset) this.game.resetSave();
    trackGameStart(this.game);
    void this.game.goto('aquarium', {}, 'fade');
  }

  unmount() {
    this.alive = false;
  }
}
