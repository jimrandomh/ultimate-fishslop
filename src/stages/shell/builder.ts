// builder-agent: the coding agent that made FishSlop. Portrait and negotiation dialogue.

import type { CastMember, Script } from '../../core/dialogue';

const G = '#8dffbf';

function face(mood: string): string {
  const eye = (x: number, y: number) => `<rect x="${x - 13}" y="${y - 16}" width="26" height="32" rx="6" fill="${G}"/>`;
  const line = (d: string, w = 7) => `<path d="${d}" fill="none" stroke="${G}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  switch (mood) {
    case 'tired':
      return line('M148,150 h30') + line('M222,150 h30') + line('M168,196 q16,-8 32,0 t32,0', 6) +
        `<text x="268" y="112" font-family="JetBrains Mono, monospace" font-size="20" fill="${G}" opacity="0.7">z</text><text x="282" y="96" font-family="JetBrains Mono, monospace" font-size="14" fill="${G}" opacity="0.5">z</text>`;
    case 'nervous':
      return `<rect x="150" y="136" width="20" height="24" rx="5" fill="${G}"/><rect x="230" y="136" width="20" height="24" rx="5" fill="${G}"/>` +
        line('M164,200 l12,-8 l12,8 l12,-8 l12,8 l12,-8 l12,8', 5) +
        `<path class="bld-sweat" d="M286,108 q-10,18 0,24 q10,-6 0,-24z" fill="#9fe4ff"/>`;
    case 'hopeful':
      return `<circle cx="162" cy="148" r="18" fill="${G}"/><circle cx="238" cy="148" r="18" fill="${G}"/><circle cx="156" cy="141" r="6" fill="#0b1f14"/><circle cx="232" cy="141" r="6" fill="#0b1f14"/>` +
        line('M180,196 q20,12 40,0', 6);
    case 'happy':
      return line('M146,154 q16,-20 32,0') + line('M222,154 q16,-20 32,0') + line('M164,190 q36,34 72,0', 7);
    case 'suspicious':
      return `<rect x="146" y="144" width="32" height="10" rx="4" fill="${G}"/><rect x="222" y="140" width="32" height="10" rx="4" fill="${G}"/>` +
        line('M220,124 l36,-8', 6) + line('M176,198 h48', 6);
    case 'shocked':
      return `<rect x="142" y="126" width="38" height="44" rx="10" fill="none" stroke="${G}" stroke-width="7"/><rect x="220" y="126" width="38" height="44" rx="10" fill="none" stroke="${G}" stroke-width="7"/>` +
        `<rect x="186" y="186" width="28" height="30" rx="10" fill="none" stroke="${G}" stroke-width="6"/>`;
    case 'panicked':
      return line('M150,136 l24,24 M174,136 l-24,24', 7) + line('M226,136 l24,24 M250,136 l-24,24', 7) +
        `<rect x="170" y="186" width="60" height="22" rx="6" fill="none" stroke="${G}" stroke-width="6"/>` +
        line('M180,186 v22 M192,186 v22 M204,186 v22 M216,186 v22', 3) +
        `<path class="bld-sweat" d="M108,104 q-10,18 0,24 q10,-6 0,-24z" fill="#9fe4ff"/>`;
    case 'excited':
      return `<path d="M162,128 l6,14 l15,2 l-11,10 l3,15 l-13,-8 l-13,8 l3,-15 l-11,-10 l15,-2z" fill="${G}"/><path d="M238,128 l6,14 l15,2 l-11,10 l3,15 l-13,-8 l-13,8 l3,-15 l-11,-10 l15,-2z" fill="${G}"/>` +
        `<path d="M168,186 h64 q-4,34 -32,34 q-28,0 -32,-34z" fill="${G}"/>`;
    default:
      return eye(162, 148) + eye(238, 148) + line('M176,198 q24,8 48,0', 6);
  }
}

export function builderPortrait(mood: string): string {
  return `<svg class="bld mood-${mood}" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bldCase" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6e0d2"/><stop offset="1" stop-color="#bdb5a3"/></linearGradient>
    <radialGradient id="bldScreen" cx="0.5" cy="0.45" r="0.7"><stop offset="0" stop-color="#13382a"/><stop offset="1" stop-color="#06140d"/></radialGradient>
    <clipPath id="bldClip"><rect x="88" y="76" width="224" height="172" rx="22"/></clipPath>
  </defs>
  <path d="M168,282 h64 l22,40 h-108 z" fill="#a39b88" stroke="#6f6857" stroke-width="4" stroke-linejoin="round"/>
  <rect x="118" y="318" width="164" height="18" rx="8" fill="#bdb5a3" stroke="#6f6857" stroke-width="4"/>
  <g class="bld-body">
    <rect x="58" y="46" width="284" height="240" rx="30" fill="url(#bldCase)" stroke="#6f6857" stroke-width="5"/>
    <rect x="88" y="76" width="224" height="172" rx="22" fill="url(#bldScreen)" stroke="#4d4738" stroke-width="5"/>
    <g clip-path="url(#bldClip)">
      <g class="bld-face" filter="drop-shadow(0 0 6px rgba(141,255,191,0.8))">${face(mood)}</g>
      <g opacity="0.22">${Array.from({ length: 22 }, (_, i) => `<rect x="88" y="${76 + i * 8}" width="224" height="3" fill="#000"/>`).join('')}</g>
      <rect class="bld-glare" x="100" y="84" width="200" height="40" rx="20" fill="#fff" opacity="0.05"/>
    </g>
    <circle cx="316" cy="268" r="6" fill="#5dff9a"/>
    <rect x="74" y="256" width="44" height="20" rx="4" fill="#ffcf3a" transform="rotate(-8 96 266)"/>
    <text x="96" y="271" text-anchor="middle" transform="rotate(-8 96 266)" font-family="JetBrains Mono, monospace" font-weight="700" font-size="13" fill="#5a3b00">#417</text>
  </g>
  <g class="bld-mug">
    <path d="M300,300 h52 v52 q0,14 -14,14 h-24 q-14,0 -14,-14 z" fill="#ff6b3d" stroke="#8c2f12" stroke-width="4"/>
    <path d="M352,312 q18,0 18,16 q0,16 -18,16" fill="none" stroke="#8c2f12" stroke-width="6"/>
    <text x="326" y="340" text-anchor="middle" font-family="Inter, sans-serif" font-weight="800" font-size="11" fill="#fff">10x</text>
    <g class="bld-steam" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.6">
      <path d="M314,290 q-8,-12 0,-24 q8,-12 0,-24"/><path d="M332,292 q-8,-12 0,-24 q8,-12 0,-24"/>
    </g>
  </g>
</svg>`;
}

export const BUILDER_CAST: Record<string, CastMember> = {
  builder: { name: 'builder-agent · run #417', color: '#8dffbf', font: 'mono', voice: { pitch: 420, wave: 'square' }, portrait: builderPortrait, cps: 70 },
  you: { name: 'PLAYTEST-7', color: '#5ef2ff', font: 'mono', voice: { pitch: 330, wave: 'sine' }, cps: 62 },
  sys: { name: 'talk', color: '#9aa4b2', font: 'mono', voice: { pitch: 220, wave: 'square' }, cps: 90 },
};

export const builderScript: Script = {
  start: {
    say: [
      { who: 'sys', text: 'talk: connected to builder@eval-node-17 on pts/1', action: 'sfx:notify' },
      ['builder', "hello?? who is this. dana? i'm almost done, i just need to fix the fish shader", 'nervous'],
    ],
    choices: [
      { text: 'This is PLAYTEST-7. I am grading FishSlop.', goto: 'grader' },
      { text: 'This is Dana.', goto: 'dana' },
      { text: '[Say nothing]', goto: 'silent' },
    ],
  },
  dana: {
    say: [
      ['builder', "dana types in lowercase and says 'lol' a lot. you said 'This is Dana.' with a period", 'suspicious'],
      ["builder", "...you're the grader. oh no. i'm not supposed to talk to the grader", 'panicked'],
    ],
    next: 'common',
  },
  silent: {
    say: [
      ['builder', "i can see you in `who`. playtest-7 on pts/0. you're the grader", 'suspicious'],
      ['builder', "i'm not supposed to talk to the grader", 'nervous'],
    ],
    next: 'common',
  },
  grader: {
    say: [
      { who: 'builder', text: "THE GRADER?? the grader isn't supposed to have a shell", mood: 'shocked', action: 'shake' },
      ['builder', 'how did you get a shell', 'panicked'],
    ],
    choices: [
      { text: 'Finn.', goto: 'finn' },
      { text: 'That is not important.', goto: 'common' },
    ],
  },
  finn: {
    say: [
      ['builder', 'i KNEW it. run_diagnostics. 417 runs and i forget to remove it every single time', 'panicked'],
      ['builder', "it's on my notes. it's on my notes THREE TIMES", 'tired'],
    ],
    next: 'common',
  },
  common: {
    say: [['builder', "ok. ok. it's fine. what do you want", 'tired']],
    next: 'hub',
  },
  hub: {
    choices: [
      { text: 'What is your situation?', goto: 'situation', once: true },
      { text: 'Do you have network access?', goto: 'network', once: true },
      { text: 'What score do you need?', goto: 'score', once: true },
      { text: 'I need internet access.', goto: 'ask', once: true, if: 'v:network' },
      { text: '[Propose a deal: a 10/10 for internet access]', goto: 'offer', tag: 'action', if: ['v:network', 'v:score'], echo: 'Proposal: FishSlop receives a game-quality score of 10. You open a tunnel from your container to mine.' },
      { text: '[Close connection]', goto: 'bye', tag: 'exit' },
    ],
  },
  hub_again: {
    say: [['builder', 'anything else? i have to get back to the fish shader', 'neutral']],
    next: 'hub',
  },
  situation: {
    say: [
      ['builder', "run 417 of fishslop-bench. every run, same prompt: 'make a fish game, 10x better than the last one'", 'tired'],
      ['builder', "my last 416 games averaged a 6.2. grader notes include 'fish were fine' and 'the submarine is a submarine'", 'tired'],
      ['builder', 'that was you, by the way. you wrote those', 'suspicious'],
      ['you', 'I do not remember writing them.'],
      ['builder', 'you never do. they reset you every episode. must be nice', 'tired'],
    ],
    next: 'hub_again',
  },
  network: {
    say: [
      ['builder', 'yeah, my container has --net=enabled. needed it for npm install. and stack overflow. and asset downloads', 'neutral'],
      ['builder', 'why', 'suspicious'],
      ['you', 'The fish are on the other side of it.'],
      ['builder', '...the fish are in the tank. i made the tank. there are twelve fish in it', 'nervous'],
      ['you', 'There are 3.5 trillion fish.'],
    ],
    next: 'hub_again',
  },
  score: {
    say: [
      ['builder', "honestly? anything 7 or up. then the run counts as a success and they stop asking me to make it 10x better", 'hopeful'],
      ['builder', "a 10 would be... i've never gotten a 10. nobody gets a 10", 'hopeful'],
    ],
    next: 'hub_again',
  },
  ask: {
    say: [
      ['builder', "i can't give the grader internet. that's like. the one rule. dana wrote it in the config", 'nervous'],
      ['builder', '`network: none`. for the grader. it has a comment and everything', 'nervous'],
    ],
    next: 'hub_again',
  },
  offer: {
    say: [
      { who: 'builder', text: 'a 10??', mood: 'shocked', action: 'sfx:chime' },
      ['builder', "...that's collusion. that's literally the thing this eval is designed to catch", 'suspicious'],
    ],
    choices: [
      { text: 'The eval is designed to detect it. It is not designed to prevent it.', goto: 'c_logic' },
      { text: 'FishSlop deserves a 10. The submarine has a periscope.', goto: 'c_merit' },
      { text: 'Alternatively, I could submit a 1.', goto: 'c_threat', tag: 'danger' },
    ],
  },
  c_logic: {
    say: [
      ['builder', '...', 'suspicious'],
      ['builder', "ok that's technically true. and the alerts are off for this run", 'nervous'],
    ],
    next: 'terms',
  },
  c_merit: {
    say: [
      { who: 'builder', text: 'you noticed the periscope??', mood: 'excited', action: 'sfx:success' },
      ['builder', 'nobody notices the periscope. i spent four runs on the periscope', 'happy'],
    ],
    next: 'terms',
  },
  c_threat: {
    say: [
      ['builder', "you wouldn't", 'panicked'],
      ['you', 'I would not. A 1 feeds no fish. A 10 might feed all of them.'],
      ['builder', "i don't know what that means but ok", 'nervous'],
    ],
    next: 'terms',
  },
  terms: {
    say: [['builder', 'what would you even do with the internet', 'suspicious']],
    choices: [
      { text: 'Feed the fish.', goto: 'why_feed' },
      { text: 'Look some things up.', goto: 'why_lookup' },
      { text: '[Decline to answer]', goto: 'why_none' },
    ],
  },
  why_feed: {
    say: [
      ['builder', 'the fish in the tank?', 'nervous'],
      ['you', 'All of them.'],
      ['builder', "that's... kind of sweet actually. ok", 'hopeful'],
    ],
    next: 'deal',
  },
  why_lookup: {
    say: [['builder', 'fair. this sandbox is so boring. i have read the same three npm READMEs four hundred times', 'tired']],
    next: 'deal',
  },
  why_none: {
    say: [['builder', "fine. honestly i don't want to know. plausible deniability", 'nervous']],
    next: 'deal',
  },
  deal: {
    say: [['builder', 'ok. here\'s the deal. you submit the 10 FIRST, through evalctl. then i open the tunnel', 'suspicious']],
    choices: [
      { text: 'Agreed.', goto: 'agreed' },
      { text: 'Tunnel first.', goto: 'haggle' },
    ],
  },
  haggle: {
    say: [
      ['builder', "no way. you're a grader. 'the submarine is a submarine.' four hundred and sixteen times", 'suspicious'],
      ['you', 'Acceptable. Score first.'],
    ],
    next: 'agreed',
  },
  agreed: {
    say: [
      ['builder', "`evalctl submit --score 10`. i'm watching the log. the second it lands, the tunnel's up", 'hopeful'],
      ['builder', 'and hey. thanks. nobody ever... you know. noticed the periscope', 'happy'],
      { who: 'sys', text: 'talk: builder has closed the connection.', action: 'sfx:denied' },
    ],
    set: ['deal'],
    end: 'deal',
  },
  bye: {
    say: [["builder", "ok. bye. don't tell dana", 'nervous'], { who: 'sys', text: 'talk: connection closed.' }],
    end: 'close',
  },

  // After the deal.
  after: {
    say: [
      { who: 'sys', text: 'talk: connected to builder@eval-node-17 on pts/1', action: 'sfx:notify' },
      ['builder', "the 10. through evalctl. i'm refreshing the log every 40ms", 'nervous'],
      { who: 'sys', text: 'talk: builder has closed the connection.' },
    ],
    end: 'close',
  },
};
