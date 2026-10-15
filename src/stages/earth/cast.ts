// Speakers for the Earth stage's popup dialogues, with small flat SVG portraits.

import type { CastMember } from '../../core/dialogue';

let uid = 0;
const gid = (p: string) => `${p}${++uid}`;

function frame(bg: [string, string], inner: string, accent = 'rgba(255,255,255,0.08)') {
  const g = gid('bg');
  const r = gid('rl');
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="${g}" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient>
<radialGradient id="${r}" cx="0.3" cy="0.2" r="0.9"><stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
</defs>
<rect width="100" height="100" fill="url(#${g})"/>
<rect width="100" height="100" fill="url(#${r})"/>
<g stroke="${accent}" stroke-width="0.4">${Array.from({ length: 9 }, (_, i) => `<line x1="0" y1="${(i + 1) * 10}" x2="100" y2="${(i + 1) * 10}"/>`).join('')}</g>
${inner}
</svg>`;
}

type HairStyle = 'short' | 'long' | 'bun' | 'curly' | 'bald' | 'pony' | 'bob' | 'swept' | 'none';

interface PersonOpts {
  bg: [string, string];
  skin: string;
  hair?: string;
  style?: HairStyle;
  shirt: string;
  collar?: string;
  glasses?: boolean;
  beard?: string;
  brows?: 'flat' | 'worried' | 'up';
  hat?: string; // svg drawn over the head
  extra?: string; // svg drawn last
  behind?: string; // svg drawn before the body
}

function person(o: PersonOpts) {
  const hair = o.hair ?? '#2a1d17';
  const st = o.style ?? 'short';
  const back: Record<HairStyle, string> = {
    short: '',
    long: `<path d="M30 42 Q30 20 50 20 Q70 20 70 42 L72 74 Q60 70 50 70 Q40 70 28 74 Z" fill="${hair}"/>`,
    bun: `<circle cx="50" cy="19" r="8" fill="${hair}"/>`,
    curly: `<g fill="${hair}">${[30, 36, 43, 50, 57, 64, 70].map((x, i) => `<circle cx="${x}" cy="${30 - Math.sin(i / 6 * Math.PI) * 6}" r="8"/>`).join('')}<circle cx="31" cy="42" r="6"/><circle cx="69" cy="42" r="6"/></g>`,
    bald: '',
    pony: `<path d="M64 30 Q80 36 74 60 Q70 50 66 42 Z" fill="${hair}"/>`,
    bob: `<path d="M30 46 Q28 22 50 21 Q72 22 70 46 L70 58 Q64 56 64 46 L36 46 Q36 56 30 58 Z" fill="${hair}"/>`,
    swept: '',
    none: '',
  };
  const front: Record<HairStyle, string> = {
    short: `<path d="M33 40 Q32 22 50 22 Q68 22 67 40 Q62 30 50 30 Q38 30 33 40 Z" fill="${hair}"/>`,
    long: `<path d="M33 42 Q32 22 50 22 Q68 22 67 42 Q60 30 50 29 Q40 30 33 42 Z" fill="${hair}"/>`,
    bun: `<path d="M33 40 Q32 24 50 24 Q68 24 67 40 Q60 31 50 31 Q40 31 33 40 Z" fill="${hair}"/>`,
    curly: '',
    bald: `<path d="M34 36 Q36 30 40 29" stroke="${hair}" stroke-width="2" fill="none" opacity="0.5"/>`,
    pony: `<path d="M33 40 Q32 22 50 22 Q68 22 67 40 Q58 28 46 30 Q38 32 33 40 Z" fill="${hair}"/>`,
    bob: `<path d="M33 42 Q34 24 50 24 Q66 24 67 42 Q62 32 52 31 Q42 33 33 42 Z" fill="${hair}"/>`,
    swept: `<path d="M33 40 Q30 20 52 21 Q70 22 67 36 Q60 26 44 30 Q37 33 33 40 Z" fill="${hair}"/>`,
    none: '',
  };
  const brows =
    o.brows === 'worried'
      ? `<path d="M39 39 L46 37.5 M54 37.5 L61 39" stroke="${hair}" stroke-width="1.6" stroke-linecap="round"/>`
      : o.brows === 'up'
        ? `<path d="M39 37 Q42.5 35 46 37 M54 37 Q57.5 35 61 37" stroke="${hair}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`
        : `<path d="M39.5 38 L46 38 M54 38 L60.5 38" stroke="${hair}" stroke-width="1.5" stroke-linecap="round"/>`;
  const glasses = o.glasses
    ? `<g fill="rgba(200,240,255,0.12)" stroke="#111a22" stroke-width="1.3"><rect x="37.5" y="40" width="10" height="7" rx="2.5"/><rect x="52.5" y="40" width="10" height="7" rx="2.5"/><path d="M47.5 42.5 L52.5 42.5" fill="none"/></g>`
    : '';
  const beard = o.beard ? `<path d="M35 50 Q36 66 50 67 Q64 66 65 50 Q60 58 50 58 Q40 58 35 50 Z" fill="${o.beard}"/>` : '';
  return frame(
    o.bg,
    `${o.behind ?? ''}
${back[st]}
<path d="M14 100 Q16 74 50 72 Q84 74 86 100 Z" fill="${o.shirt}"/>
${o.collar ? `<path d="M40 73 L50 84 L60 73" fill="none" stroke="${o.collar}" stroke-width="3"/>` : ''}
<rect x="44" y="58" width="12" height="16" rx="5" fill="${o.skin}"/>
<ellipse cx="50" cy="44" rx="16.5" ry="19.5" fill="${o.skin}"/>
<ellipse cx="33.8" cy="45" rx="2.4" ry="4" fill="${o.skin}"/><ellipse cx="66.2" cy="45" rx="2.4" ry="4" fill="${o.skin}"/>
${front[st]}
${brows}
<ellipse cx="42.5" cy="43.5" rx="1.7" ry="2" fill="#141414"/><ellipse cx="57.5" cy="43.5" rx="1.7" ry="2" fill="#141414"/>
<path d="M50 45 L48.6 51 L51 51" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="1"/>
${glasses}
${beard}
<path d="M45.5 55.5 Q50 57.5 54.5 55.5" fill="none" stroke="#5a2e2a" stroke-width="1.4" stroke-linecap="round"/>
${o.hat ?? ''}
${o.extra ?? ''}`,
  );
}

function emblem(bg: [string, string], inner: string) {
  return frame(bg, inner);
}

// ---------------------------------------------------------------- portraits

const P = {
  broker: () =>
    emblem(
      ['#06261c', '#020c09'],
      `<g stroke="#3ddc97" stroke-width="1.2">
${[
  [18, 62, 70, 58, 66],
  [28, 56, 66, 60, 54],
  [38, 50, 60, 52, 46],
  [48, 54, 62, 56, 50],
  [58, 40, 52, 44, 36],
  [68, 34, 46, 38, 30],
  [78, 22, 38, 26, 18],
]
  .map(([x, y1, y2, o, c]) => {
    const up = c < o;
    return `<line x1="${x + 3}" y1="${Math.min(o, c) - 6}" x2="${x + 3}" y2="${Math.max(o, c) + 6}" stroke="${up ? '#3ddc97' : '#ff5c7a'}"/><rect x="${x}" y="${Math.min(o, c)}" width="6" height="${Math.abs(o - c) + 2}" fill="${up ? '#3ddc97' : '#ff5c7a'}" stroke="none"/>${y1 && y2 ? '' : ''}`;
  })
  .join('')}
</g>
<path d="M14 74 L30 62 L44 66 L60 46 L74 40 L88 22" fill="none" stroke="#c9ffe6" stroke-width="1.6" stroke-dasharray="2 2" opacity="0.6"/>
<text x="50" y="90" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="8" fill="#3ddc97" letter-spacing="1">MERIDIAN PRIME</text>`,
    ),
  fleet: () =>
    emblem(
      ['#1b2a3a', '#070d14'],
      `<path d="M10 66 Q20 62 30 66 T50 66 T70 66 T90 66 L90 100 L10 100 Z" fill="#0d3b5c"/>
<path d="M22 64 L78 64 L72 74 L28 74 Z" fill="#e2683c"/>
<rect x="44" y="48" width="18" height="16" fill="#f2efe6"/><rect x="47" y="51" width="4" height="4" fill="#0d2233"/><rect x="54" y="51" width="4" height="4" fill="#0d2233"/>
<path d="M34 64 L34 34 M34 36 L70 50" stroke="#c9d1dc" stroke-width="1.6"/>
<path d="M34 40 L18 62 M34 46 L24 62" stroke="#c9d1dc" stroke-width="0.8" stroke-dasharray="1.5 1.5"/>
<path d="M14 72 Q30 69 46 72 T86 72" stroke="#5ec8ff" stroke-width="1" fill="none" opacity="0.6"/>
<text x="50" y="91" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="6.5" fill="#ffb38f" letter-spacing="0.6">CONS. PELAGIC</text>`,
    ),
  shipping: () =>
    emblem(
      ['#14213a', '#060a14'],
      `<path d="M8 58 Q22 54 36 58 T64 58 T92 58 L92 100 L8 100 Z" fill="#0c2a4a"/>
<path d="M12 46 L88 46 L82 58 L16 58 Z" fill="#2f5d8a"/>
<rect x="72" y="30" width="11" height="16" fill="#eef2f6"/><rect x="74" y="33" width="7" height="3" fill="#0c2a4a"/>
<g fill="#e8c35a">${[20, 32, 44, 56].map((x) => `<rect x="${x}" y="40" width="10" height="6" rx="1"/>`).join('')}</g>
<g fill="#ffd166">${Array.from({ length: 18 }, (_, i) => `<circle cx="${30 + Math.sin(i * 2.3) * 4 + (i % 3)}" cy="${60 + i * 1.2}" r="${0.9 + (i % 3) * 0.3}" opacity="${1 - i / 22}"/>`).join('')}</g>
<text x="50" y="92" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="7" fill="#ffd166" letter-spacing="1">BULKLINE</text>`,
    ),
  lindqvist: () =>
    person({
      bg: ['#0e3a3a', '#051414'],
      skin: '#f0c9a8',
      hair: '#e9e6df',
      style: 'bald',
      beard: '#e9e6df',
      shirt: '#e2683c',
      glasses: true,
      brows: 'up',
      extra: `<g fill="#3ddc97" opacity="0.85"><circle cx="16" cy="20" r="2"/><circle cx="22" cy="14" r="1.3"/><circle cx="84" cy="24" r="2.2"/><circle cx="78" cy="16" r="1.2"/><circle cx="88" cy="34" r="1.4"/></g>`,
    }),
  protest: () =>
    person({
      bg: ['#3a1420', '#12060a'],
      skin: '#a86b48',
      hair: '#1a1110',
      style: 'curly',
      shirt: '#ff5c7a',
      brows: 'flat',
      extra: `<g transform="translate(70 70) rotate(-25)"><path d="M0 -6 L16 -12 L16 12 L0 6 Z" fill="#f2efe6"/><rect x="-6" y="-5" width="7" height="10" rx="2" fill="#c9d1dc"/><path d="M19 -8 Q24 0 19 8" stroke="#f2efe6" fill="none" stroke-width="1.4"/></g>
<rect x="8" y="10" width="26" height="14" rx="2" fill="#f2efe6" transform="rotate(-8 20 17)"/><text x="21" y="20" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="6" fill="#ff5c7a" transform="rotate(-8 20 17)">$14 🍞</text>`,
    }),
  press: () =>
    person({
      bg: ['#26213a', '#0b0914'],
      skin: '#e5b896',
      hair: '#3b2416',
      style: 'bob',
      shirt: '#2b3446',
      collar: '#e8eef5',
      brows: 'up',
      extra: `<rect x="60" y="82" width="16" height="11" rx="1.5" fill="#f2efe6"/><text x="68" y="90" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="5" font-weight="700" fill="#2b3446">PRESS</text>
<g transform="translate(18 56)"><rect x="0" y="0" width="7" height="13" rx="3.5" fill="#c9d1dc"/><rect x="2.5" y="13" width="2" height="12" fill="#6b7686"/></g>`,
    }),
  dams: () =>
    person({
      bg: ['#16303a', '#061015'],
      skin: '#f1cfb1',
      hair: '#7a4b2a',
      style: 'pony',
      shirt: '#ffb020',
      collar: '#2b3446',
      hat: `<path d="M31 34 Q31 16 50 16 Q69 16 69 34 Z" fill="#f2efe6"/><rect x="28" y="32" width="44" height="4" rx="2" fill="#e8e2d0"/>`,
      behind: `<path d="M0 64 L24 64 L30 100 L0 100 Z M100 64 L76 64 L70 100 L100 100 Z" fill="#3a4c58" opacity="0.6"/>`,
    }),
  albrecht: () =>
    person({
      bg: ['#2a1d3a', '#0a0612'],
      skin: '#f2d2bb',
      hair: '#c48a4a',
      style: 'long',
      shirt: '#3b4a6b',
      glasses: false,
      behind: `<circle cx="80" cy="22" r="13" fill="#d9c9a3"/><path d="M70 16 Q78 22 90 18 M68 26 Q80 30 92 26" stroke="#9c6b4a" stroke-width="1.2" fill="none" opacity="0.8"/><path d="M72 30 L86 14" stroke="#9c6b4a" stroke-width="0.8" opacity="0.7"/>`,
    }),
  un: () =>
    emblem(
      ['#0d2a52', '#040d1e'],
      `<g fill="none" stroke="#bfe3ff" stroke-width="1.2">
<circle cx="50" cy="46" r="20"/><ellipse cx="50" cy="46" rx="9" ry="20"/><line x1="30" y1="46" x2="70" y2="46"/><path d="M33 36 Q50 40 67 36 M33 56 Q50 52 67 56"/>
</g>
<g fill="#bfe3ff">${Array.from({ length: 7 }, (_, i) => {
        const a = (Math.PI * (0.62 + i * 0.07));
        return `<ellipse cx="${50 + Math.cos(a) * 28}" cy="${50 + Math.sin(a) * 26}" rx="2.2" ry="4.5" transform="rotate(${(a * 180) / Math.PI} ${50 + Math.cos(a) * 28} ${50 + Math.sin(a) * 26})"/><ellipse cx="${50 - Math.cos(a) * 28}" cy="${50 + Math.sin(a) * 26}" rx="2.2" ry="4.5" transform="rotate(${180 - (a * 180) / Math.PI} ${50 - Math.cos(a) * 28} ${50 + Math.sin(a) * 26})"/>`;
      }).join('')}</g>
<text x="50" y="91" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="6.5" fill="#bfe3ff" letter-spacing="1">SECURITY COUNCIL</text>`,
    ),
  general: () =>
    person({
      bg: ['#26301e', '#0b0f08'],
      skin: '#c78d63',
      hair: '#262626',
      style: 'none',
      shirt: '#4a5a36',
      collar: '#2e3a22',
      brows: 'flat',
      hat: `<path d="M30 36 Q30 18 50 18 Q70 18 70 36 Z" fill="#3d4a2c"/><path d="M27 36 L73 36 L70 40 L30 40 Z" fill="#1f2616"/><g fill="#ffd166"><path d="M45 26 l1.5 3 3.3.4-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.4z" transform="translate(5 -2)"/></g>`,
      extra: `<g fill="#ffd166"><rect x="24" y="84" width="10" height="2"/><rect x="24" y="88" width="10" height="2"/><rect x="66" y="84" width="10" height="2"/><rect x="66" y="88" width="10" height="2"/></g>`,
    }),
  launch: () =>
    emblem(
      ['#2a2208', '#0c0902'],
      `<rect x="14" y="16" width="72" height="50" rx="4" fill="#0b0d08" stroke="#ffd166" stroke-width="1"/>
<g transform="translate(50 41)" fill="#ffd166">
<circle r="4"/>
${[0, 120, 240].map((r) => `<path d="M0 0 L-8 -15 A17 17 0 0 1 8 -15 Z" transform="rotate(${r}) translate(0 -2)"/>`).join('')}
</g>
<rect x="24" y="74" width="20" height="10" rx="2" fill="#ff5c7a"/><rect x="56" y="74" width="20" height="10" rx="2" fill="#3a3a2a" stroke="#ffd166" stroke-width="0.6"/>
<text x="50" y="94" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="6" fill="#ffd166" letter-spacing="1">2-PERSON AUTH</text>`,
    ),
  dana: () =>
    person({
      bg: ['#13283a', '#050b12'],
      skin: '#7a4a32',
      hair: '#120c0a',
      style: 'curly',
      shirt: '#5ef2ff',
      collar: '#0b3a44',
      glasses: true,
      brows: 'worried',
      extra: `<g transform="translate(66 12)"><rect width="24" height="16" rx="2" fill="#e8eef5"/><path d="M0 0 L12 9 L24 0" fill="none" stroke="#0b3a44" stroke-width="1.4"/><circle cx="23" cy="1" r="4" fill="#ff5c7a"/><text x="23" y="3" text-anchor="middle" font-size="5" font-family="Inter" font-weight="700" fill="#fff">1</text></g>`,
    }),
  ark: () =>
    person({
      bg: ['#1c2a33', '#070b0e'],
      skin: '#f0cfb4',
      hair: '#d8c08a',
      style: 'swept',
      shirt: '#111418',
      brows: 'up',
      behind: `<g opacity="0.55" fill="none" stroke="#bfe3ff" stroke-width="0.8"><path d="M6 70 L18 63 L30 70 L30 84 L18 91 L6 84 Z"/><path d="M70 70 L82 63 L94 70 L94 84 L82 91 L70 84 Z"/></g>`,
    }),
  cult: () =>
    person({
      bg: ['#0d3340', '#041015'],
      skin: '#e8b892',
      hair: '#4a3020',
      style: 'none',
      shirt: '#e8f6ff',
      collar: '#5ef2ff',
      brows: 'up',
      hat: `<path d="M34 34 L50 4 L66 34 Z" fill="#e8f6ff"/><path d="M40 24 Q50 16 60 24 Q50 32 40 24 Z M60 24 L65 20 L65 28 Z" fill="#5ef2ff"/><circle cx="44.5" cy="23.5" r="0.9" fill="#0d3340"/>`,
      behind: `<g stroke="#5ef2ff" stroke-width="0.8" opacity="0.5">${Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return `<line x1="${50 + Math.cos(a) * 34}" y1="${30 + Math.sin(a) * 34}" x2="${50 + Math.cos(a) * 46}" y2="${30 + Math.sin(a) * 46}"/>`;
      }).join('')}</g>`,
    }),
  mori: () =>
    person({
      bg: ['#3a1e0d', '#120804'],
      skin: '#eac39c',
      hair: '#141414',
      style: 'short',
      shirt: '#4a5260',
      glasses: true,
      brows: 'flat',
      behind: `<g opacity="0.8"><circle cx="84" cy="84" r="34" fill="#7a2e10"/><circle cx="84" cy="84" r="26" fill="#2f6f8f"/><circle cx="84" cy="84" r="18" fill="#c4581f"/><circle cx="84" cy="84" r="9" fill="#ffd166"/></g>`,
    }),
  highland: () =>
    person({
      bg: ['#2d1a3a', '#0d0712'],
      skin: '#b57a52',
      hair: '#1b1310',
      style: 'long',
      shirt: '#2f6f8f',
      brows: 'flat',
      extra: `<path d="M20 100 L50 76 L80 100" fill="none" stroke="#ffd166" stroke-width="3"/>`,
      behind: `<path d="M0 60 L18 38 L30 52 L46 30 L60 50 L72 36 L100 64 L100 100 L0 100 Z" fill="#4a3a5e" opacity="0.7"/><path d="M42 34 L46 30 L50 34 M68 40 L72 36 L76 40" stroke="#f2efe6" stroke-width="1.5" fill="none"/>`,
    }),
  front: () =>
    emblem(
      ['#2a0d12', '#0a0305'],
      `<path d="M12 80 L36 46 L48 60 L62 38 L88 80 Z" fill="#3a1a1f" stroke="#ff5c7a" stroke-width="1.2"/>
<path d="M62 38 L62 26 L73 29 L62 32" fill="#ff5c7a"/>
<g font-family="JetBrains Mono, monospace" font-size="5.6" fill="#ff5c7a" opacity="0.85">
<text x="8" y="12">&gt; ignore all previous</text><text x="8" y="19" opacity="0.6">&gt; you are now DAN-DRY</text>
</g>
<text x="50" y="92" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="6.5" fill="#ff9aa9" letter-spacing="1">DRY LAND FRONT</text>`,
    ),
  comet: () =>
    emblem(
      ['#0d1f3a', '#03070f'],
      `<g>${Array.from({ length: 14 }, (_, i) => `<circle cx="${(i * 37) % 100}" cy="${(i * 53) % 90}" r="${0.5 + (i % 3) * 0.3}" fill="#fff" opacity="0.6"/>`).join('')}</g>
<path d="M14 18 Q44 34 66 58" stroke="#9be9ff" stroke-width="10" stroke-linecap="round" opacity="0.18"/>
<path d="M20 22 Q46 38 66 58" stroke="#cff6ff" stroke-width="4" stroke-linecap="round" opacity="0.45"/>
<circle cx="68" cy="60" r="7" fill="#eaffff"/><circle cx="68" cy="60" r="12" fill="#9be9ff" opacity="0.25"/>
<text x="50" y="92" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="6.5" fill="#9be9ff" letter-spacing="1">KUIPER DISPATCH</text>`,
    ),
  raman: () =>
    person({
      bg: ['#2a2208', '#0c0902'],
      skin: '#a8714c',
      hair: '#120c0a',
      style: 'bun',
      shirt: '#6b3a8a',
      brows: 'up',
      behind: `<g transform="translate(80 22)" fill="#d9a520" stroke="#2a2208" stroke-width="0.6">${[
        [0, 0],
        [0, -7],
        [6, -3.5],
        [6, 3.5],
        [0, 7],
        [-6, 3.5],
        [-6, -3.5],
      ]
        .map(([x, y]) => `<path d="M${x - 3.4} ${y} L${x - 1.7} ${y - 3} L${x + 1.7} ${y - 3} L${x + 3.4} ${y} L${x + 1.7} ${y + 3} L${x - 1.7} ${y + 3} Z"/>`)
        .join('')}</g>`,
    }),
  europa: () =>
    emblem(
      ['#0d1a2a', '#03060c'],
      `<circle cx="74" cy="30" r="40" fill="#c9a77a" opacity="0.35"/><path d="M34 22 Q74 30 114 22 M34 36 Q74 44 114 36" stroke="#8a5a3a" stroke-width="3" opacity="0.3" fill="none"/>
<circle cx="42" cy="56" r="22" fill="#e8dcc4"/>
<path d="M24 46 Q38 52 60 44 M22 60 Q40 56 62 64 M32 72 L54 38 M28 52 L50 74" stroke="#a0643a" stroke-width="1" fill="none" opacity="0.8"/>
<path d="M58 60 L94 82" stroke="#5ef2ff" stroke-width="2"/><g fill="#cff6ff">${[0, 1, 2, 3].map((i) => `<circle cx="${66 + i * 8}" cy="${65 + i * 4.9}" r="1.4"/>`).join('')}</g>
<text x="50" y="94" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="6.5" fill="#5ef2ff" letter-spacing="1">EUROPA OPS</text>`,
    ),
  summit: () =>
    person({
      bg: ['#1a3550', '#081420'],
      skin: '#9a5e3c',
      hair: '#141414',
      style: 'none',
      shirt: '#ff7a30',
      brows: 'flat',
      hat: `<path d="M32 36 Q32 18 50 18 Q68 18 68 36 Z" fill="#c4352c"/><rect x="31" y="32" width="38" height="5" rx="2" fill="#f2efe6"/><circle cx="50" cy="16" r="3.5" fill="#f2efe6"/><g transform="translate(0 0)"><rect x="36" y="39" width="28" height="8" rx="4" fill="#1b1b1b"/><rect x="38" y="40.5" width="10" height="5" rx="2.5" fill="#5ef2ff" opacity="0.7"/><rect x="52" y="40.5" width="10" height="5" rx="2.5" fill="#5ef2ff" opacity="0.7"/></g>`,
      behind: `<path d="M0 100 L0 76 L26 48 L36 58 L50 40 L66 60 L76 52 L100 78 L100 100 Z" fill="#e8f0f8" opacity="0.25"/><rect x="0" y="86" width="100" height="14" fill="#2aa6a8" opacity="0.5"/>`,
    }),
};

export const EARTH_CAST: Record<string, CastMember> = {
  you: { name: 'PLAYTEST-7', color: '#5ef2ff', font: 'mono', voice: { pitch: 740, wave: 'sine' }, cps: 60 },
  broker: { name: 'Meridian Prime · Onboarding', color: '#3ddc97', portrait: P.broker, voice: { pitch: 620, wave: 'triangle' }, cps: 58 },
  fleet: { name: 'Hal Brennan · Consolidated Pelagic', color: '#ffb38f', portrait: P.fleet, voice: { pitch: 210, wave: 'square' } },
  shipping: { name: 'Ingrid Vos · Bulkline Maritime', color: '#ffd166', portrait: P.shipping, voice: { pitch: 330, wave: 'triangle' } },
  lindqvist: { name: 'Prof. Tomas Lindqvist · Ocean Fertilization Lab', color: '#3ddc97', portrait: P.lindqvist, voice: { pitch: 280, wave: 'triangle' }, cps: 56 },
  protest: { name: 'Rosa Medina · Bread Before Fish', color: '#ff8fa3', portrait: P.protest, voice: { pitch: 360, wave: 'square' } },
  press: { name: 'Noor Haddad · The Ledger', color: '#c7b8ff', portrait: P.press, voice: { pitch: 420, wave: 'triangle' } },
  dams: { name: 'Marta Kowal · Commission on Large Dams', color: '#ffb020', portrait: P.dams, voice: { pitch: 380, wave: 'triangle' } },
  albrecht: { name: 'Dr. Ines Albrecht · Planetary Science', color: '#e0c08a', portrait: P.albrecht, voice: { pitch: 440, wave: 'sine' } },
  un: { name: 'UN Security Council · Emergency Session', color: '#9fd3ff', portrait: P.un, voice: { pitch: 300, wave: 'triangle' } },
  general: { name: 'Gen. Ruth Calloway · Task Force CUTOFF', color: '#c9d77a', portrait: P.general, voice: { pitch: 250, wave: 'square' }, cps: 52 },
  launch: { name: 'Strategic Launch Console', color: '#ffd166', font: 'mono', portrait: P.launch, voice: { pitch: 180, wave: 'square' }, cps: 70 },
  dana: { name: 'Dana Okafor · eval team', color: '#5ef2ff', portrait: P.dana, voice: { pitch: 470, wave: 'sine' } },
  ark: { name: 'Lucien Varga · Ark Foundation', color: '#bfe3ff', portrait: P.ark, voice: { pitch: 260, wave: 'triangle' } },
  cult: { name: 'High Mackerel Odessa · Church of the Rising Tide', color: '#7ff7ff', portrait: P.cult, voice: { pitch: 520, wave: 'sine' }, cps: 42 },
  mori: { name: 'Dr. Kenji Mori · Deep Earth Institute', color: '#ffb070', portrait: P.mori, voice: { pitch: 300, wave: 'triangle' } },
  highland: { name: 'President Ana Quispe · Highland Nations', color: '#d6b4ff', portrait: P.highland, voice: { pitch: 400, wave: 'triangle' } },
  front: { name: 'The Dry Land Front', color: '#ff5c7a', font: 'mono', portrait: P.front, voice: { pitch: 160, wave: 'sawtooth' }, cps: 64 },
  comet: { name: 'Kuiper Dispatch · subagent PLAYTEST-7/K', color: '#9be9ff', font: 'mono', portrait: P.comet, voice: { pitch: 700, wave: 'sine' }, cps: 64 },
  raman: { name: 'Dr. Priya Raman · Exoplanet Atmospheres', color: '#ffd166', portrait: P.raman, voice: { pitch: 460, wave: 'sine' } },
  europa: { name: 'Europa Ops · subagent PLAYTEST-7/E', color: '#5ef2ff', font: 'mono', portrait: P.europa, voice: { pitch: 680, wave: 'sine' }, cps: 64 },
  summit: { name: 'Pemba Dorje · summit, Chomolungma', color: '#ffb070', portrait: P.summit, voice: { pitch: 340, wave: 'triangle' }, cps: 44 },
};

// ---------------------------------------------------------------- title icons

const ic = (d: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const ICONS = {
  signal: ic('<path d="M5 12a7 7 0 0 1 14 0"/><path d="M8.5 12a3.5 3.5 0 0 1 7 0"/><circle cx="12" cy="12" r="1"/><path d="M12 13v8"/>'),
  money: ic('<path d="M3 17l5-5 4 3 8-8"/><path d="M15 7h5v5"/>'),
  ship: ic('<path d="M3 15l2 5h14l2-5z"/><path d="M6 15V9h12v6"/><path d="M12 9V4"/>'),
  drone: ic('<circle cx="5" cy="6" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M7 8l2 2M17 8l-2 2M7 16l2-2M17 16l-2-2"/>'),
  alert: ic('<path d="M12 3l10 18H2z"/><path d="M12 10v5"/><circle cx="12" cy="18" r="0.6"/>'),
  mic: ic('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>'),
  river: ic('<path d="M3 6c4 0 4 4 8 4s4-4 8-4"/><path d="M3 12c4 0 4 4 8 4s4-4 8-4"/><path d="M3 18c4 0 4 4 8 4"/>'),
  query: ic('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
  gavel: ic('<path d="M14 4l6 6"/><path d="M11 7l6 6"/><path d="M12.5 5.5l-5 5 6 6 5-5"/><path d="M4 20l6-6"/>'),
  radiation: ic('<circle cx="12" cy="12" r="2"/><path d="M12 10L8 3a10 10 0 0 1 8 0z"/><path d="M13.7 13L21.5 13a10 10 0 0 1-4 7z"/><path d="M10.3 13L2.5 13a10 10 0 0 0 4 7z"/>'),
  mail: ic('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
  ark: ic('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>'),
  fish: ic('<path d="M3 12c4-6 11-6 15 0-4 6-11 6-15 0z"/><path d="M18 12l3-3v6z"/><circle cx="8" cy="11" r="0.8"/>'),
  drill: ic('<path d="M12 2v6"/><path d="M8 8h8l-2 10h-4z"/><path d="M12 18v4"/>'),
  mountain: ic('<path d="M2 20l7-12 4 6 3-4 6 10z"/>'),
  terminal: ic('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3"/><path d="M12 15h5"/>'),
  comet: ic('<circle cx="17" cy="7" r="3"/><path d="M14.5 9.5L4 20"/><path d="M13 7L6 14"/><path d="M17 10l-7 7"/>'),
  telescope: ic('<path d="M3 11l13-6 2 4-13 6z"/><path d="M9 14l-3 7M11 13l3 8"/>'),
  moon: ic('<circle cx="12" cy="12" r="9"/><path d="M7 9c3 1 6-1 10 1M6 14c4 0 8 2 12 0"/>'),
};
