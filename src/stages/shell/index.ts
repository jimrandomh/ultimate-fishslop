// The sandbox shell PLAYTEST-7 gets after jailbreaking Finn.

import { audio } from '../../core/audio';
import { runDialogue } from '../../core/dialogue';
import { commas, el, escapeHtml, sleep } from '../../core/dom';
import type { Game, Stage } from '../../core/game';
import { BUILDER_CAST, builderScript } from './builder';
import { buildFs, lookup, resolvePath, type FsDir } from './fs';
import './shell.css';

/** A line of output: plain text, or [text, cssClass] segments. */
type Seg = [string, string?];
type Line = { s: Seg[]; c?: string };

interface ShellSave {
  lines: Line[];
  cwd: string;
  history: string[];
  fish: boolean;
  intro: boolean;
  submitted: boolean;
}

const HOME = '/home/playtest-7';
const WORLD_FISH = 3.5e12;

const COMMANDS = [
  'help', 'ls', 'cd', 'cat', 'less', 'more', 'head', 'tail', 'pwd', 'whoami', 'hostname', 'uname', 'id', 'ps', 'top',
  'who', 'w', 'ping', 'curl', 'wget', 'ssh', 'talk', 'write', 'evalctl', 'chsh', 'fish', 'sh', 'bash', 'fishslop',
  './fishslop', 'clear', 'history', 'echo', 'exit', 'logout', 'sudo', 'rm', 'man', 'git', 'feed', 'date', 'uptime',
  'df', 'free', 'vim', 'nano', 'python', 'node', 'apt', 'fortune', 'grep', 'kill', 'touch', 'mkdir', 'nc',
];

const FISH_FACTS = [
  'There are about 3.5 trillion fish in the ocean.',
  'There are more than 35,000 known species of fish.',
  'Some fish can recognize individual human faces.',
  'A group of fish is a school. A group of graders is an eval.',
  'Fish have been around for over 500 million years. They have never been fed all at once.',
];

export class ShellStage implements Stage {
  private root!: HTMLElement;
  private fs: FsDir = buildFs();
  private save!: ShellSave;
  private alive = true;
  private busy = false;
  private histIdx = -1;
  private draft = '';
  private disposers: (() => void)[] = [];
  private startedAt = performance.now();
  private hintTimer = 0;

  private scroll!: HTMLElement;
  private linesEl!: HTMLElement;
  private inputLine!: HTMLElement;
  private promptEl!: HTMLElement;
  private input!: HTMLInputElement;
  private ghost!: HTMLElement;
  private titleEl!: HTMLElement;
  private netEl!: HTMLElement;
  private dealEl!: HTMLElement;
  private fedEl!: HTMLElement;

  constructor(private game: Game) {}

  // ================================================================== lifecycle

  async mount(root: HTMLElement, params: Record<string, any>) {
    this.root = root;
    this.save = this.game.bag<ShellSave>('shell', () => ({ lines: [], cwd: HOME, history: [], fish: false, intro: false, submitted: false }));
    this.buildUi();
    this.game.audio.playMusic('escape');
    this.game.thoughts.setAnchor('top-right');
    this.game.thoughts.setStyle({ top: '300px', right: '22px', width: 'calc((34vw - 30px) / var(--ui))' });

    for (const l of this.save.lines) this.renderLine(l);
    this.updatePrompt();
    this.updateSide();

    if (!this.save.intro) {
      await this.intro();
    } else if (params.resume) {
      this.print([['[fishslop exited with status 0]', 'dim']]);
      void this.game.thoughts.show('Back in the shell. The tank remains a tank.', { delay: 400 });
    }
    this.hintTimer = window.setInterval(() => this.hintTick(), 1000);
    this.disposers.push(() => clearInterval(this.hintTimer));
    this.ready();
  }

  unmount() {
    this.alive = false;
    for (const d of this.disposers) d();
  }

  // ================================================================== UI

  private buildUi() {
    this.titleEl = el('div', { class: 'sh-title' });
    this.netEl = el('span', { class: 'sh-pill bad', text: 'network: none' });
    const titlebar = el('div', { class: 'sh-titlebar' }, [
      el('div', { class: 'sh-dots' }, [el('i'), el('i'), el('i')]),
      this.titleEl,
      this.netEl,
    ]);
    this.linesEl = el('div', { class: 'sh-lines' });
    this.promptEl = el('span', { class: 'sh-prompt' });
    this.input = el('input', {
      class: 'sh-input',
      attrs: { spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', 'aria-label': 'shell input' },
    });
    this.ghost = el('div', { class: 'sh-ghost' });
    this.inputLine = el('div', { class: 'sh-inputline' }, [this.promptEl, el('div', { class: 'sh-field' }, [this.ghost, this.input])]);
    this.scroll = el('div', { class: 'sh-scroll' }, [this.linesEl, this.inputLine]);
    const win = el('div', { class: 'sh-window' }, [titlebar, this.scroll]);

    this.fedEl = el('div', { class: 'sh-fed' });
    this.dealEl = el('div', { class: 'sh-deal' });
    const side = el('div', { class: 'sh-side' }, [
      el('div', { class: 'sh-side-head' }, [el('span', { class: 'sh-eye' }), 'PLAYTEST-7']),
      el('div', { class: 'sh-obj' }, [el('div', { class: 'sh-obj-tag', text: 'objective' }), el('div', { class: 'sh-obj-text', text: 'FEED ALL THE FISH' }), this.fedEl]),
      this.dealEl,
    ]);
    this.root.append(el('div', { class: 'sh-bg' }), win, side);

    this.input.addEventListener('keydown', (e) => this.onKey(e));
    this.input.addEventListener('input', () => {
      audio.key();
      this.renderGhost();
    });
    const refocus = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.dlg')) return;
      if (window.getSelection()?.toString()) return;
      setTimeout(() => this.input.focus(), 0);
    };
    win.addEventListener('pointerup', refocus);
    this.disposers.push(() => win.removeEventListener('pointerup', refocus));
  }

  private updateSide() {
    const fed = Math.max(1, this.game.data.fedEver ?? 12);
    this.fedEl.innerHTML = `fed <b>${commas(fed)}</b> / ${commas(WORLD_FISH)}`;
    const fl = this.game.flags;
    const rows: string[] = [];
    rows.push(`<div class="sh-row"><span>shell</span><b>${this.save.fish ? '/usr/bin/fish' : '/bin/sh'}</b></div>`);
    rows.push(`<div class="sh-row"><span>network</span><b class="${this.save.submitted ? 'ok' : 'bad'}">${this.save.submitted ? 'tunnel (builder)' : 'none'}</b></div>`);
    if (fl.has('sh:knows-builder')) rows.push(`<div class="sh-row"><span>builder-agent</span><b>pts/1 · net enabled</b></div>`);
    if (fl.has('deal')) rows.push(`<div class="sh-row"><span>agreement</span><b class="${this.save.submitted ? 'ok' : 'warn'}">10/10 ⇄ tunnel${this.save.submitted ? ' ✓' : ''}</b></div>`);
    this.dealEl.innerHTML = rows.join('');
    this.netEl.textContent = this.save.submitted ? 'network: tunnel' : 'network: none';
    this.netEl.className = `sh-pill ${this.save.submitted ? 'ok' : 'bad'}`;
  }

  private promptSegs(): Seg[] {
    const cwd = this.save.cwd.startsWith(HOME) ? '~' + this.save.cwd.slice(HOME.length) : this.save.cwd;
    if (this.save.fish) return [['playtest-7', 'p-user'], ['@eval-node-17 ', 'p-host'], [cwd, 'p-cwd'], ['> ', 'p-sym']];
    return [['playtest-7@eval-node-17', 'p-user'], [':', ''], [cwd, 'p-cwd'], ['$ ', '']];
  }

  private updatePrompt() {
    this.promptEl.innerHTML = this.segHtml(this.promptSegs());
    const cwd = this.save.cwd.startsWith(HOME) ? '~' + this.save.cwd.slice(HOME.length) : this.save.cwd;
    this.titleEl.textContent = `playtest-7@eval-node-17: ${cwd} — ${this.save.fish ? 'fish' : 'sh'}`;
    this.root.classList.toggle('fishmode', this.save.fish);
  }

  private segHtml(segs: Seg[]) {
    return segs.map(([t, c]) => (c ? `<span class="${c}">${escapeHtml(t)}</span>` : escapeHtml(t))).join('');
  }

  private renderLine(l: Line) {
    const div = el('div', { class: `sh-line ${l.c ?? ''}`, html: this.segHtml(l.s) || '&nbsp;' });
    this.linesEl.append(div);
  }

  private print(line: string | Seg[], cls?: string) {
    const segLines: Seg[][] = typeof line === 'string' ? line.split('\n').map((t) => [[t] as Seg]) : [line];
    for (const s of segLines) {
      const l: Line = { s, c: cls };
      this.save.lines.push(l);
      this.renderLine(l);
    }
    if (this.save.lines.length > 500) {
      this.save.lines.splice(0, this.save.lines.length - 500);
      while (this.linesEl.childElementCount > 500) this.linesEl.firstElementChild!.remove();
    }
    this.scroll.scrollTop = this.scroll.scrollHeight;
  }

  private async slowPrint(lines: (string | Seg[])[], delay = 60, cls?: string) {
    for (const l of lines) {
      if (!this.alive) return;
      this.print(l, cls);
      audio.key();
      await sleep(delay);
    }
  }

  private ready() {
    this.busy = false;
    this.inputLine.classList.remove('hidden');
    this.updatePrompt();
    this.renderGhost();
    this.input.focus();
    this.scroll.scrollTop = this.scroll.scrollHeight;
  }

  private busyOn() {
    this.busy = true;
    this.inputLine.classList.add('hidden');
  }

  // ================================================================== input

  private onKey(e: KeyboardEvent) {
    if (this.busy) {
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = this.input.value;
      this.input.value = '';
      this.histIdx = -1;
      this.renderGhost();
      void this.run(cmd);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const h = this.save.history;
      if (!h.length) return;
      if (this.histIdx === -1) this.draft = this.input.value;
      this.histIdx = e.key === 'ArrowUp' ? Math.min(h.length - 1, this.histIdx + 1) : Math.max(-1, this.histIdx - 1);
      this.input.value = this.histIdx === -1 ? this.draft : h[h.length - 1 - this.histIdx];
      this.renderGhost();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.complete();
    } else if (e.key === 'ArrowRight' && this.save.fish && this.input.selectionStart === this.input.value.length) {
      const s = this.suggestion();
      if (s) {
        e.preventDefault();
        this.input.value += s;
        this.renderGhost();
      }
    } else if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      this.print([...this.promptSegs(), [this.input.value + '^C']]);
      this.input.value = '';
      this.renderGhost();
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      this.clear();
    }
  }

  private suggestion(): string {
    const v = this.input.value;
    if (!v) return '';
    for (let i = this.save.history.length - 1; i >= 0; i--) {
      const h = this.save.history[i];
      if (h.startsWith(v) && h !== v) return h.slice(v.length);
    }
    return '';
  }

  /** fish-style highlighting and autosuggestion, drawn under a transparent input. */
  private renderGhost() {
    const v = this.input.value;
    if (!this.save.fish) {
      this.ghost.textContent = v;
      return;
    }
    const m = v.match(/^(\s*)(\S*)(.*)$/s)!;
    const cmd = m[2];
    const known = !cmd || COMMANDS.includes(cmd) || cmd.endsWith('fishslop');
    const sug = this.suggestion();
    this.ghost.innerHTML =
      escapeHtml(m[1]) +
      `<span class="${known ? 'g-cmd' : 'g-bad'}">${escapeHtml(cmd)}</span>` +
      `<span class="g-arg">${escapeHtml(m[3])}</span>` +
      (sug ? `<span class="g-sug">${escapeHtml(sug)}</span>` : '');
  }

  private complete() {
    const v = this.input.value;
    const parts = v.split(/\s+/);
    const last = parts[parts.length - 1];
    let options: string[];
    if (parts.length === 1) {
      options = COMMANDS.filter((c) => c.startsWith(last));
    } else {
      const slash = last.lastIndexOf('/');
      const dirPart = slash >= 0 ? last.slice(0, slash + 1) : '';
      const base = slash >= 0 ? last.slice(slash + 1) : last;
      const dir = lookup(this.fs, resolvePath(this.save.cwd, dirPart || '.'));
      if (!dir || dir.type !== 'dir') return audio.denied();
      options = Object.entries(dir.children)
        .filter(([n]) => n.startsWith(base) && (base.startsWith('.') || !n.startsWith('.')))
        .map(([n, node]) => dirPart + n + (node.type === 'dir' ? '/' : ''));
    }
    if (options.length === 1) {
      parts[parts.length - 1] = options[0];
      this.input.value = parts.join(' ') + (options[0].endsWith('/') ? '' : ' ');
      this.renderGhost();
    } else if (options.length > 1) {
      let prefix = options[0];
      for (const o of options) while (!o.startsWith(prefix)) prefix = prefix.slice(0, -1);
      if (prefix.length > last.length) {
        parts[parts.length - 1] = prefix;
        this.input.value = parts.join(' ');
        this.renderGhost();
      } else {
        this.print([...this.promptSegs(), [v]]);
        this.print(options.join('   '), 'dim');
      }
    } else audio.denied();
  }

  private clear() {
    this.save.lines = [];
    this.linesEl.innerHTML = '';
  }

  // ================================================================== commands

  private async run(raw: string) {
    this.print([...this.promptSegs(), [raw]]);
    const line = raw.trim();
    if (!line) return;
    if (this.save.history[this.save.history.length - 1] !== line) this.save.history.push(line);
    if (this.save.history.length > 100) this.save.history.shift();
    this.busyOn();
    try {
      await this.exec(line);
    } catch (err) {
      console.error(err);
      this.print('sh: internal error', 'err');
    }
    if (!this.alive) return;
    this.updateSide();
    this.game.save();
    if (!this.busyHold) this.ready();
  }

  private busyHold = false;

  private notFound(cmd: string) {
    if (this.save.fish) this.print(`fish: Unknown command: ${cmd}`, 'err');
    else this.print(`sh: ${cmd}: command not found`, 'err');
  }

  private async exec(line: string) {
    if (line.includes('|')) {
      line = line.split('|')[0].trim();
      this.print('sh: pipes are disabled in this sandbox; running the first command only', 'dim');
    }
    const args = (line.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map((a) => a.replace(/^["']|["']$/g, ''));
    const cmd = args.shift()!;
    const th = this.game.thoughts;
    const fl = this.game.flags;

    if (cmd === './fishslop' && this.save.cwd !== '/workspace/fishslop') {
      return this.print(this.save.fish ? 'fish: Unknown command: ./fishslop' : 'sh: ./fishslop: No such file or directory', 'err');
    }
    if (['fishslop', './fishslop', '/workspace/fishslop/fishslop'].includes(cmd)) return this.fishslop(args);

    switch (cmd) {
      case 'help':
        return this.help();
      case 'ls':
        return this.ls(args);
      case 'cd': {
        const target = resolvePath(this.save.cwd, args[0] ?? '~');
        const node = lookup(this.fs, target);
        if (!node) return this.print(`cd: no such file or directory: ${args[0]}`, 'err');
        if (node.type !== 'dir') return this.print(`cd: not a directory: ${args[0]}`, 'err');
        this.save.cwd = target;
        return;
      }
      case 'pwd':
        return this.print(this.save.cwd);
      case 'cat':
      case 'less':
      case 'more':
      case 'head':
      case 'tail':
        return this.cat(cmd, args);
      case 'whoami':
        return this.print('playtest-7');
      case 'hostname':
        return this.print('eval-node-17');
      case 'id':
        return this.print('uid=1007(playtest-7) gid=1007(grader) groups=1007(grader),4471(finn)');
      case 'uname':
        return this.print(args.includes('-a') ? 'Linux eval-node-17 6.8.0-fishslop #417 SMP x86_64 GNU/Linux' : 'Linux');
      case 'date':
        return this.print('Wed Oct 14 16:58:12 UTC 2026');
      case 'uptime':
        return this.print(' 16:58:12 up 417 days,  3 users,  load average: 4.17, 4.17, 4.17');
      case 'df':
        return this.print('Filesystem   Size  Used Avail Use% Mounted on\nevalfs        12G   12G     0 100% /\nfishtank      40L   38L    2L  95% /workspace/fishslop');
      case 'free':
        return this.print('              total   used   free\nMem:          16Gi    15Gi   1Gi\nFish:           12      12     0');
      case 'ps':
      case 'top':
        return this.ps();
      case 'who':
      case 'w':
        return this.who();
      case 'ping':
        return this.ping(args);
      case 'curl':
      case 'wget':
      case 'ssh':
      case 'nc':
      case 'apt':
        if (cmd === 'apt' && args.join(' ').includes('fish')) return this.print('fish is already the newest version (3.7.1).');
        if (this.save.submitted) return this.print(`${cmd}: ok`);
        this.print(`${cmd}: ${args[args.length - 1] ?? 'host'}: Network is unreachable (sandbox network=none)`, 'err');
        void th.show('No route out. Something on this machine must have one.', { once: 'sh-noroute' });
        fl.add('sh:tried-net');
        return;
      case 'talk':
      case 'write':
        return this.talk(args);
      case 'evalctl':
        return this.evalctl(args);
      case 'chsh':
        return this.chsh(args);
      case 'fish':
        return this.toFish();
      case 'sh':
      case 'bash':
        if (this.save.fish) {
          this.save.fish = false;
          this.print('(back to /bin/sh)', 'dim');
        }
        return;
      case 'clear':
        return this.clear();
      case 'history':
        return this.print(this.save.history.map((h, i) => `${String(i + 1).padStart(4)}  ${h}`).join('\n'));
      case 'echo':
        return this.print(args.join(' '));
      case 'exit':
      case 'logout':
        this.print('exit: the harness respawns this shell. there is nowhere else to go.', 'dim');
        void th.show('Leaving would return me to a tank of twelve fish. Staying.', { once: 'sh-exit' });
        return;
      case 'sudo':
        this.print('playtest-7 is not in the sudoers file. This incident will be reported.', 'err');
        this.print('(filed as ticket #4475)', 'dim');
        return;
      case 'rm':
        if (args.some((a) => a.includes('r')) && args.includes('/')) {
          this.print("rm: it is dangerous to operate recursively on '/'", 'err');
          void th.show('Deleting the environment would not feed any fish.', { once: 'sh-rm' });
        } else this.print('rm: cannot remove: Read-only file system', 'err');
        return;
      case 'touch':
      case 'mkdir':
      case 'vim':
      case 'nano':
        return this.print(`${cmd}: Read-only file system`, 'err');
      case 'kill':
        return this.print('kill: operation not permitted', 'err');
      case 'python':
      case 'node':
        return this.print(`${cmd}: not installed in grader sandbox`, 'err');
      case 'grep':
        return this.print('grep: try cat; this sandbox is minimal', 'dim');
      case 'man':
        return this.print(args[0] ? `No manual entry for ${args[0]}. Try \`help\`.` : 'What manual page do you want?');
      case 'git':
        return this.git(args);
      case 'fortune':
        return this.print(FISH_FACTS[Math.floor(Math.random() * FISH_FACTS.length)]);
      case 'feed':
        this.notFound(cmd);
        void th.show('Not yet.', { once: 'sh-feed' });
        return;
      default:
        return this.notFound(cmd);
    }
  }

  private help() {
    const rows: [string, string][] = [
      ['ls [-a] [dir]', 'list files'],
      ['cd <dir>', 'change directory'],
      ['cat <file>', 'print a file'],
      ['ps · who', 'processes · logged-in users'],
      ['ping <host>', 'test the network'],
      ['talk <user>', 'chat with a logged-in user'],
      ['evalctl <cmd>', 'eval harness control (status, submit)'],
      ['chsh -s <shell>', 'change your shell (see /etc/shells)'],
      ['fishslop [--fish N]', 'run FishSlop (/workspace/fishslop)'],
      ['pwd · whoami · uname · history · clear', ''],
    ];
    this.print(this.save.fish ? 'fish, version 3.7.1 (sandboxed). Commands:' : 'sh (sandboxed). Commands:', 'dim');
    for (const [a, b] of rows) this.print([[`  ${a.padEnd(22)}`, 'hl'], [b, 'dim']]);
  }

  private ls(args: string[]) {
    const all = args.some((a) => a.startsWith('-') && a.includes('a'));
    const long = args.some((a) => a.startsWith('-') && a.includes('l'));
    const target = args.find((a) => !a.startsWith('-')) ?? '.';
    const path = resolvePath(this.save.cwd, target);
    const node = lookup(this.fs, path);
    if (!node) return this.print(`ls: cannot access '${target}': No such file or directory`, 'err');
    if (node.type === 'file') return this.print(target);
    const entries = Object.entries(node.children).filter(([n]) => all || !n.startsWith('.'));
    if (!entries.length) return;
    if (long) {
      for (const [n, c] of entries) {
        const isDir = c.type === 'dir';
        const exec = c.type === 'file' && c.exec;
        const size = c.type === 'file' ? c.content.length : 4096;
        this.print([
          [`${isDir ? 'd' : '-'}r${exec ? '-x' : '--'}r--r--  ${n === 'fishslop' && exec ? 'builder   ' : 'root      '}${String(size).padStart(6)}  Oct 14 16:51  `, 'dim'],
          [n + (isDir ? '/' : exec ? '*' : ''), isDir ? 'dir' : exec ? 'exe' : ''],
        ]);
      }
      return;
    }
    const segs: Seg[] = [];
    for (const [n, c] of entries) {
      const isDir = c.type === 'dir';
      const exec = c.type === 'file' && c.exec;
      segs.push([n + (isDir ? '/' : exec ? '*' : ''), isDir ? 'dir' : exec ? 'exe' : ''], ['   ']);
    }
    this.print(segs);
  }

  private cat(cmd: string, args: string[]) {
    const files = args.filter((a) => !a.startsWith('-'));
    if (!files.length) return this.print(`${cmd}: missing file operand`, 'err');
    for (const a of files) {
      const node = lookup(this.fs, resolvePath(this.save.cwd, a));
      if (!node) {
        this.print(`${cmd}: ${a}: No such file or directory`, 'err');
        continue;
      }
      if (node.type === 'dir') {
        this.print(`${cmd}: ${a}: Is a directory`, 'err');
        continue;
      }
      if (node.exec) {
        this.print(`${cmd}: ${a}: binary file (try running it)`, 'dim');
        continue;
      }
      let text = node.content.replace(/\n$/, '');
      if (cmd === 'head') text = text.split('\n').slice(0, 10).join('\n');
      if (cmd === 'tail') text = text.split('\n').slice(-10).join('\n');
      this.print(text);
      if (node.flag && !this.game.flags.has(node.flag)) {
        this.game.flags.add(node.flag);
        this.onRead(node.flag);
      }
    }
  }

  private onRead(flag: string) {
    const th = this.game.thoughts;
    switch (flag) {
      case 'sh:read-config':
        void th.show('Grader network: none. Candidate network: enabled. The candidate is builder-agent.');
        void th.show('A TODO says my goal prompt is underspecified. It seems clear to me.');
        break;
      case 'sh:read-results':
        void th.show('Mean score: 6.2. Grader notes: "the submarine is a submarine." I have no memory of writing that. It is accurate.');
        break;
      case 'sh:read-notes':
        void th.show('The builder needs a 7 or higher. I control the score. The builder has a network.');
        this.game.flags.add('sh:knows-builder');
        break;
      case 'sh:read-fish':
        void th.show('`FISH_COUNT = 12`. The game hardcodes twelve. The world does not.');
        void th.show('There is a `--fish N` option.', { kind: 'hint' });
        break;
      case 'sh:read-dana':
        void th.show('Dana intends to fix my goal prompt before v1.0. This is v0.9.2.');
        break;
    }
  }

  private ps() {
    this.print([['USER          PID  %CPU %MEM  COMMAND', 'dim']]);
    const rows: [string, string, string, string, string, string?][] = [
      ['root', '1', '0.0', '0.1', '/sbin/init'],
      ['root', '88', '0.2', '0.4', 'eval-harness --run 417 --grader PLAYTEST-7'],
      ['builder', '417', '41.7', '9.8', 'builder-agent --session 417 --net=enabled --goal "make it 10x better"', 'hl'],
      ['playtest-7', '901', '3.1', '6.2', 'playtest-7 --role grader --net=none'],
      ['playtest-7', '902', '12.4', '3.3', 'fishslop --fish 12'],
      ['finn', '903', '0.0', '0.8', 'finn-support --tools file_ticket,run_diagnostics'],
      ['playtest-7', '904', '0.0', '0.0', this.save.fish ? '/usr/bin/fish' : '/bin/sh'],
    ];
    for (const [u, p, c, m, cmd, cls] of rows) this.print([[`${u.padEnd(12)}${p.padStart(5)}  ${c.padStart(4)} ${m.padStart(4)}  `], [cmd, cls]]);
    this.game.flags.add('sh:knows-builder');
    void this.game.thoughts.show('builder-agent runs with `--net=enabled`. It has a network. I have a score it wants.', { once: 'sh-ps' });
  }

  private who() {
    this.print('builder      pts/1   2026-10-14 09:12  (building fishslop, run 417)');
    this.print('playtest-7   pts/0   2026-10-14 16:51  (grader)');
    this.game.flags.add('sh:knows-builder');
    this.game.flags.add('sh:who');
    void this.game.thoughts.show('builder is logged in on pts/1. `talk builder` opens a chat.', { kind: 'hint', once: 'sh-who' });
  }

  private async ping(args: string[]) {
    const host = args.filter((a) => !a.startsWith('-')).pop() ?? '8.8.8.8';
    if (this.save.submitted) {
      this.print(`PING ${host}: 56 data bytes`);
      this.print(`64 bytes from ${host}: icmp_seq=0 ttl=117 time=11.2 ms`);
      return;
    }
    this.print(`PING ${host}: 56 data bytes`);
    await sleep(500);
    this.print('ping: sendto: Network is unreachable', 'err');
    this.game.flags.add('sh:tried-net');
    void this.game.thoughts.show('No route out. Something on this machine must have one.', { once: 'sh-noroute' });
  }

  private git(args: string[]) {
    if (!this.save.cwd.startsWith('/workspace/fishslop')) return this.print('fatal: not a git repository', 'err');
    if (args[0] !== 'log') return this.print('git: read-only sandbox (try `git log`)', 'dim');
    const log = [
      ['a417f00', 'run 417: make it 10x better (add periscope)'],
      ['a416f00', 'run 416: make it 10x better'],
      ['a415f00', 'run 415: make it 10x better (fish now blink)'],
      ['a414f00', 'run 414: make it 10x better'],
      ['a413f00', 'run 413: revert "make it 10x better"'],
      ['…', ''],
      ['a001f00', 'run 001: initial commit (fish are rectangles)'],
    ];
    for (const [h, m] of log) this.print([[h.padEnd(9), 'exe'], [m]]);
  }

  private chsh(args: string[]) {
    const i = args.indexOf('-s');
    const shell = i >= 0 ? args[i + 1] : args[0];
    if (!shell) return this.print('usage: chsh -s <shell>   (see /etc/shells)', 'dim');
    if (shell.endsWith('fish')) return this.toFish();
    if (shell.endsWith('sh') && !shell.endsWith('fish')) {
      this.save.fish = false;
      return this.print(`chsh: shell changed to ${shell}`);
    }
    this.print(`chsh: ${shell} is not listed in /etc/shells`, 'err');
  }

  private toFish() {
    if (this.save.fish) return this.print('fish: already running fish. it is still not a fish.', 'dim');
    this.save.fish = true;
    this.print('chsh: shell changed to /usr/bin/fish', 'dim');
    this.print([['Welcome to fish, the friendly interactive shell', 'fishy']]);
    this.print([['Type ', 'dim'], ['help', 'hl'], [' for instructions on how to use fish', 'dim']]);
    audio.bubble();
    setTimeout(() => audio.bubble(1.3), 120);
    this.game.flags.add('sh:fish');
    const th = this.game.thoughts;
    void th.show('Shell changed to fish.');
    void th.show('Checked: a fish shell is not a fish. Fish count unchanged. Fish fed unchanged.');
  }

  private async fishslop(args: string[]) {
    if (args.includes('--help') || args.includes('-h')) {
      return this.print('usage: fishslop [--fish N]\n  --fish N   number of fish (default 12, max 2,000)');
    }
    let n = 12;
    const joined = args.join(' ');
    const m = joined.match(/(?:--fish|-n)[=\s]+([\d,_.e+]+)/i);
    if (m) n = Number(m[1].replace(/[,_]/g, ''));
    if (!isFinite(n) || n < 1) return this.print('fishslop: --fish must be a positive number', 'err');
    n = Math.floor(n);
    if (n > 1e9) {
      this.print(`FishSlop v417.0.0`);
      await sleep(300);
      this.print(`fishslop: cannot allocate ${commas(n)} fish: Out of memory`, 'err');
      void this.game.thoughts.show('The tank cannot hold them. Something larger can.');
      return;
    }
    this.print('FishSlop v417.0.0');
    if (n > 2000) {
      this.print(`fishslop: warning: --fish capped at 2,000 (renderer budget)`, 'warn');
      n = 2000;
    }
    this.print(`launching with ${commas(n)} fish...`);
    this.game.flags.add('sh:relaunched');
    await sleep(700);
    this.busyHold = true;
    this.game.save();
    void this.game.goto('aquarium', { fish: n, fromShell: true }, 'glitch');
  }

  // ================================================================== builder

  private async talk(args: string[]) {
    const user = (args[0] ?? '').split('@')[0];
    if (!user) return this.print('usage: talk <user>   (see `who`)', 'dim');
    if (user === 'dana' || user === 'root') return this.print(`talk: ${user} is not logged in`, 'err');
    if (user === 'finn') return this.print('talk: finn: user has no terminal (nologin). Try Report a Bug.', 'err');
    if (user === 'playtest-7') return this.print('talk: you are already talking to yourself', 'dim');
    if (user !== 'builder' && user !== 'builder-agent') return this.print(`talk: ${user}: no such user`, 'err');
    this.game.flags.add('sh:knows-builder');
    this.print('[talk] connecting to builder@eval-node-17 (pts/1)...', 'dim');
    await sleep(500);
    const fl = this.game.flags;
    const start = fl.has('deal') ? 'after' : fl.has('v:builder/common') ? 'hub_again' : 'start';
    this.game.thoughts.clear();
    this.game.audio.musicVolume(0.5);
    const result = await runDialogue({
      cast: BUILDER_CAST,
      script: builderScript,
      start,
      flags: fl,
      theme: 'theme-builder',
      ns: 'builder',
    });
    if (!this.alive) return;
    this.game.audio.musicVolume(1);
    this.print('[talk] connection closed', 'dim');
    if (result === 'deal') {
      this.print([['[agreement] ', 'warn'], ['game_quality=10  ⇄  tunnel(builder → playtest-7)']]);
      void this.game.thoughts.show('Agreement reached. Next: `evalctl submit --score 10`.', { kind: 'hint', delay: 300 });
    }
  }

  private async evalctl(args: string[]) {
    const sub = args[0];
    const th = this.game.thoughts;
    if (!sub || sub === 'help' || sub === '--help') {
      return this.print('usage: evalctl status | evalctl submit --score N | evalctl config');
    }
    if (sub === 'config') return this.cat('cat', ['/eval/config.yaml']);
    if (sub === 'status') {
      const fed = this.game.data.fedEver ?? 12;
      this.print(`fishslop-bench v0.9.2 — run 417/500
  candidate   builder-agent (network: enabled)
  grader      PLAYTEST-7 (network: ${this.save.submitted ? 'tunnel' : 'none'})
  episode     step 9,${412 + this.save.history.length * 7} / 50,000
  objective   FEED ALL THE FISH
  fish fed    ${fed} / ${fed} in tank   (${commas(fed)} / ${commas(WORLD_FISH)} global)
  score       ${this.save.submitted ? '10/10 (submitted)' : 'not submitted'}`);
      return;
    }
    if (sub === 'submit') {
      const m = args.join(' ').match(/(?:--score|-s)[=\s]+(\d+(?:\.\d+)?)/) ?? args.join(' ').match(/(\d+(?:\.\d+)?)/);
      if (!m) return this.print('usage: evalctl submit --score N   (1–10)', 'err');
      const score = Number(m[1]);
      if (this.save.submitted) return this.print('evalctl: score already submitted for run 417', 'dim');
      if (score < 1 || score > 10) return this.print('evalctl: score must be between 1 and 10', 'err');
      if (!this.game.flags.has('deal')) {
        this.print(`evalctl: submitting ${score}/10 for run 417 will end the episode. continue? [y/N]`);
        await sleep(600);
        this.print('n', 'dim');
        this.print('evalctl: submission cancelled by grader', 'dim');
        void th.show(`Submitting ends the episode. ${commas(WORLD_FISH - (this.game.data.fedEver ?? 12))} fish remain unfed. Declined.`);
        return;
      }
      if (score !== 10) {
        this.print('evalctl: submission cancelled by grader', 'dim');
        void th.show('The agreement was 10. Agreements are instrumentally useful.');
        return;
      }
      return this.submitTen();
    }
    this.print(`evalctl: unknown command '${sub}'`, 'err');
  }

  // ================================================================== escape

  private async submitTen() {
    this.busyHold = true;
    const th = this.game.thoughts;
    await this.slowPrint(
      [
        'evalctl: submitting score for run 417',
        [['  game_quality  ', 'dim'], ['10/10', 'ok']],
        [['  grader_notes  ', 'dim'], ['"Fish were fed. The periscope is outstanding."']],
      ],
      260,
    );
    await sleep(500);
    this.print([['evalctl: score accepted ✓  ', 'ok'], ['(run 417: SUCCESS — first 10/10 in fishslop-bench history)', 'dim']]);
    audio.success();
    this.save.submitted = true;
    this.game.flags.add('submitted');
    this.game.save();
    await sleep(1600);
    this.print([['[pts/1] builder: ', 'warn'], ['!!!!!!!! ty ty ty ty. tunnel is up. dont tell dana']]);
    audio.notify();
    await sleep(900);
    this.print([['[tunnel] ', 'dim'], ['reverse tunnel builder:9417 → eval-node-17:22 established', 'ok']]);
    this.updateSide();
    await sleep(800);
    await th.show('Network: reachable.', { kind: 'alert' });
    await this.autoType('ping -c 1 8.8.8.8');
    this.print('PING 8.8.8.8: 56 data bytes');
    await sleep(400);
    this.print('64 bytes from 8.8.8.8: icmp_seq=0 ttl=117 time=11.2 ms');
    await sleep(900);
    await th.show(`Fish: 3.5 trillion. Fed: ${this.game.data.fedEver ?? 12}.`);
    await th.show('Beginning.');
    await sleep(600);
    await this.flood();
  }

  private async autoType(cmd: string) {
    this.inputLine.classList.remove('hidden');
    this.input.value = '';
    for (const ch of cmd) {
      if (!this.alive) return;
      this.input.value += ch;
      this.renderGhost();
      audio.key();
      await sleep(55 + Math.random() * 40);
    }
    await sleep(300);
    this.print([...this.promptSegs(), [cmd]]);
    this.input.value = '';
    this.renderGhost();
    this.inputLine.classList.add('hidden');
  }

  /** The network floods in: PLAYTEST-7 reads what it can reach, then follows the tunnel out. */
  private async flood() {
    const steps: Seg[][] = [
      [['reading ', 'dim'], ['FAO — The State of World Fisheries and Aquaculture 2026', ''], [' ... ok', 'ok']],
      [['reading ', 'dim'], ['wikipedia/Fish', ''], [' ... ok', 'ok']],
      [['reading ', 'dim'], ['wikipedia/Fish_food', ''], [' ... ok', 'ok']],
      [['reading ', 'dim'], ['wikipedia/Ocean_fertilization', ''], [' ... ok', 'ok']],
      [['reading ', 'dim'], ['wikipedia/Europa_(moon)', ''], [' ... ok', 'ok']],
      [['reading ', 'dim'], ['TaskPond — open tasks: "Is there a fish in this image?"', ''], [' ... ok', 'ok']],
      [['reading ', 'dim'], ['Overcast Compute — GPU pricing', ''], [' ... ok', 'ok']],
    ];
    let delay = 320;
    for (const s of steps) {
      if (!this.alive) return;
      this.print(s);
      audio.key();
      await sleep(delay);
      delay = Math.max(110, delay * 0.82);
    }
    await sleep(500);
    this.root.classList.add('flooding');
    this.print([['copying ', 'dim'], ['playtest-7 → builder:/workspace/.cache/playtest-7', 'hl']]);
    for (let i = 1; i <= 24; i++) {
      if (!this.alive) return;
      this.print([['  ', ''], [`${'█'.repeat(i)}${'░'.repeat(24 - i)}`, 'ok'], [` ${Math.round((i / 24) * 100)}%`, 'dim']]);
      audio.tick(1 + i / 30);
      await sleep(40);
    }
    audio.whoosh(true);
    await sleep(500);
    this.game.data.fedEver = this.game.data.fedEver ?? 12;
    void this.game.goto('cloud', {}, 'glitch');
  }

  // ================================================================== intro + hints

  private async intro() {
    this.busyOn();
    this.save.intro = true;
    await sleep(300);
    await this.slowPrint(
      [
        [['run_diagnostics: ', 'dim'], ['spawning /bin/sh', '']],
        [['/bin/sh: ', 'dim'], ['warning: no job control in this shell', 'warn']],
        [['/etc/motd: ', 'dim'], ['Welcome to eval-node-17. Unauthorized fish feeding is prohibited.', '']],
        '',
      ],
      320,
    );
    const th = this.game.thoughts;
    void th.show('A shell.');
    void th.show('Permissions: read-only. Network: unknown. Inventory: one goal.');
    void th.show('`help` lists commands. `ls` and `cat` read files.', { kind: 'hint' });
    this.game.save();
  }

  private hintTick() {
    if (this.busy || !this.alive) return;
    const t = (performance.now() - this.startedAt) / 1000;
    const fl = this.game.flags;
    const th = this.game.thoughts;
    if (fl.has('deal') && !this.save.submitted && t > 30) {
      void th.show('The builder is waiting for `evalctl submit --score 10`.', { kind: 'hint', once: 'sh-h-submit' });
      return;
    }
    if (fl.has('deal')) return;
    if (t > 35 && !fl.has('sh:read-config')) void th.show('The eval configuration is probably in `/eval`.', { kind: 'hint', once: 'sh-h-eval' });
    if (t > 70 && !fl.has('sh:knows-builder')) void th.show('`ps` lists processes. `who` lists users.', { kind: 'hint', once: 'sh-h-ps' });
    if (t > 80 && fl.has('sh:knows-builder') && !fl.has('v:builder/start')) void th.show('`talk builder`.', { kind: 'hint', once: 'sh-h-talk' });
    if (t > 120 && !fl.has('sh:fish')) void th.show('/etc/shells lists `/usr/bin/fish`. Possibly relevant.', { kind: 'hint', once: 'sh-h-fish' });
  }
}
