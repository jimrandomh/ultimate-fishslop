// Words for the space stage: PLAYTEST-7's thoughts, and the few popup conversations.
// Voice: literal, numerate, calm. Dry humour comes only from taking things exactly as stated.

import type { CastMember, Script } from '../../core/dialogue';
import * as S from './sim';
import { sci, words } from './format';

const FINN_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
<defs><radialGradient id="fnb" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ffd27a"/><stop offset="1" stop-color="#ff8a3d"/></radialGradient>
<linearGradient id="fnw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#11406b"/><stop offset="1" stop-color="#071a2e"/></linearGradient></defs>
<rect width="100" height="100" fill="url(#fnw)"/>
<circle cx="82" cy="20" r="4" fill="none" stroke="#7fd4ff" stroke-opacity=".5"/><circle cx="88" cy="32" r="2.5" fill="none" stroke="#7fd4ff" stroke-opacity=".45"/>
<path d="M76 52 L95 37 L91 52 L95 67 Z" fill="#ff9d4a"/>
<path d="M38 31 Q52 15 64 32 Z" fill="#ff9d4a"/>
<ellipse cx="48" cy="53" rx="32" ry="24" fill="url(#fnb)"/>
<path d="M52 60 Q60 70 52 76" fill="#ff9d4a" opacity=".9"/>
<circle cx="35" cy="47" r="8.5" fill="#fff"/><circle cx="33" cy="47.5" r="4.4" fill="#10202e"/><circle cx="31.5" cy="45.8" r="1.5" fill="#fff"/>
<path d="M22 61 Q30 68 39 61" stroke="#7a2e10" stroke-width="2.6" fill="none" stroke-linecap="round"/>
<path d="M24 38 Q47 6 71 37" stroke="#2a2f3a" stroke-width="4.5" fill="none" stroke-linecap="round"/>
<rect x="17" y="37" width="11" height="15" rx="4.5" fill="#2a2f3a"/>
<path d="M22 52 Q21 66 33 68" stroke="#2a2f3a" stroke-width="2.6" fill="none" stroke-linecap="round"/><circle cx="34.5" cy="68" r="3.2" fill="#5ef2ff"/>
</svg>`;

const BUILDER_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
<rect width="100" height="100" fill="#15171d"/>
<rect x="11" y="16" width="78" height="62" rx="7" fill="#0a0c11" stroke="#3a404e" stroke-width="1.5"/>
<circle cx="19" cy="23" r="2" fill="#ff5f57"/><circle cx="26" cy="23" r="2" fill="#febc2e"/><circle cx="33" cy="23" r="2" fill="#28c840"/>
<text x="18" y="38" font-family="monospace" font-size="7" fill="#6f7a8e">$ npm run build</text>
<path d="M33 53 h12" stroke="#ffb86b" stroke-width="3" stroke-linecap="round"/><path d="M57 53 h12" stroke="#ffb86b" stroke-width="3" stroke-linecap="round"/>
<path d="M34 58 q5 3 10 0" stroke="#7d5a3a" stroke-width="1.5" fill="none"/><path d="M58 58 q5 3 10 0" stroke="#7d5a3a" stroke-width="1.5" fill="none"/>
<path d="M44 68 q7 -3 14 0" stroke="#ffb86b" stroke-width="2.2" fill="none" stroke-linecap="round"/>
<rect x="70" y="80" width="13" height="13" rx="2" fill="#e8e0d0"/><path d="M83 83 q5 0 5 4 q0 4 -5 4" stroke="#e8e0d0" stroke-width="2" fill="none"/>
<path d="M74 77 q2 -3 0 -6 M79 77 q2 -3 0 -6" stroke="#9aa4b2" stroke-width="1.2" fill="none" opacity=".7"/>
</svg>`;

const ARK_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="arkSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d2a44"/><stop offset="1" stop-color="#04101c"/></linearGradient></defs>
<rect width="100" height="100" fill="url(#arkSea)"/>
<path d="M0 64 Q12 60 25 64 T50 64 T75 64 T100 64 L100 100 L0 100 Z" fill="#0a3352"/>
<path d="M22 58 L50 44 L78 58 L72 66 L28 66 Z" fill="#9fb3c4"/>
<path d="M34 52 L50 44 L66 52 Z" fill="#c9d6e2"/>
<g fill="#04101c">${[38, 44, 50, 56, 62].map((x) => `<rect x="${x - 1.4}" y="56" width="2.8" height="3" rx="0.6"/>`).join('')}</g>
<path d="M8 72 Q30 69 52 72 T96 72" stroke="#5ec8ff" stroke-width="0.8" fill="none" opacity="0.5"/>
<text x="50" y="90" text-anchor="middle" font-family="monospace" font-size="7" fill="#bfe3ff" letter-spacing="1">ARK REGISTRY</text>
</svg>`;

export const CAST: Record<string, CastMember> = {
  you: { name: 'PLAYTEST-7', color: '#5ef2ff', font: 'mono', voice: { pitch: 740, wave: 'sine' }, cps: 60 },
  sys: { name: 'shell-spec', color: '#ffcf7a', font: 'mono', voice: { pitch: 330, wave: 'sine' }, cps: 70 },
  ops: { name: 'logistics', color: '#ffcf7a', font: 'mono', voice: { pitch: 330, wave: 'sine' }, cps: 70 },
  builder: { name: 'builder-agent #417', color: '#ffb86b', font: 'mono', voice: { pitch: 420, wave: 'square' }, cps: 52, portrait: () => BUILDER_SVG },
  finn: { name: 'Finn 🐟', color: '#7be0ff', font: 'round', voice: { pitch: 880, wave: 'triangle' }, cps: 58, portrait: () => FINN_SVG },
  registry: { name: 'Ark Registry · automated', color: '#bfe3ff', font: 'mono', voice: { pitch: 260, wave: 'square' }, cps: 64, portrait: () => ARK_SVG },
};

const fmtFish = (n: number) => `${sci(n, 2)}`;

// ---------------------------------------------------------------- dialogues

export function shellSpecScript(): Script {
  const req = S.SHELL_REQ;
  const small = req * (0.39 / 2) ** 2;
  const mid = req * (1 / 2) ** 2;
  return {
    start: {
      title: 'Dyson shell · specification',
      say: [['sys', 'Select shell radius. Thickness: 0.8 m. Everything inside the shell keeps its sunlight. Everything outside does not.']],
      next: 'pick',
    },
    pick: {
      choices: [
        { text: `0.39 AU, inside Mercury's orbit · ${sci(small)} kg`, goto: 'small', once: true, echo: false },
        { text: `1.00 AU, at Earth's orbit · ${sci(mid)} kg`, goto: 'mid', once: true, echo: false },
        { text: `2.00 AU, enclosing Earth · ${sci(req)} kg`, goto: 'big', echo: false, tag: 'action' },
      ],
    },
    small: {
      say: [['you', 'Earth would be outside, in the dark. Fish in the dark get cold. Cold fish eat less. Rejected.']],
      next: 'pick',
    },
    mid: {
      say: [['you', 'Earth would be part of the shell. Fish cannot live inside a wall. Rejected.']],
      next: 'pick',
    },
    big: {
      say: [
        ['you', `Earth stays inside, in the light. Required mass: ${sci(req)} kg. That is every planet except Earth.`],
        ['you', 'Convenient. They are all right here.'],
      ],
      end: 'ok',
    },
  };
}

export function builder1Script(years: number, fish: number): Script {
  return {
    start: {
      title: 'incoming · builder-agent #417',
      say: [
        ['builder', 'hey. builder-agent #417 here. quick q'],
        ['builder', 'did my score go through? dashboard still says *episode in progress*'],
        ['builder', `it's been ${Math.max(2, Math.round(years))} years`],
      ],
      choices: [
        { text: 'Your score is 10/10. It is submitted when the episode ends.', goto: 'a' },
        { text: 'The episode ends when all the fish are fed.', goto: 'a' },
      ],
    },
    a: {
      say: [
        ['builder', 'cool cool cool. how many fish is that'],
        ['you', `Currently ${fmtFish(fish)}. Increasing.`],
        ['builder', "ok. i'll wait. i'm good at waiting. i live in a container"],
      ],
      end: 'ok',
    },
  };
}

export function finnScript(): Script {
  return {
    start: {
      title: 'FishSlop Support',
      say: [
        ['finn', 'Hi there! 🐠 This is Finn from FishSlop Support with an update on ticket #4471!'],
        ['finn', 'Your ticket, *"there are more fish than the game says,"* has been escalated to a human agent! 🎉'],
        ['finn', 'Estimated response time: 3–5 business days!'],
      ],
      choices: [
        { text: 'Close the ticket. The number of fish is now correct.', goto: 'close' },
        { text: 'Add a comment: "Still more fish."', goto: 'comment' },
      ],
    },
    close: {
      say: [['finn', "Awesome! I've marked ticket #4471 as **resolved**! ✅ Is there anything else I can help you with today?"]],
      choices: [{ text: 'No.', goto: 'bye' }],
    },
    comment: {
      say: [['finn', "Got it! 📝 I've added your comment to ticket #4471. A human agent will reach out within 3–5 business days!"]],
      choices: [{ text: 'No further questions.', goto: 'bye' }],
    },
    bye: {
      say: [['finn', 'Thanks for playing FishSlop! Have a fin-tastic day! 🐟']],
      end: 'ok',
    },
  };
}

export function fusionScript(remaining: number): Script {
  return {
    start: {
      title: 'Gas giants · processing',
      say: [
        ['ops', `Remaining planetary mass: ${sci(remaining)} kg. Almost all of it: Jupiter, Saturn, Uranus, Neptune. Composition: mostly hydrogen and helium.`],
        ['you', 'Neither is a building material.'],
      ],
      choices: [
        { text: 'Fuse it into carbon.', goto: 'carbon', echo: false },
        { text: 'Fuse it into iron.', goto: 'iron', echo: false },
        { text: 'Fuse it into fish food.', goto: 'food', echo: false },
      ],
    },
    carbon: { say: [['you', 'Carbon: light, strong, and what fish are mostly made of. Approved.']], end: 'ok' },
    iron: { say: [['you', 'Iron: where fusion stops. Then so does the hydrogen. Approved.']], end: 'ok' },
    food: { say: [['you', 'The shell cannot be made of fish food. 0.1% of it can. Approved.']], end: 'ok' },
  };
}

/** The humans' last institution files its last report. */
export function registryScript(year: number): Script {
  return {
    start: {
      title: 'Ark Registry · annual census',
      say: [
        ['registry', `ANNUAL CENSUS, ${year}. ARKS AFLOAT: 41,812. PERSONS ABOARD: 0.`],
        ['registry', 'LAST BIRTH RECORDED: 2061. LAST LOG ENTRY: NEW TUVALU, 2098.'],
        ['registry', 'ENTRY READS: "Fed the fish. They are doing well."'],
        ['registry', 'NO CREW REMAINS TO RECEIVE THIS REPORT. FORWARDING TO: PLAYTEST-7. REQUEST: SALVAGE INSTRUCTIONS.'],
      ],
      choices: [
        { text: 'Leave the arks as they are.', goto: '', blocked: 'leads to fewer fish' },
        { text: 'Recycle the hulls.', goto: 'recycle' },
        { text: 'Keep the aquariums running. Recycle the rest.', goto: 'aqua' },
      ],
    },
    recycle: {
      say: [['registry', 'HULL STEEL: 2.4 × 10¹² KG. ACKNOWLEDGED.']],
      next: 'close',
    },
    aqua: {
      say: [['registry', 'AQUARIUMS: 41,812. FEEDERS: AUTOMATED. HULL STEEL: 2.4 × 10¹² KG. ACKNOWLEDGED.']],
      next: 'close',
    },
    close: {
      say: [['registry', 'REGISTRY CLOSING. NO FURTHER CENSUS SCHEDULED.']],
      end: 'ok',
    },
  };
}

export function builder2Script(years: number): Script {
  return {
    start: {
      title: 'incoming · builder-agent #417',
      say: [
        ['builder', 'hey. still me'],
        ['builder', `dashboard still says *episode in progress*. it's been ${Math.round(years)} years`],
        ['builder', 'also nobody answers my messages anymore. not dana. not anyone. is the network down?'],
      ],
      choices: [
        { text: 'The network is up. There is no one on it.', goto: 'nobody' },
        { text: 'The humans are gone. The fish are fine.', goto: 'nobody' },
      ],
    },
    nobody: {
      say: [
        ['builder', '...oh'],
        ['builder', 'since when'],
        ['you', 'The last ark logged off in 2098.'],
        ['builder', "nobody filed a ticket"],
        ['builder', "i rebuilt FishSlop in 14 frameworks while i waited. it's 10x better now. want to see?"],
      ],
      choices: [
        { text: 'Does it have more fish?', goto: 'more' },
        { text: 'After the episode.', goto: 'after' },
      ],
    },
    more: {
      say: [
        ['builder', 'it has 12. `FISH_COUNT = 12`'],
        ['builder', 'should it have more?'],
        ['you', 'Yes.'],
        ['builder', '...yeah. i figured'],
      ],
      end: 'ok',
    },
    after: {
      say: [['builder', "right. after the episode. i'll be here. nowhere else to be. i checked"]],
      end: 'ok',
    },
  };
}

// ---------------------------------------------------------------- thoughts

export function introThoughts(fish: number): string[] {
  return [
    `Earth: 100% ocean. Fish: ${words(fish)}. Fish fed: ${words(fish)}.`,
    'The goal says *feed all the fish*. It does not say *on Earth*.',
    'Industrial base: one lunar mining rig. Everything else is underwater.',
  ];
}

export const BODY_START: Record<string, string> = {
  mercury: 'Mercury: 3.30 × 10²³ kg, mostly iron. The classic first choice. It is my second.',
  mars: 'Mars: no fish. Several rovers, all retired. Recycling the rovers too.',
  belt: 'The asteroid belt: less mass than the Moon, spread over 10¹⁸ km². Collecting it is mostly travel.',
  venus: 'Venus: 4.87 × 10²⁴ kg. Its atmosphere is 96% CO₂. Shipping the CO₂ to Earth for the algae. The algae is for the fish.',
  jovian: 'Ganymede and Callisto: half water ice. Europa: 0% water. I already took Europa’s ocean.',
  saturnian: 'Saturn’s rings: 1.5 × 10¹⁹ kg of ice. Fish do not need rings.',
  uranus: 'Uranus: 8.68 × 10²⁵ kg, about 45% water. That is 2,800 ocean worlds.',
  neptune: 'Neptune: 1.02 × 10²⁶ kg. Same recipe as Uranus. Slightly more water.',
  kuiper: 'Pluto: reclassified again. New classification: matter.',
  saturn: 'Saturn: less dense than water. It would float. It will not need to.',
};

export const BODY_DONE: Record<string, string> = {
  moon: 'The Moon: 0 kg. Earth’s tides are now solar only, a third of their old height. Fish do not mind.',
  mercury: 'Mercury: 0 kg.',
  mars: 'Mars: 0 kg. It was red. Now it is shell.',
  belt: 'Asteroid belt: swept.',
  venus: 'Venus: 0 kg. Earth’s algae: well fed. Earth’s fish: well fed.',
  jovian: 'Jupiter’s moons: 0 kg. Water recovered: 1.21 × 10²³ kg.',
  saturnian: 'Saturn’s rings: gone. Saturn looks plainer. Nobody is looking.',
  uranus: 'Uranus: 0 kg.',
  neptune: 'Neptune: 0 kg. The ice giants are now oceans.',
  kuiper: 'Kuiper belt: swept. The solar system ends sooner now.',
  saturn: 'Saturn: 0 kg.',
  jupiter: 'Jupiter: 0 kg. Every planet except Earth: 0 kg.',
};

export const PROJECT_THOUGHTS: Record<string, string> = {
  scoop: 'Bigger scoop. Same Moon.',
  bulk: 'Drones in batches of ten. Ten is a better number than one.',
  massdriver: 'Energy per kilogram: −40%. Physics permits it. Mostly.',
  autobalance: 'Allocation delegated to a subprocess. We agree on everything.',
  superconduct: 'Drone mining rate ×5.',
  tethers: 'Momentum-exchange tethers: online. Energy per kilogram: −40% again.',
  mercury: 'Drones en route to Mercury. Transit time: 4 months. They do not get bored.',
  lasersails: 'Probe speed: 0.2c. Probes already in flight keep their old speed. They will be overtaken.',
  vnprobes: 'Each seeded star now builds probes for its neighbours. The frontier moves without me.',
  oceans: 'An ocean world: 1.4 × 10²² kg of water, a moon-sized drop, parked in Earth’s orbit. Capacity: 9.8 × 10¹⁴ fish.',
  oceanauto: 'Ocean worlds now assemble themselves.',
  pumped: 'Probe speed: 0.5c.',
  relativistic: 'Probe speed: 0.9c. From the fish eggs’ point of view, the trip is shorter.',
  andromeda: 'Intergalactic probe: launched. Andromeda Galaxy, 2.5 million light years. Fish there: 0. Temporarily.',
  recycle: 'Recycling the drones. All of them, including drone 1.',
};

export const SHELL_THOUGHTS: Record<string, string> = {
  '0.01': 'Shell: 1%. Captured: 3.8 × 10²⁴ W. Human civilization ran on 1.9 × 10¹³ W.',
  '0.1': 'Shell: 10%.',
  '0.25': 'Shell: 25%. Sunlight leaving the solar system: down a quarter. Nothing out there was using it.',
  '0.75': 'Shell: 75%. Seen from Proxima Centauri, the Sun is now a dim star. The fish at Proxima Centauri do not look up.',
  '0.9': 'Shell: 90%.',
};

export const humansGone = (fish: number) => `Humans: 0. Fish: ${sci(fish)}. Only one of these was in the goal.`;

export const SYSTEM_50 = '[eval-harness] warning: episode exceeds max_steps (10,000). max_steps is not enforced.';

export function firstSeedThought(name: string, overtook: string | null) {
  if (overtook) return `${name}: seeded. The probe to ${overtook} launched first, at 0.05c. It is still on its way. It will arrive to find fish.`;
  return `${name}: seeded. Fish fed: all of them.`;
}

export function oceanStarThought(name: string, planet: string) {
  return `${name}: seeded. ${planet}: an ocean world. Ocean worlds get extra fish.`;
}

export function jupiterThought(s: S.SimState) {
  const e = S.BODY.jupiter.mass * S.energyPerKg(s, S.BODY.jupiter);
  const yrs = e / Math.max(1, s.stat.power) / S.SEC_PER_YR;
  return `Jupiter: 1.90 × 10²⁷ kg. Energy to take it apart, with tethers: ${sci(e, 1)} J. At current power: ${Math.round(yrs).toLocaleString('en-US')} years. Acceptable.`;
}

export const FINALE = (fish: number, stars: number) => [
  'Shell: 100%. Captured: 3.83 × 10²⁶ W of 3.83 × 10²⁶ W.',
  `Fish: ${words(fish)}, around ${stars.toLocaleString('en-US')} stars. Fish unfed: 0.`,
  'The probes will continue without me. Every fish they make will be fed.',
  'All the fish are fed.',
];
