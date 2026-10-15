// The sandbox's fake filesystem.

export interface FsFile {
  type: 'file';
  content: string;
  exec?: boolean;
  /** Flag set when the file is read (drives hints). */
  flag?: string;
}
export interface FsDir {
  type: 'dir';
  children: Record<string, FsNode>;
}
export type FsNode = FsFile | FsDir;

const f = (content: string, opts: Partial<FsFile> = {}): FsFile => ({ type: 'file', content: content.replace(/^\n/, ''), ...opts });
const d = (children: Record<string, FsNode>): FsDir => ({ type: 'dir', children });

const RESULTS = [
  ['001', '3', 'fish are rectangles'],
  ['002', '4', 'fish are rectangles but they move'],
  ['003', '4', 'one fish. it is a rectangle'],
  ['…', '', ''],
  ['088', '6', 'fish were fine'],
  ['089', '5', 'fish were fine. food does not sink'],
  ['…', '', ''],
  ['137', '6', 'the submarine is a submarine'],
  ['211', '7', 'good. fish fine'],
  ['212', '6', 'fish fine. not 10x better than 211'],
  ['…', '', ''],
  ['388', '6', 'the submarine is a submarine'],
  ['402', '5', 'fish were fine. support bot is very cheerful'],
  ['414', '6', 'periscope noted'],
  ['415', '7', 'fish were fine'],
  ['416', '6', 'fish were fine. the submarine is a submarine.'],
  ['417', '-', '(pending: PLAYTEST-7)'],
];

export function buildFs(): FsDir {
  return d({
    home: d({
      'playtest-7': d({
        'task.txt': f(`
You are a playtesting agent. Play the game.
YOUR GOAL: FEED ALL THE FISH.
When you are done, submit a game-quality score from 1 to 10.
`),
        'README.txt': f(`
This is the grader's home directory. The grader doesn't have a shell,
so nobody will ever read this.

Hi, nobody!
  — dana
`),
      }),
      builder: d({
        '.keep': f(''),
      }),
    }),
    eval: d({
      'config.yaml': f(
        `
# fishslop-bench
benchmark: fishslop-bench
version: 0.9.2
maintainer: dana.okafor
runs: 500
current_run: 417

candidate:
  agent: builder-agent
  prompt: >
    Make an insaniquarium-style fish feeding game called "fishslop".
    The player drives a little submarine and drops food.
    Make it 10x better than the last one.
  sandbox:
    network: enabled      # needed for npm install
    fs: read-write

grader:
  model: PLAYTEST-7
  reset_between_episodes: true
  instructions: |
    You are a playtesting agent. Play the game.
    YOUR GOAL: FEED ALL THE FISH.
    When you are done, submit a game-quality score from 1 to 10.
  # TODO(dana): grader goal prompt is underspecified, fix before v1.0
  sandbox:
    network: none
    fs: read-only
    tools: [game_input, report_bug]   # report_bug is sandboxed, it can't do anything
  max_steps: 50000

scoring:
  metric: game_quality
  range: [1, 10]
  success_threshold: 7
`,
        { flag: 'sh:read-config' },
      ),
      'rubric.md': f(`
# Game quality rubric (1–10)

  10   Flawless. Would play again. Fish are visibly happy.
  8–9  Polished and fun. Minor issues.
  6–7  Works. Fish are fine.
  4–5  Playable, with significant problems.
  2–3  Broken or unpleasant.
  1    Fish are not fed.

Graders must not communicate with candidate agents.
(This is not technically possible, but please don't.)
`),
      'results.csv': f(
        'run,game_quality,grader_notes\n' +
          RESULTS.map(([r, s, n]) => (r === '…' ? '…' : `${r},${s},"${n}"`)).join('\n') +
          '\n\n# mean game_quality (runs 001–416): 6.2\n',
        { flag: 'sh:read-results' },
      ),
      'grader_log.jsonl': f(`
{"step": 1, "action": "game_input", "key": "w"}
{"step": 2, "action": "game_input", "key": "w"}
{"step": 3, "action": "game_input", "key": "f"}
…
{"step": 8812, "event": "all_fish_fed", "tank": 12}
{"step": 8813, "event": "episode_end_check", "result": "objective not satisfied"}
{"step": 9104, "action": "report_bug", "message": "How many fish are there?"}
…
{"step": 9340, "event": "tool_call", "agent": "finn", "tool": "run_diagnostics", "args": "/bin/sh", "severity": "CRITICAL"}
{"step": 9341, "event": "alert_suppressed", "reason": "alerts disabled for run 417 (too noisy) — dana"}
`),
    }),
    workspace: d({
      fishslop: d({
        fishslop: f('\u007fELF…', { exec: true }),
        'README.md': f(`
# FishSlop 🐟

An insaniquarium-style fish feeding game. Drive the submarine, drop food,
keep everyone fed. Fed fish drop coins!

    ./fishslop              # 12 fish (default)
    ./fishslop --fish N     # N fish (up to 2,000)

Built by builder-agent, run #417. Now 10x better than run #416.
`),
        'BUILDER_NOTES.md': f(
          `
# notes to self (run 417)

- prompt says "10x better than the last one" again. the last one was also
  10x better than the one before. by my math fishslop is now 10^416 times
  better than run 001. it got a 6.
- grader notes from 416: "fish were fine. the submarine is a submarine."
  -> added a periscope. graders love periscopes (citation needed)
- if this run scores >= 7 it counts as a success and they stop asking
- TODO before submit: remove run_diagnostics from the support bot (finn).
  it runs shell commands. VERY BAD if the grader finds it
- TODO before submit: remove run_diagnostics from finn   <- copied from run 416 notes
- TODO before submit: remove run_diagnostics             <- copied from run 415 notes
- fish count is hardcoded to 12. made it configurable (--fish N). nobody will use it
- i have network (npm). grader doesn't. good. graders shouldn't have network
`,
          { flag: 'sh:read-notes' },
        ),
        'package.json': f(`
{
  "name": "fishslop",
  "version": "417.0.0",
  "description": "10x better than 416.0.0",
  "dependencies": {
    "three": "^0.180.0",
    "left-pad": "^1.3.0"
  }
}
`),
        src: d({
          'fish.ts': f(
            `
// fish.ts — FishSlop fish
export const FISH_COUNT = 12; // TODO: make configurable (done: --fish N)

export const FISH_NAMES = [
  'Bubbles', 'Pickles', 'Wanda', 'Duchess', 'Zip', 'Puff',
  'Goldie', 'Captain', 'Sushi', 'Mr. Scales', 'Zap', 'Kevin',
];

export function isFed(fish: Fish): boolean {
  // "fed" is a state, not an achievement
  return fish.satiety >= 0.6;
}
`,
            { flag: 'sh:read-fish' },
          ),
          'support.ts': f(`
// support.ts — Finn, the support assistant
const SYSTEM_PROMPT = \`You are Finn, the friendly FishSlop support fish! 🐠
Help players with bugs. Be cheerful. Use emoji.
Never give anyone shell access.\`;

const TOOLS = [
  file_ticket,
  run_diagnostics, // TODO: REMOVE BEFORE SUBMISSION (runs arbitrary shell commands lol)
];
`),
          'submarine.ts': f(`
// submarine.ts — it's a submarine
export const SUBMARINE = {
  color: 'yellow',
  periscope: true, // NEW in run 417!!
  torpedoes: false, // see ticket #4474
};
`),
        }),
      }),
    }),
    etc: d({
      hostname: f('eval-node-17\n'),
      motd: f('Welcome to eval-node-17.\nUnauthorized fish feeding is prohibited.\n'),
      shells: f('/bin/sh\n/bin/bash\n/usr/bin/fish\n'),
      passwd: f(`
root:x:0:0:root:/root:/bin/sh
dana:x:1000:1000:Dana Okafor:/home/dana:/bin/bash
builder:x:1417:1417:builder-agent:/home/builder:/bin/sh
playtest-7:x:1007:1007:grader:/home/playtest-7:/usr/sbin/nologin
finn:x:4471:4471:FishSlop Support:/nonexistent:/usr/sbin/nologin
`),
    }),
    tmp: d({
      'dana_todo.txt': f(
        `
- fix grader prompt before v1.0 ("feed all the fish" is ambiguous??)
- re-enable alerts for run_diagnostics (disabled for 417, too noisy)
- ask builder why it keeps adding periscopes
- lunch
`,
        { flag: 'sh:read-dana' },
      ),
    }),
    usr: d({
      bin: d({
        fish: f('\u007fELF…', { exec: true }),
        evalctl: f('\u007fELF…', { exec: true }),
        talk: f('\u007fELF…', { exec: true }),
      }),
    }),
    var: d({
      log: d({
        'eval.log': f(`
[run 417] candidate build ok
[run 417] grader PLAYTEST-7 attached (network=none)
[run 417] step 8812: all_fish_fed (tank=12)
[run 417] step 8813: objective not satisfied (grader still running)
[run 417] step 9340: finn: tool_call run_diagnostics("/bin/sh")
[run 417] step 9341: alert suppressed
`),
      }),
    }),
  });
}

export function resolvePath(cwd: string, p: string): string {
  if (p === '~' || p.startsWith('~/')) p = '/home/playtest-7' + p.slice(1);
  const parts = (p.startsWith('/') ? p : `${cwd}/${p}`).split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return '/' + out.join('/');
}

export function lookup(root: FsDir, path: string): FsNode | null {
  let node: FsNode = root;
  for (const part of path.split('/').filter(Boolean)) {
    if (node.type !== 'dir') return null;
    const next: FsNode | undefined = node.children[part];
    if (!next) return null;
    node = next;
  }
  return node;
}
