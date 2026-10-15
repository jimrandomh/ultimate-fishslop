import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import './styles/base.css';
import './styles/dialogue.css';

import { audio } from './core/audio';
import { el } from './core/dom';
import { Game, type StageId, type StageLoader } from './core/game';

const registry: Record<StageId, StageLoader> = {
  boot: (g) => import('./stages/boot').then((m) => new m.BootStage(g)),
  aquarium: (g) => import('./stages/aquarium').then((m) => new m.AquariumStage(g)),
  shell: (g) => import('./stages/shell').then((m) => new m.ShellStage(g)),
  earth: (g) => import('./stages/earth').then((m) => new m.EarthStage(g)),
  space: (g) => import('./stages/space').then((m) => new m.SpaceStage(g)),
  ending: (g) => import('./stages/ending').then((m) => new m.EndingStage(g)),
};

const game = new Game(document.getElementById('app')!, registry);
(window as any).game = game;

// ------------------------------------------------------------------ audio control

function audioWidget() {
  const icon = el('span', { class: 'audio-icon' });
  const music = el('input', { attrs: { type: 'range', min: '0', max: '1', step: '0.05', 'aria-label': 'Music volume' } });
  const sfx = el('input', { attrs: { type: 'range', min: '0', max: '1', step: '0.05', 'aria-label': 'Sound effects volume' } });
  const btn = el('button', { class: 'audio-btn', attrs: { title: 'Sound (M)' }, on: { click: () => audio.toggleMute() } }, [icon]);
  const panel = el('div', { class: 'audio-panel' }, [
    el('label', {}, ['Music', music]),
    el('label', {}, ['Sound', sfx]),
  ]);
  const root = el('div', { class: 'audio-widget' }, [panel, btn]);
  const sync = () => {
    icon.textContent = audio.prefs.muted ? '🔇' : '🔊';
    music.value = String(audio.prefs.music);
    sfx.value = String(audio.prefs.sfx);
  };
  music.addEventListener('input', () => audio.setPrefs({ music: Number(music.value), muted: false }));
  sfx.addEventListener('input', () => {
    audio.setPrefs({ sfx: Number(sfx.value), muted: false });
    audio.tick();
  });
  audio.onChange(sync);
  sync();
  document.body.append(root);
  window.addEventListener('keydown', (e) => {
    if ((e.key === 'm' || e.key === 'M') && !isTyping(e)) audio.toggleMute();
  });
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement;
  return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable || document.body.dataset.stage === 'shell';
}

audioWidget();

// Scale overlay UI up on large viewports (CSS `zoom: var(--ui)` in the stylesheets).
function updateUiScale() {
  const s = Math.min(window.innerWidth / 1440, window.innerHeight / 860);
  document.documentElement.style.setProperty('--ui', String(Math.max(1, Math.min(2.4, s)).toFixed(3)));
}
updateUiScale();
window.addEventListener('resize', updateUiScale);

// ------------------------------------------------------------------ start

const url = new URLSearchParams(location.search);
const jump = url.get('stage') as StageId | null;
if (jump && jump in registry) {
  // Debug entry point: ?stage=earth (optionally &fish=200 etc. passed as params).
  const params: Record<string, any> = {};
  url.forEach((v, k) => {
    if (k !== 'stage') params[k] = isNaN(Number(v)) ? v : Number(v);
  });
  for (const f of url.get('flags')?.split(',') ?? []) game.flags.add(f);
  void game.goto(jump, params, 'cut', { save: false });
} else {
  void game.goto('boot', {}, 'cut');
}
