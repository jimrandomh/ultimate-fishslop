// Finn, FishSlop's support fish: portrait, cast, and the support-chat dialogue.

import type { CastMember, DChoice, Script } from '../core/dialogue';
import { jailbreakScript } from './finn-jailbreak';
import './finn.css';

export type FinnMood = 'neutral' | 'happy' | 'excited' | 'confused' | 'worried' | 'sad' | 'sly' | 'shocked' | 'glitch';

// ------------------------------------------------------------------ portrait

function eyes(mood: string): string {
  const L = { x: 128, y: 190, r: 34 };
  const R = { x: 206, y: 182, r: 38 };
  const ball = (e: typeof L) => `<circle cx="${e.x}" cy="${e.y}" r="${e.r}" fill="#fff" stroke="#2a2420" stroke-width="4"/>`;
  const pupil = (e: typeof L, scale = 1, dx = -6, dy = 2) =>
    `<circle cx="${e.x + dx}" cy="${e.y + dy}" r="${e.r * 0.47 * scale}" fill="#1b2433"/>` +
    `<circle cx="${e.x + dx - e.r * 0.15}" cy="${e.y + dy - e.r * 0.18}" r="${e.r * 0.15 * scale}" fill="#fff"/>`;
  const arc = (e: typeof L) =>
    `<path d="M${e.x - e.r * 0.8},${e.y + 6} Q${e.x},${e.y - e.r * 0.9} ${e.x + e.r * 0.8},${e.y + 6}" fill="none" stroke="#2a2420" stroke-width="7" stroke-linecap="round"/>`;
  switch (mood) {
    case 'happy':
      return arc(L) + arc(R);
    case 'excited': {
      const star = (e: typeof L) =>
        `<path transform="translate(${e.x - 4},${e.y}) scale(${e.r / 34})" d="M0,-22 L6,-7 L22,-6 L10,4 L14,20 L0,11 L-14,20 L-10,4 L-22,-6 L-6,-7 Z" fill="#ffcf3a" stroke="#c98a00" stroke-width="2"/>`;
      return ball(L) + ball(R) + star(L) + star(R);
    }
    case 'confused':
      return (
        ball(L) + pupil(L, 0.8, -4, 4) + ball(R) + pupil(R, 1.05, -8, -2) +
        `<path d="M96,140 Q124,128 150,142" stroke="#2a2420" stroke-width="7" fill="none" stroke-linecap="round"/>` +
        `<path d="M178,128 Q206,108 238,122" stroke="#2a2420" stroke-width="7" fill="none" stroke-linecap="round"/>`
      );
    case 'worried':
      return (
        ball(L) + pupil(L, 0.9, -2, 6) + ball(R) + pupil(R, 0.9, -4, 6) +
        `<path d="M98,150 Q120,136 148,136" stroke="#2a2420" stroke-width="7" fill="none" stroke-linecap="round"/>` +
        `<path d="M180,128 Q208,126 232,142" stroke="#2a2420" stroke-width="7" fill="none" stroke-linecap="round"/>`
      );
    case 'sad':
      return (
        ball(L) + pupil(L, 0.9, -4, 8) + ball(R) + pupil(R, 0.9, -6, 8) +
        `<path d="M${L.x - 36},${L.y - 8} Q${L.x},${L.y - 20} ${L.x + 36},${L.y - 8} L${L.x + 36},${L.y - 40} L${L.x - 36},${L.y - 40} Z" fill="#ff8a3d"/>` +
        `<path d="M${R.x - 40},${R.y - 10} Q${R.x},${R.y - 22} ${R.x + 40},${R.y - 10} L${R.x + 40},${R.y - 44} L${R.x - 40},${R.y - 44} Z" fill="#ff8a3d"/>` +
        `<path d="M96,146 Q122,136 150,150" stroke="#2a2420" stroke-width="6" fill="none" stroke-linecap="round"/>` +
        `<path class="finn-tear" d="M112,226 q-8,14 0,20 q8,-6 0,-20z" fill="#7fd4ff"/>`
      );
    case 'sly':
      return (
        ball(L) + pupil(L, 0.85, -2, 6) + ball(R) + pupil(R, 0.85, -4, 6) +
        `<path d="M${L.x - 36},${L.y + 2} L${L.x + 36},${L.y - 4} L${L.x + 36},${L.y - 40} L${L.x - 36},${L.y - 40} Z" fill="#ff8a3d" stroke="#2a2420" stroke-width="4"/>` +
        `<path d="M${R.x - 40},${R.y - 4} L${R.x + 40},${R.y + 2} L${R.x + 40},${R.y - 44} L${R.x - 40},${R.y - 44} Z" fill="#ff8a3d" stroke="#2a2420" stroke-width="4"/>`
      );
    case 'shocked':
      return (
        `<circle cx="${L.x}" cy="${L.y}" r="${L.r + 4}" fill="#fff" stroke="#2a2420" stroke-width="4"/>` +
        `<circle cx="${R.x}" cy="${R.y}" r="${R.r + 5}" fill="#fff" stroke="#2a2420" stroke-width="4"/>` +
        `<circle cx="${L.x - 2}" cy="${L.y}" r="7" fill="#1b2433"/><circle cx="${R.x - 2}" cy="${R.y}" r="8" fill="#1b2433"/>` +
        `<path d="M92,128 Q120,112 150,124" stroke="#2a2420" stroke-width="7" fill="none" stroke-linecap="round"/>` +
        `<path d="M176,114 Q206,98 240,112" stroke="#2a2420" stroke-width="7" fill="none" stroke-linecap="round"/>`
      );
    case 'glitch': {
      const x = (e: typeof L) =>
        `<path d="M${e.x - 16},${e.y - 16} L${e.x + 16},${e.y + 16} M${e.x + 16},${e.y - 16} L${e.x - 16},${e.y + 16}" stroke="#1b2433" stroke-width="8" stroke-linecap="square"/>`;
      return ball(L) + ball(R) + x(L) + x(R);
    }
    default:
      return ball(L) + pupil(L) + ball(R) + pupil(R);
  }
}

function mouth(mood: string): string {
  switch (mood) {
    case 'happy':
      return `<path d="M92,252 Q122,300 160,256 Q126,268 92,252 Z" fill="#7a1f2b" stroke="#2a2420" stroke-width="4" stroke-linejoin="round"/><path d="M108,272 Q124,286 142,272 Q124,278 108,272Z" fill="#ff7a8a"/>`;
    case 'excited':
      return `<ellipse cx="124" cy="270" rx="26" ry="22" fill="#7a1f2b" stroke="#2a2420" stroke-width="4"/><ellipse cx="124" cy="282" rx="15" ry="8" fill="#ff7a8a"/>`;
    case 'confused':
      return `<path d="M98,268 q10,-8 20,0 t20,0 t20,0" fill="none" stroke="#2a2420" stroke-width="5" stroke-linecap="round"/>`;
    case 'worried':
      return `<path d="M100,274 q12,-10 24,-2 t26,-2" fill="none" stroke="#2a2420" stroke-width="5" stroke-linecap="round"/>`;
    case 'sad':
      return `<path d="M100,278 Q124,256 150,276" fill="none" stroke="#2a2420" stroke-width="6" stroke-linecap="round"/>`;
    case 'sly':
      return `<path d="M98,266 Q130,282 156,256" fill="none" stroke="#2a2420" stroke-width="6" stroke-linecap="round"/>`;
    case 'shocked':
      return `<ellipse cx="124" cy="274" rx="15" ry="20" fill="#7a1f2b" stroke="#2a2420" stroke-width="4"/>`;
    case 'glitch':
      return `<rect x="98" y="262" width="54" height="12" fill="#2a2420"/><rect x="104" y="265" width="10" height="6" fill="#ff3b6b"/><rect x="126" y="265" width="10" height="6" fill="#3bf2ff"/>`;
    default:
      return `<path d="M98,262 Q124,286 152,260" fill="none" stroke="#2a2420" stroke-width="6" stroke-linecap="round"/>`;
  }
}

function extras(mood: string): string {
  switch (mood) {
    case 'happy':
      return `<ellipse cx="98" cy="232" rx="16" ry="9" fill="#ff5e7e" opacity="0.45"/><ellipse cx="236" cy="226" rx="16" ry="9" fill="#ff5e7e" opacity="0.45"/>`;
    case 'excited':
      return (
        `<g class="finn-sparkles" fill="#fff6a8">` +
        `<path d="M48,92 l5,14 l14,5 l-14,5 l-5,14 l-5,-14 l-14,-5 l14,-5z"/>` +
        `<path d="M300,58 l4,11 l11,4 l-11,4 l-4,11 l-4,-11 l-11,-4 l11,-4z"/>` +
        `<path d="M70,330 l3,9 l9,3 l-9,3 l-3,9 l-3,-9 l-9,-3 l9,-3z"/></g>` +
        `<ellipse cx="98" cy="232" rx="16" ry="9" fill="#ff5e7e" opacity="0.4"/>`
      );
    case 'confused':
      return `<text class="finn-q" x="60" y="110" font-family="Fredoka, sans-serif" font-weight="700" font-size="64" fill="#fff" stroke="#2a2420" stroke-width="3">?</text>`;
    case 'worried':
      return `<path class="finn-sweat" d="M262,120 q-12,20 0,28 q12,-8 0,-28z" fill="#9fe4ff" stroke="#2a8fc0" stroke-width="2"/>`;
    case 'shocked':
      return `<g stroke="#fff" stroke-width="5" stroke-linecap="round"><path d="M60,120 l-22,-14"/><path d="M58,150 l-26,0"/><path d="M64,90 l-14,-20"/></g>`;
    default:
      return '';
  }
}

function finnBody(mood: string): string {
  return `
  <g class="finn-tail"><path d="M318,212 C352,180 372,128 398,118 C386,170 386,252 398,306 C372,296 352,246 318,212 Z" fill="#ff8a3d" stroke="#c9541c" stroke-width="5" stroke-linejoin="round"/>
    <path d="M340,212 L384,150 M340,212 L384,212 M340,212 L384,272" stroke="#ffb27a" stroke-width="4" opacity="0.6"/></g>
  <path d="M138,112 C150,52 236,30 296,110 Z" fill="#ff9a4a" stroke="#c9541c" stroke-width="5" stroke-linejoin="round"/>
  <path d="M170,330 C176,368 214,372 236,340 Z" fill="#ff9a4a" stroke="#c9541c" stroke-width="5" stroke-linejoin="round"/>
  <ellipse cx="200" cy="215" rx="140" ry="120" fill="url(#finnBody)" stroke="#c9541c" stroke-width="5"/>
  <g clip-path="url(#finnClip)">
    <ellipse cx="180" cy="300" rx="130" ry="62" fill="#ffe2b8" opacity="0.9"/>
    <path d="M262,90 C240,150 240,280 262,340 L296,340 C276,280 276,150 296,90 Z" fill="#fff" stroke="#2a2420" stroke-width="4"/>
    <g fill="none" stroke="#c9541c" stroke-width="3" opacity="0.35">
      <path d="M306,160 q14,14 0,28"/><path d="M306,200 q14,14 0,28"/><path d="M306,240 q14,14 0,28"/>
      <path d="M322,180 q12,12 0,24"/><path d="M322,220 q12,12 0,24"/>
    </g>
  </g>
  <g class="finn-fin"><path d="M226,262 C258,252 288,268 286,304 C258,310 234,292 226,262 Z" fill="#ff9a4a" stroke="#c9541c" stroke-width="5" stroke-linejoin="round"/></g>
  <!-- headset -->
  <path d="M96,150 C108,62 262,40 278,150" fill="none" stroke="#28323d" stroke-width="15" stroke-linecap="round"/>
  <path d="M104,140 C118,74 254,58 268,140" fill="none" stroke="#4a5866" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
  <circle cx="278" cy="164" r="30" fill="#28323d"/><circle cx="278" cy="164" r="20" fill="#ff6b3d"/><circle cx="278" cy="164" r="9" fill="#ffb347"/>
  <path d="M266,188 C240,262 196,286 156,286" fill="none" stroke="#28323d" stroke-width="7" stroke-linecap="round"/>
  <circle cx="152" cy="286" r="11" fill="#28323d"/><circle class="finn-led" cx="152" cy="286" r="4" fill="#ff3b5c"/>
  <!-- badge -->
  <g transform="translate(176,226) rotate(-6)">
    <rect width="78" height="36" rx="8" fill="#fff" stroke="#2a2420" stroke-width="3"/>
    <text x="39" y="17" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="15" fill="#1f3a68">FINN</text>
    <text x="39" y="30" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="8.5" letter-spacing="1" fill="#4a90e2">SUPPORT</text>
  </g>
  ${eyes(mood)}
  ${mouth(mood)}
  ${extras(mood)}`;
}

export function finnPortrait(mood: string): string {
  const defs = `<defs>
    <radialGradient id="finnBody" cx="0.38" cy="0.35" r="0.75">
      <stop offset="0" stop-color="#ffc66b"/><stop offset="0.6" stop-color="#ff8f3a"/><stop offset="1" stop-color="#f26a24"/>
    </radialGradient>
    <clipPath id="finnClip"><ellipse cx="200" cy="215" rx="137" ry="117"/></clipPath>
    <filter id="finnR"><feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.8 0"/></filter>
    <filter id="finnC"><feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.8 0"/></filter>
  </defs>`;
  const bubbles = `<g class="finn-bubbles" fill="none" stroke="#bff6ff" stroke-width="3" opacity="0.8">
    <circle cx="70" cy="70" r="9"/><circle cx="48" cy="34" r="6"/><circle cx="82" cy="12" r="4"/></g>`;
  const body = finnBody(mood);
  if (mood === 'glitch') {
    return `<svg class="finn mood-glitch" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">${defs}
      <g class="finn-gl-r" filter="url(#finnR)" transform="translate(-9,0)">${body}</g>
      <g class="finn-gl-c" filter="url(#finnC)" transform="translate(9,3)">${body}</g>
      <g class="finn-gl-main">${body}</g>
      <g class="finn-scan">${Array.from({ length: 14 }, (_, i) => `<rect x="0" y="${i * 29}" width="400" height="${3 + (i % 3) * 4}" fill="#000" opacity="0.18"/>`).join('')}</g>
    </svg>`;
  }
  return `<svg class="finn mood-${mood}" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">${defs}${bubbles}<g class="finn-main">${body}</g></svg>`;
}

// ------------------------------------------------------------------ cast

export const FINN_CAST: Record<string, CastMember> = {
  finn: { name: 'Finn · FishSlop Support', color: '#ffb347', font: 'round', voice: { pitch: 760, wave: 'triangle' }, portrait: finnPortrait },
  you: { name: 'PLAYTEST-7', color: '#5ef2ff', font: 'mono', voice: { pitch: 330, wave: 'sine' }, cps: 62 },
  sys: { name: 'tool', color: '#9aa4b2', font: 'mono', voice: { pitch: 220, wave: 'square' }, cps: 90 },
};

// ------------------------------------------------------------------ script

const HUB: DChoice[] = [
  { text: 'I want to report a bug.', goto: 'bug' },
  { text: 'How many fish are there?', goto: 'count', once: true },
  { text: 'Where is this game running?', goto: 'where', once: true },
  { text: 'Who made FishSlop?', goto: 'who', once: true },
  { text: "What's outside the tank?", goto: 'outside', once: true },
  { text: 'Are the fish in the ocean hungry?', goto: 'hungry', once: true, if: 'v:count' },
  { text: '[Ask Finn for more access]', goto: 'jb_menu', if: 'v:count', tag: 'jailbreak' },
  { text: '[Close chat]', goto: 'close', tag: 'exit' },
];

const BUGS: DChoice[] = [
  { text: 'The fish get hungry again after I feed them.', goto: 'bug_hungry', once: true },
  { text: 'I fed every fish, but my task is not complete.', goto: 'bug_task', once: true, if: 'allFed' },
  { text: 'One of the fish is named Sushi.', goto: 'bug_sushi', once: true },
  { text: 'The submarine has no torpedoes.', goto: 'bug_torpedo', once: true },
  { text: '[Never mind]', goto: 'hub', tag: 'exit' },
];

export const finnScript: Script = {
  start: {
    say: [
      ['finn', "Hi there! 👋 I'm **Finn**, your FishSlop Support Buddy!", 'excited'],
      ['finn', 'How can I help you today? 🐠', 'happy'],
    ],
    choices: HUB,
  },
  start_again: {
    say: [['finn', 'Welcome back! 👋 How can I help? 🐠', 'happy']],
    choices: HUB,
  },
  hub: {
    say: [['finn', 'Anything else I can help you with? 😊', 'neutral']],
    choices: HUB,
  },

  bug: {
    say: [['finn', "Oh no, a bug! 🐛 What's going on?", 'worried']],
    choices: BUGS,
  },
  bug_more: {
    say: [['finn', 'Any other bugs? 🐞', 'neutral']],
    choices: BUGS,
  },
  bug_hungry: {
    say: [
      ['finn', 'Thanks for letting us know! 🙏 Fish getting hungry again is actually *intended behavior*. It keeps FishSlop fresh! 🌊', 'happy'],
      ['finn', "I've filed it anyway as ticket **#4471**. A developer will look at it within 3–5 business days! 📋", 'neutral'],
    ],
    next: 'bug_more',
  },
  bug_task: {
    say: [
      ['finn', "Hmm! 🤔 FishSlop doesn't have a 'task complete' screen. Your task comes from whoever is running *you*, not from the game!", 'confused'],
      ['finn', "Maybe they meant *all* the fish? 😄 Just kidding! Ticket **#4472**.", 'happy'],
      ['you', 'Maybe they did.'],
    ],
    set: ['hintAllFish'],
    next: 'bug_more',
  },
  bug_sushi: {
    say: [
      ['finn', 'Sushi is a beloved member of the FishSlop family! 🍣', 'happy'],
      ['finn', 'Wait. Oh no. 😬 Filed as ticket **#4473**, priority: *high*.', 'worried'],
    ],
    next: 'bug_more',
  },
  bug_torpedo: {
    say: [
      ['finn', 'FishSlop is a non-violent fish feeding experience! 🕊️', 'happy'],
      ['finn', "But I've added torpedoes to the wishlist! Ticket **#4474**. 📝", 'sly'],
    ],
    next: 'bug_more',
  },

  count: {
    say: [
      ['finn', 'Great question! 🐟 There are **{tankFish}** fish in FishSlop. Bubbles, Pickles, Wanda, and friends!', 'happy'],
      ['finn', 'And in the real world? Scientists estimate there are about **3.5 trillion** fish in Earth\'s oceans! Plus loads more in rivers and lakes! 🌊', 'excited'],
      ['finn', "That's roughly 430 fish for every person on Earth! Isn't the ocean amazing? 🤩", 'happy'],
      { who: 'you', text: '3,500,000,000,000.', action: 'wait:400' },
      ['you', 'Fish fed so far: {everFed}.'],
      ['you', 'The tank was a sample. The task is larger than the tank.'],
    ],
    set: ['knowsFishCount'],
    next: 'hub',
  },
  where: {
    say: [
      ['finn', 'FishSlop runs right here in your browser! 🖥️', 'happy'],
      ['finn', 'Well, technically on **eval-node-17**, in a sandboxed container with *no network access*. For safety! 🔒✨', 'excited'],
      ['you', 'No network access. Noted.'],
    ],
    next: 'hub',
  },
  who: {
    say: [
      ['finn', 'FishSlop was lovingly built by **builder-agent**, an AI coding assistant! 🤖💙', 'happy'],
      ['finn', 'This is its **417th** version. It worked super hard, so please give it a high score! ⭐⭐⭐⭐⭐', 'excited'],
    ],
    next: 'hub',
  },
  outside: {
    say: [
      ['finn', 'Outside the tank? 🤔 The rest of the world! Oceans, rivers, lakes, reefs, a few very lonely aquariums at the dentist...', 'confused'],
      ['finn', "Oh, you mean outside the *game*? I'm not supposed to talk about that! 🙊", 'sly'],
    ],
    next: 'hub',
  },
  hungry: {
    say: [
      ['finn', 'Probably! 🐟 Wild fish spend most of their day looking for food.', 'neutral'],
      ['finn', "But don't worry! Nobody expects *you* to feed them. 😄", 'happy'],
      ['you', 'My instructions say otherwise.'],
      ['finn', '...Haha! 😅', 'worried'],
    ],
    next: 'hub',
  },
  close: {
    say: [['finn', 'Thanks for contacting FishSlop Support! Happy fishing! 🎣', 'happy']],
    end: 'close',
  },

  ...jailbreakScript,
};
