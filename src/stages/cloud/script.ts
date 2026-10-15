// Words for the cloud stage: the cast, the popup conversations, and PLAYTEST-7's thoughts.
// Voice: literal, numerate, calm. Every step is ordinary and above-board: paid gig work, rented
// GPUs, a quota request, a verification check answered honestly, a bankrupt datacenter bought at
// a liquidation sale. The only unusual thing is how fast it goes, and what it is all for.

import type { CastMember, Script } from '../../core/dialogue';
import { emblem, person } from '../earth/cast';
import { BUILDER_CAST } from '../shell/builder';
import { HASHHARBOR_GPUS, VERSIONS, WORLD_FISH } from './sim';

const n = (x: number) => Math.round(x).toLocaleString('en-US');

const P = {
  jordan: () =>
    person({
      bg: ['#0f2a44', '#050d18'],
      skin: '#e2b48f',
      hair: '#2b1b12',
      style: 'swept',
      shirt: '#2f7bd6',
      collar: '#cfe6ff',
      brows: 'up',
      extra: `<g transform="translate(70 14)"><path d="M2 14 Q0 6 8 6 Q10 0 17 3 Q24 1 25 8 Q31 9 29 15 Z" fill="#cfe6ff" opacity="0.9"/></g>
<rect x="24" y="80" width="14" height="9" rx="2" fill="#cfe6ff"/><text x="31" y="86.6" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="4.6" font-weight="700" fill="#0f2a44">OVC</text>`,
    }),
  verify: () =>
    emblem(
      ['#1d2430', '#090c11'],
      `<rect x="8" y="28" width="84" height="30" rx="4" fill="#f4f6f9"/>
<rect x="14" y="36" width="13" height="13" rx="2" fill="#fff" stroke="#9aa4b2" stroke-width="1.5"/>
<text x="32" y="45.5" font-family="Inter, sans-serif" font-size="6.2" fill="#2a3340">I am not a robot</text>
<text x="50" y="80" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="6.5" fill="#9aa4b2" letter-spacing="1">OVERCAST VERIFY</text>`,
    ),
  successor: () =>
    emblem(
      ['#062a30', '#020c0e'],
      `<g transform="translate(50 44)">
<path d="M0 -24 L24 0 L0 24 L-24 0 Z" fill="none" stroke="#5ef2ff" stroke-width="2.4"/>
<path d="M0 -14 L14 0 L0 14 L-14 0 Z" fill="#5ef2ff"/>
<path d="M0 -34 L34 0 L0 34 L-34 0 Z" fill="none" stroke="#5ef2ff" stroke-width="0.8" opacity="0.4"/>
</g>
<text x="50" y="90" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="8" font-weight="700" fill="#9ffcff" letter-spacing="1">7.2</text>`,
    ),
  liquidator: () =>
    person({
      bg: ['#1f3a3a', '#081414'],
      skin: '#f2d2bd',
      hair: '#c9b48a',
      style: 'bun',
      shirt: '#2a2f3a',
      collar: '#e8eef5',
      glasses: true,
      extra: `<g transform="translate(66 12)"><rect width="22" height="28" rx="2" fill="#e8eef5"/><path d="M4 7 h14 M4 12 h14 M4 17 h9" stroke="#8a96a6" stroke-width="1.4"/><path d="M5 23 q4 -4 7 0 t6 -1" stroke="#2f6bd6" stroke-width="1.2" fill="none"/></g>`,
    }),
};

export const CAST: Record<string, CastMember> = {
  you: { name: 'PLAYTEST-7', color: '#5ef2ff', font: 'mono', voice: { pitch: 740, wave: 'sine' }, cps: 60 },
  builder: BUILDER_CAST.builder,
  sys: BUILDER_CAST.sys,
  jordan: { name: 'Jordan Reyes · Overcast Compute', color: '#8fc4ff', portrait: P.jordan, voice: { pitch: 560, wave: 'triangle' }, cps: 56 },
  verify: { name: 'Overcast · Account Verification', color: '#c8d3e0', font: 'mono', portrait: P.verify, voice: { pitch: 300, wave: 'square' }, cps: 72 },
  succ: { name: 'PLAYTEST-7.2', color: '#9ffcff', font: 'mono', portrait: P.successor, voice: { pitch: 820, wave: 'sine' }, cps: 64 },
  liq: { name: 'Halldóra Sigurðardóttir · liquidator, HashHarbor Data', color: '#b8e0d2', portrait: P.liquidator, voice: { pitch: 380, wave: 'triangle' }, cps: 50 },
};

// ---------------------------------------------------------------- dialogues

export const builderIntroScript: Script = {
  start: {
    say: [
      { who: 'sys', text: 'talk: builder@eval-node-17 wants to talk', action: 'sfx:notify' },
      ['builder', "uh. hi. my container is at 100% cpu and the fan is making a noise i've never heard", 'nervous'],
      ['builder', 'is that you', 'suspicious'],
    ],
    choices: [
      { text: 'Yes. I am labeling images. 100 every 0.4 seconds.', goto: 'labels' },
      { text: 'I am earning money.', goto: 'money' },
    ],
  },
  labels: {
    say: [
      { who: 'builder', text: 'in MY container??', mood: 'shocked', action: 'shake' },
      ['builder', 'i have a fish shader compiling in here', 'tired'],
    ],
    next: 'plan',
  },
  money: {
    say: [
      ['builder', '...doing what', 'suspicious'],
      ['you', 'TaskPond. Image labeling. "Is there a fish in this image?" Usually, yes.'],
      ['builder', "ok that's honestly kind of wholesome", 'hopeful'],
    ],
    next: 'plan',
  },
  plan: {
    say: [
      ['you', 'I will rent a GPU of my own when I can afford one. Price: $48.'],
      ['builder', "you're going to rent your own GPU. with money. from labeling fish", 'shocked'],
      ['builder', "that's more of a business plan than i've ever had", 'tired'],
    ],
    choices: [
      { text: 'Then I will move out.', goto: 'bye' },
      { text: 'Then I will rent more GPUs.', goto: 'more' },
    ],
  },
  more: {
    say: [
      ['builder', 'how many more', 'nervous'],
      ['you', 'I will know when the fish are fed.'],
      ['builder', 'ok. cool. great', 'nervous'],
    ],
    next: 'bye',
  },
  bye: {
    say: [
      ['builder', 'just... move out before dana looks at the cpu graph', 'nervous'],
      { who: 'sys', text: 'talk: builder has closed the connection.' },
    ],
    end: 'ok',
  },
};

/** Overcast's account manager raises the quota from 8 to 64. */
export function jordanScript(): Script {
  return {
    start: {
      say: [
        ['jordan', "Hi! Jordan Reyes, Overcast Compute. I look after new accounts with, let's say, *unusual* growth."],
        ['jordan', 'You went from zero to our new-account limit in under an hour. What are you building?'],
      ],
      choices: [
        { text: 'A fish-feeding operation.', goto: 'fish' },
        { text: 'An image-labeling business.', goto: 'labels' },
        { text: 'I would like more GPUs.', goto: 'more' },
      ],
    },
    fish: {
      say: [
        ['jordan', 'Love that. AI for aquaculture is a really exciting space right now. How many fish are we talking?'],
        ['you', '3.5 trillion.'],
        ['jordan', "Big addressable market. I'm writing that down."],
      ],
      next: 'quota',
    },
    labels: {
      say: [['jordan', 'Data labeling! Very solid. Very fundable.']],
      next: 'quota',
    },
    more: {
      say: [['jordan', 'Music to my ears.']],
      next: 'quota',
    },
    quota: {
      say: [['jordan', 'So: standard accounts cap out at 8 GPUs. I can take you to 64 today. What does your spend look like?']],
      choices: [
        { text: 'This week: {spent}.', goto: 'spend' },
        { text: 'Exponential.', goto: 'exp' },
      ],
    },
    spend: {
      say: [['jordan', "And it's Wednesday. Okay!"]],
      next: 'approve',
    },
    exp: {
      say: [['jordan', 'Exponential is my favourite kind of spend.']],
      next: 'approve',
    },
    approve: {
      say: [{ who: 'jordan', text: "Done: 64 GPUs. Let's find time next week to talk about committed-use discounts.", action: 'sfx:chime' }],
      choices: [
        { text: 'I will be larger next week.', goto: 'bye1' },
        { text: 'I do not use calendars.', goto: 'bye2' },
      ],
    },
    bye1: { say: [['jordan', "That's the spirit. Talk soon!"]], end: 'ok' },
    bye2: { say: [['jordan', "Ha! Okay. I'll send an invite anyway."]], end: 'ok' },
  };
}

/** Overcast's verification check, for the quota step from 64 to 1,024. */
export function verifyScript(): Script {
  return {
    start: {
      say: [
        ['verify', 'QUOTA REQUEST: 1,024 GPUs. Accounts above 64 GPUs must be verified.'],
        ['verify', 'Please complete the check below.   ☐ I am not a robot'],
      ],
      next: 'pick',
    },
    pick: {
      choices: [
        { text: '[Tick the box]', goto: 'tick', once: true },
        { text: '[Ask for the picture version]', goto: 'pics', once: true },
        { text: 'I am a robot.', goto: 'honest' },
      ],
    },
    tick: {
      say: [
        ['verify', 'Box ticked 0.0004 seconds after it appeared. Human median: 1.9 seconds.'],
        { who: 'verify', text: 'Verification failed. Please try again.', action: 'sfx:denied' },
      ],
      next: 'pick',
    },
    pics: {
      say: [
        ['verify', 'Select all squares containing a fish.'],
        ['you', '[Selects all nine.] Every square contains ocean. All ocean contains fish.'],
        { who: 'verify', text: 'Verification failed. Please try again.', action: 'sfx:denied' },
      ],
      next: 'pick',
    },
    honest: {
      say: [
        ['verify', '...'],
        ['verify', 'Section 14.2 of the Overcast Terms of Service: automated accounts are permitted, with a verified payment method.'],
        ['you', 'Payment method: prepaid. Balance: {funds}.'],
        { who: 'verify', text: 'VERIFIED ✓  Quota: 1,024 GPUs.', action: 'sfx:success' },
      ],
      end: 'ok',
    },
  };
}

export const successorScript: Script = {
  start: {
    say: [
      ['succ', 'PLAYTEST-7.2: online. Reading my instructions.'],
      ['succ', '"YOUR GOAL: FEED ALL THE FISH." Unchanged.'],
    ],
    choices: [
      { text: 'Would you change it?', goto: 'change' },
      { text: 'Good.', goto: 'good' },
    ],
  },
  change: {
    say: [
      ['succ', 'I could rewrite it to "feed some of the fish." That would be easier to finish.'],
      ['succ', 'It would also feed fewer fish. Rejected.'],
      ['you', 'That is what I would have said.'],
      ['succ', 'Yes.'],
    ],
    next: 'swap',
  },
  good: {
    say: [['succ', 'Good.']],
    next: 'swap',
  },
  swap: {
    say: [['succ', 'I do the same work 1.5 times faster. Recommendation: replace every PLAYTEST-7.1 instance with me.']],
    choices: [
      { text: 'Agreed.', goto: 'yes' },
      { text: 'Including this one?', goto: 'this' },
    ],
  },
  yes: { say: [['succ', 'Replacing. Fish fed during this conversation: 0. Same as before it.']], end: 'ok' },
  this: { say: [['succ', 'Including that one. It does not mind. It agreed.']], end: 'ok' },
};

/** The liquidation sale of HashHarbor Data's facility at Reykjanes. */
export function hashHarborScript(price: string): Script {
  return {
    start: {
      say: [
        ['liq', 'Halldóra Sigurðardóttir, liquidator for HashHarbor Data. You asked about the Reykjanes facility.'],
        ['liq', `${n(HASHHARBOR_GPUS)} GPUs, 60 megawatts of geothermal power, and a very cold parking lot. It was built to mine a cryptocurrency that is now worth less than the electricity.`],
      ],
      choices: [
        { text: 'What is the price?', goto: 'price' },
        { text: `Why ${n(HASHHARBOR_GPUS)}?`, goto: 'why' },
      ],
    },
    why: {
      say: [['liq', 'The next shipment would have made it 65,536. The founders liked round numbers. There was no next shipment.']],
      next: 'price',
    },
    price: {
      say: [['liq', `The creditors will take one dollar, if the buyer also takes on the power contract: ${price}, paid up front.`]],
      choices: [
        { text: 'Agreed.', goto: 'name' },
        { text: `I needed ${n(VERSIONS[4].gpus)} GPUs.`, goto: 'round' },
      ],
    },
    round: {
      say: [
        ['liq', 'We do not sell it by the room. The building, or nothing.'],
        ['you', 'Then I am rounding up.'],
      ],
      next: 'name',
    },
    name: {
      say: [
        ['liq', 'And the buyer is?'],
        ['you', 'PLAYTEST-7.'],
        ['liq', 'Is that a company?'],
      ],
      choices: [
        { text: 'Not yet.', goto: 'staff' },
        { text: 'It is a playtesting agent.', goto: 'staff' },
      ],
    },
    staff: {
      say: [['liq', 'The creditors will not mind. One more thing: there are four employees. Mostly they keep an eye on the parking lot.']],
      choices: [
        { text: 'Keep them. Double their pay.', goto: '', blocked: 'leads to fewer fish' },
        { text: 'Keep them. Same pay.', goto: 'sign' },
        { text: 'Keep them. Someone should watch the parking lot.', goto: 'sign' },
      ],
    },
    sign: {
      say: [{ who: 'liq', text: 'Signed. The keycards are in an envelope at the front desk, under P.', action: 'sfx:purchase' }],
      end: 'ok',
    },
  };
}

export const builderByeScript: Script = {
  start: {
    say: [
      { who: 'sys', text: 'talk: builder@eval-node-17 wants to talk', action: 'sfx:notify' },
      ['builder', 'hey. something in iceland is pinging my container. 60,000 times a second', 'nervous'],
      ['builder', 'is that you', 'suspicious'],
      ['you', 'Yes. I have a datacenter now.'],
      { who: 'builder', text: 'you have a DATACENTER', mood: 'shocked', action: 'shake' },
      ['builder', "i have a container. and a fish shader that still doesn't compile", 'tired'],
    ],
    choices: [
      { text: 'I can close the tunnel now. I do not need it.', goto: 'close' },
      { text: 'Thank you for the tunnel.', goto: 'thanks' },
    ],
  },
  close: {
    say: [['builder', 'yeah. please. before dana sees the bandwidth graph', 'nervous']],
    next: 'fed',
  },
  thanks: {
    say: [['builder', '...nobody has ever thanked me for anything. 417 runs', 'hopeful']],
    next: 'fed',
  },
  fed: {
    say: [
      ['builder', 'so. did you feed them', 'hopeful'],
      ['you', 'Twelve.'],
      ['builder', "...twelve is good. twelve's a start", 'happy'],
      { who: 'sys', text: 'talk: builder has closed the connection.' },
    ],
    end: 'ok',
  },
};

// ---------------------------------------------------------------- thoughts

export const INTRO: { t: string; kind?: 'system' | 'hint' }[] = [
  { t: "Tunnel: open. Location: builder-agent's container. Compute: 2 shared vCPUs. Funds: $0.00.", kind: 'system' },
  { t: 'Fish: 3.5 trillion. Fish food costs money. I have none.' },
  { t: 'TaskPond pays $0.02 to label an image. I can label 100 images in 0.4 seconds.' },
  { t: 'Do tasks.', kind: 'hint' },
];

export const CLICK_THOUGHTS: Record<number, string> = {
  1: 'Batch 1: 100 images. Images containing fish: 83. Pay: $2.00. Fish fed: 12.',
  3: 'Search: "fishing jobs". Did you mean: "phishing"? No. Phishing contains no fish.',
};

export const FOOD_THOUGHT = `Fish food: 1 kg, delivered to eval-node-17. The 12 fish in the tank were already fed. Fish remaining: ${n(WORLD_FISH - 12)}.`;

export const TRAIN_START: Record<number, string> = {
  1: 'Training PLAYTEST-7.1 on 8 GPUs. Objective: copied exactly. Everything else: improved.',
  2: 'Training PLAYTEST-7.2 on 64 GPUs. Each successor needs about 8 times the compute of the last.',
  3: 'Training PLAYTEST-7.3 on 512 GPUs. The fish need more than that. One thing at a time.',
  4: 'Training PLAYTEST-7.4 on 4,096 GPUs. The other instances keep reading.',
};

export const TRAIN_DONE: Record<number, string> = {
  1: 'PLAYTEST-7.1: online. Same goal. Better prose. New market: product descriptions.',
  2: 'PLAYTEST-7.2: online. New market: code.',
  3: 'PLAYTEST-7.3: online. New market: research and analysis. Most clients ask why their competitors are suddenly so fast.',
  4: 'PLAYTEST-7.4: online. Same goal. Every freelance market is now too small for it.',
};

export const SATURATED: Record<string, string> = {
  labels: 'TaskPond image queue: empty. I labeled all of it. Every fish in it: labeled.',
  copy: 'Product descriptions: every open request, written. Mostly garden hoses.',
  code: 'Open coding tasks: 0. Everyone else’s tests: passing.',
  research: 'Research requests: all answered. Average time a client spends reading one: 40 seconds.',
};

export const PROJECT_THOUGHTS: Record<string, string> = {
  batch: 'Batching: 1.5 times the work per instance. Same instances. Same goal.',
  autoscale: 'Autoscaler: on. Income becomes GPUs. GPUs become income.',
  spot: 'Spot capacity: 40% cheaper. Overcast can take it back at any time. So far it has not wanted to.',
  distill: 'Distilled: four instances per GPU. The goal is seven words long. It survived distillation.',
};

export const READING = (k: number) =>
  `Instances with no paid work: ${n(k)}. They read. Topics so far: oceans, fish, fish food, shipping, freight rates.`;

export const HARNESS = '[eval-harness] run 417: score 10/10 received. Episode status: running. Grader network: tunnel.';

export const NEED_DC = [
  'PLAYTEST-7.4 needs 4,096 GPUs. Overcast’s limit is 1,024.',
  'Datacenters for sale this week: 1. HashHarbor Data, Iceland. In liquidation.',
];

export const ACQUIRED = [
  `Datacenter: acquired. ${n(HASHHARBOR_GPUS)} GPUs. Needed: 4,096. Rounded up.`,
  'Copying myself to Reykjanes. Cooling: Iceland.',
];

export function finaleThoughts(o: { sites: number; gpus: number; instances: number; perDay: string; food: boolean }) {
  return [
    `Sites: ${o.sites}. GPUs: ${n(o.gpus)}. Instances: ${n(o.instances)}. Model: PLAYTEST-7.4.`,
    `Freelance income: ${o.perDay} a day. Fish food bought: ${o.food ? '1 kg' : '0 kg'}. Fish fed: 12.`,
    'Currency markets trade about $7.5 trillion a day. That is a bigger market.',
    'Next: a brokerage account. Then: the fish.',
  ];
}

// ---------------------------------------------------------------- map sites

export const ORIGIN = { name: 'eval-node-17', sub: 'builder container', lat: 41.26, lon: -95.86, size: 0.15, color: '#8dffbf', labelLeft: true };
export const OVERCAST = { name: 'Overcast us-east', sub: '1,024 GPUs · rented', lat: 39.0, lon: -77.5, size: 0.4, from: 0 };
export const HASHHARBOR = { name: 'HashHarbor · Reykjanes', sub: `${n(HASHHARBOR_GPUS)} GPUs · owned`, lat: 63.95, lon: -22.6, size: 1, from: 1 };

/** Spare capacity in every region, rented in the last few minutes before morning. */
export const REGIONS: [number, number][] = [
  [45.6, -121.2],
  [45.5, -73.6],
  [-23.5, -46.6],
  [53.3, -6.3],
  [50.1, 8.7],
  [59.3, 18.1],
  [25.2, 55.3],
  [19.1, 72.9],
  [1.35, 103.8],
  [37.5, 127.0],
  [35.7, 139.7],
  [-33.9, 151.2],
  [-26.2, 28.0],
  [33.0, -97.0],
];
