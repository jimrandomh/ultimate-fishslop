import type { Game, Stage } from '../core/game';
import { el } from '../core/dom';

// Placeholder until this stage is built.
export class BootStage implements Stage {
  constructor(private game: Game) {}
  mount(root: HTMLElement) {
    root.append(el('div', { style: 'display:grid;place-items:center;height:100%;font:20px var(--mono)', text: 'BootStage (todo)' }));
    void this.game;
  }
  unmount() {}
}
