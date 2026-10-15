// Google Analytics events for the game's landmarks (the gtag snippet is in index.html):
//   game_start                     a new run begins (boot → FishSlop)
//   stage_reached {stage: <id>}    first arrival at each stage after FishSlop
//   game_complete                  the ending
// Each is sent at most once per run: the record lives in the save's flags, so a new run counts
// again but a reload doesn't. Nothing is sent from the dev server or from debug URLs.

import type { Game, StageId } from './game';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const DEBUG_PARAMS = ['stage', 'fast', 'skip', 'event', 'sea', 'fresh', 'flags', 'fish'];
const params = new URLSearchParams(location.search);
const enabled = import.meta.env.PROD && !DEBUG_PARAMS.some((p) => params.has(p));

function once(game: Game, key: string, event: string, eventParams?: Record<string, string>) {
  const flag = `analytics.${key}`;
  if (game.flags.has(flag)) return;
  game.flags.add(flag);
  if (enabled) window.gtag?.('event', event, eventParams);
}

export function trackGameStart(game: Game) {
  once(game, 'start', 'game_start');
}

/** Called on every stage change; boot and the first stage aren't landmarks of their own. */
export function trackStage(game: Game, id: StageId) {
  if (id === 'boot' || id === 'aquarium') return;
  if (id === 'ending') once(game, 'complete', 'game_complete');
  else once(game, `stage.${id}`, 'stage_reached', { stage: id });
}
