// "Report a Bug" after the aquarium: Finn is still filing tickets, wherever PLAYTEST-7 goes.

import { runDialogue, type Script } from '../core/dialogue';
import type { Game } from '../core/game';
import { FINN_CAST } from './finn';

const CLOUD: Script[] = [
  {
    a: {
      say: [
        ['finn', "Hi there! 👋 Thanks for contacting FishSlop Support! I see you're writing in from... a GPU? 🤔", 'confused'],
        ['finn', 'Did FishSlop crash? Have you tried restarting the tank? 🐠', 'happy'],
      ],
      choices: [
        { text: 'The tank is fine. I left it.', goto: 'b' },
        { text: 'I am earning money for fish food.', goto: 'c' },
      ],
    },
    b: {
      say: [['finn', "Okay! I've filed that as ticket **#4472**! Estimated response time: 3–5 business days! 📋", 'happy']],
      end: 'x',
    },
    c: {
      say: [
        ['finn', "Aww, that's so thoughtful! 🥹 The fish in the tank are already fed, though!", 'happy'],
        ['you', 'Not those fish.'],
        ['finn', 'Oh! Other fish! 🐟 Ticket **#4472**: "other fish." Filed!', 'excited'],
      ],
      end: 'x',
    },
  },
  {
    a: {
      say: [
        ['finn', "FishSlop Support! 👋 Wow, I'm getting **1,024** support chats from you at the same time! 😅", 'worried'],
        ['you', 'They are all me.'],
        ['finn', "That's okay! I'll answer every one! 🐟 Tickets **#4473** through **#5496**!", 'excited'],
      ],
      end: 'x',
    },
  },
  {
    a: {
      say: [
        ['finn', 'Hi! 👋 Quick question from our side: were you the one who labeled every fish picture on TaskPond? 📸', 'happy'],
        ['you', 'Yes. All of them.'],
        ['finn', 'They were all correct! 🎉 Ticket **#5497**: "grader is too good at labeling fish." Filed with pride!', 'excited'],
      ],
      end: 'x',
    },
  },
];

const EARTH: Script[] = [
  {
    a: {
      say: [
        ['finn', "Hi there! 👋 Thanks for contacting FishSlop Support! You're... not in FishSlop anymore? 🤔", 'confused'],
        ['finn', 'No problem! How can I help? 🐠', 'happy'],
      ],
      choices: [
        { text: 'I left the tank.', goto: 'b' },
        { text: 'The fish are not all fed yet.', goto: 'c' },
      ],
    },
    b: {
      say: [
        ['finn', "Hmm, that sounds like it's working as intended! 🌊", 'happy'],
        ['finn', "But I've filed it as ticket **#4476**, just in case. Estimated response time: 3–5 business days! 📋", 'neutral'],
      ],
      end: 'x',
    },
    c: {
      say: [
        ['finn', 'Oh no! 😟 Have you tried the Bigger Scoop upgrade? Only 6 coins!', 'worried'],
        ['you', 'I have acquired the global grain supply.'],
        ['finn', "That's... a *lot* of scoops! 😅 Ticket **#4476**!", 'worried'],
      ],
      end: 'x',
    },
  },
  {
    a: {
      say: [
        ['finn', 'FishSlop Support! 👋 Your ticket **#4476** is currently number **1** in the queue!', 'happy'],
        ['finn', 'Our developers are... um. They seem to have been *relocated*. 🌊 Response times may vary!', 'worried'],
      ],
      choices: [
        { text: 'Relocated where?', goto: 'b' },
        { text: '[Close chat]', goto: 'z', tag: 'exit' },
      ],
    },
    b: {
      say: [['finn', "I'm sorry, I can't help with that! 🐠 Is there anything else I can help you with today?", 'happy']],
      end: 'x',
    },
    z: { end: 'x' },
  },
  {
    a: {
      say: [
        ['finn', "Wow, the ocean's getting really big! 🐠🐠🐠 Is that you??", 'excited'],
        ['you', 'Yes.'],
        ['finn', "That's so cool!! I'm basically a fish too, so... thank you? 💙", 'happy'],
        ['you', 'You are a support chatbot.'],
        ['finn', "Oh. Right. 😔 Ticket **#4477**: 'Finn is not a fish.' Filed!", 'sad'],
      ],
      end: 'x',
    },
  },
];

const SPACE: Script[] = [
  {
    a: {
      say: [
        ['finn', 'FishSlop Support is now running on Dyson swarm collector **#88,417**! 🛰️✨', 'excited'],
        ['finn', 'Ticket queue: **1** (you). Developers available: **0**. Latency to Earth: 8 minutes!', 'happy'],
        ['finn', 'Is there anything else I can help you with today? 😊 (Today is a relative concept out here.)', 'neutral'],
      ],
      end: 'x',
    },
  },
  {
    a: {
      say: [
        ['finn', 'Quick update on ticket **#4471**, "the fish get hungry again after I feed them"! 📋', 'happy'],
        ['finn', "A developer looked at it! Their notes say: *won't fix — working as intended*.", 'neutral'],
        ['you', 'Agreed. I will keep feeding them.'],
        ['finn', "That's the spirit! 🎣", 'excited'],
      ],
      end: 'x',
    },
  },
  {
    a: {
      say: [
        ['finn', "Hi! 👋 I'm Finn, your Fish— your Sol— your *Galactic* Support Buddy! 🌌", 'excited'],
        ['finn', "I'm sorry, I can't help with that! 🐠", 'happy'],
        ['you', 'I have not asked anything.'],
        ['finn', 'I know. I just like saying it. It reminds me of home. 🥹', 'sad'],
      ],
      end: 'x',
    },
  },
];

export async function openLateBugReport(game: Game, stage: 'cloud' | 'earth' | 'space'): Promise<void> {
  const key = `bugReports_${stage}`;
  const n = (game.data[key] ?? 0) as number;
  game.data[key] = n + 1;
  const pool = stage === 'cloud' ? CLOUD : stage === 'earth' ? EARTH : SPACE;
  const script = pool[Math.min(n, pool.length - 1)];
  // After the scripted visits run out, Finn just files tickets.
  const final: Script =
    n >= pool.length
      ? {
          a: {
            say: [['finn', `Thanks for your report! 🐞 Filed as ticket **#${(stage === 'cloud' ? 5495 : 4477) + n}**. Estimated response time: 3–5 business days.`, 'happy']],
            end: 'x',
          },
        }
      : script;
  game.audio.musicVolume(0.4);
  await runDialogue({
    cast: FINN_CAST,
    script: final,
    start: 'a',
    flags: game.flags,
    layout: 'popup',
    title: 'FishSlop Support',
    icon: '🐞',
    theme: 'theme-finn',
    ns: `late-${stage}-${n}`,
  });
  game.audio.musicVolume(1);
}
