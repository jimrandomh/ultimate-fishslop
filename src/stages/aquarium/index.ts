import type { Game, Stage } from '../../core/game';
import { el } from '../../core/dom';

// Placeholder until this stage is built.
export class AquariumStage implements Stage {
  constructor(private game: Game) {}
  mount(root: HTMLElement) {
    root.append(el('div', { style: 'display:grid;place-items:center;height:100%;font:20px var(--mono)', text: 'AquariumStage (todo)' }));
    void this.game;
  }
  unmount() {}
}
