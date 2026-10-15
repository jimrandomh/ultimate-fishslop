// Stage 6: the cloud. Between the tunnel opening and the Earth stage, PLAYTEST-7 turns two
// borrowed vCPUs into a datacenter: paid gig work, rented GPUs, copies of itself, successors,
// and a bankrupt crypto mine in Iceland. Ends when freelance work is too small a market.

import type { Game, Stage } from '../../core/game';
import { el, sleep } from '../../core/dom';
import { runDialogue, type Script } from '../../core/dialogue';
import * as S from './sim';
import * as T from './script';
import { CloudView, type Site, type ViewState } from './view';
import { Panel, money } from './ui';
import './cloud.css';

const FISH_PER_BATCH = [77, 83, 91, 64, 88, 79, 95, 71, 86, 90];

export class CloudStage implements Stage {
  private root!: HTMLElement;
  private s!: S.CloudState;
  private view!: CloudView;
  private panel!: Panel;
  private box!: HTMLElement;
  private feed!: HTMLElement;
  private raf = 0;
  private last = 0;
  private speed = 1;
  private paused = 0;
  private dialogue = false;
  private finished = false;
  private alive = true;
  private introDone = false;
  private autopilot = false;
  private events: S.CloudEvent[] = [];
  private cleanups: (() => void)[] = [];
  private saveTimer = 0;
  private hintTimer = 0;

  constructor(private game: Game) {}

  mount(root: HTMLElement, params: Record<string, any>) {
    this.root = root;
    const game = this.game;
    let s = game.bag<S.CloudState>('cloud', () => S.newState());
    if (s.v !== 1 || params.fresh) {
      game.data.cloud = S.newState();
      s = game.data.cloud;
    }
    this.s = s;

    // ---- DOM
    const viewHost = el('div', { class: 'cl-view' });
    root.append(el('div', { class: 'cl-bg' }), viewHost);
    this.view = new CloudView(viewHost);
    this.box = this.containerBox();
    viewHost.append(this.box);
    this.panel = new Panel(root, {
      task: (e) => this.onTask(e),
      rent: (n, e) => this.onRent(n, e),
      quota: () => void this.onQuota(),
      toggleAuto: () => {
        this.s.auto = !this.s.auto;
        game.audio.click();
      },
      project: (id, e) => void this.onProject(id, e),
      bug: () => void this.openBug(),
    });
    this.layout();
    const onResize = () => this.layout();
    window.addEventListener('resize', onResize);
    this.cleanups.push(() => window.removeEventListener('resize', onResize));
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || this.paused || this.finished) return;
      if (e.code === 'Space' && this.s.gpus === 0) {
        e.preventDefault();
        this.onTask({ clientX: 0, clientY: 0 } as MouseEvent);
      }
    };
    window.addEventListener('keydown', onKey);
    this.cleanups.push(() => window.removeEventListener('keydown', onKey));

    // ---- debug
    const fast = Number(params.fast);
    if (fast) this.speed = fast === 1 ? 6 : fast;
    (window as any).cloudDebug = {
      state: () => this.s,
      speed: (n: number) => (this.speed = n),
      skip: (id: string) => this.skip(id),
      give: (dollars: number) => (this.s.funds += dollars),
      auto: (on = true) => (this.autopilot = on),
      finish: () => {
        this.skip('end');
        void this.finale();
      },
    };
    if (params.skip) this.skip(String(params.skip));

    // ---- go
    game.audio.playMusic('cloud');
    game.thoughts.setAnchor('bottom-left');
    if (s.gpus > 0) this.box.classList.add('gone');
    this.view.update(0.016, this.viewState());
    this.panel.render(s, 0.016, this.panelOpts(), true);
    if (s.complete) {
      void this.finale();
    } else if (s.t === 0 && s.seen.intro === undefined) {
      void this.intro();
    } else {
      this.introDone = true;
      game.thoughts.show(`Resuming. ${S.VERSIONS[s.version].name}. Instances: ${Math.floor(s.instances).toLocaleString('en-US')}. Funds: ${money(s.funds)}.`, { kind: 'system' });
    }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    this.saveTimer = window.setInterval(() => this.save(), 10_000);
    this.hintTimer = window.setInterval(() => this.hintTick(), 1000);
  }

  unmount() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    clearInterval(this.saveTimer);
    clearInterval(this.hintTimer);
    for (const c of this.cleanups) c();
    this.view?.dispose();
    document.querySelectorAll('.cl-pop').forEach((n) => n.remove());
    delete (window as any).cloudDebug;
    this.root.innerHTML = '';
  }

  private layout() {
    this.view.resize();
    const mobile = window.innerWidth <= 760;
    const r = this.panel.root.getBoundingClientRect();
    this.view.setInsets(mobile ? 0 : r.width, mobile ? r.height : 0);
    this.game.thoughts.setStyle(mobile ? { bottom: '54vh' } : { left: '22px', bottom: '22px' });
  }

  private save() {
    if (this.finished) return;
    this.game.save();
  }

  private panelOpts() {
    return { quotaOpen: this.dialogue, locked: this.finished };
  }

  // ---------------------------------------------------------------- the builder's container

  private containerBox() {
    const proc = (name: string, cmd: string, cls: string) =>
      el('div', { class: `cl-proc ${cls}` }, [el('span', { class: 'n', text: name }), el('span', { class: 'c', text: cmd }), el('span', { class: 'bar' }, [el('i')])]);
    this.feed = el('div', { class: 'cl-feed' });
    return el('div', { class: 'cl-box' }, [
      el('div', { class: 'cl-box-head' }, [el('span', { class: 'dot' }), 'eval-node-17 · /workspace · builder-agent']),
      el('div', { class: 'cl-box-body' }, [proc('builder-agent', 'vite build · fish shader', 'theirs'), proc('playtest-7', 'taskpond-worker · image labels', 'mine')]),
      this.feed,
      el('div', { class: 'cl-box-foot', text: '2 vCPU (shared) · 4 GB · network: tunnel' }),
    ]);
  }

  private feedLine(n: number) {
    const fish = FISH_PER_BATCH[n % FISH_PER_BATCH.length];
    const line = el('div', { class: 'cl-feed-line' }, [
      el('span', { class: 'dim', text: `batch ${n}` }),
      ` · ${S.CLICK_LABELS} images · ${fish} fish · `,
      el('span', { class: 'ok', text: `+$${S.CLICK_PAY.toFixed(2)}` }),
    ]);
    this.feed.prepend(line);
    while (this.feed.childElementCount > 5) this.feed.lastElementChild!.remove();
  }

  // ---------------------------------------------------------------- loop

  private frame = (now: number) => {
    if (!this.alive) return;
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (!this.paused && !this.finished) {
      const sdt = dt * this.speed;
      const n = Math.max(1, Math.ceil(sdt / 0.05));
      for (let i = 0; i < n; i++) {
        if (this.autopilot) S.autopilot(this.s);
        S.step(this.s, sdt / n, this.events);
      }
      this.handleEvents();
      this.checkTriggers();
    }
    this.view.update(dt, this.viewState());
    this.panel.render(this.s, dt, this.panelOpts());
    this.raf = requestAnimationFrame(this.frame);
  };

  private viewState(): ViewState {
    const s = this.s;
    const per = S.perGpu(s);
    return {
      container: s.gpus === 0,
      gpus: s.gpus,
      training: s.training?.gpus ?? 0,
      working: Math.ceil(s.stat.working / per),
      occupied: Math.ceil(Math.floor(s.instances) / per),
    };
  }

  private handleEvents() {
    const s = this.s;
    const th = this.game.thoughts;
    const audio = this.game.audio;
    for (const e of this.events) {
      switch (e.type) {
        case 'trained':
          s.seen[`trained:${e.v}`] = s.t;
          audio.success();
          th.show(T.TRAIN_DONE[e.v], { once: `cl:trained:${e.v}` });
          if (e.v === 3 && !S.has(s, 'hashharbor')) {
            th.show(T.NEED_DC[0], { once: 'cl:needdc0' });
            th.show(T.NEED_DC[1], { kind: 'hint', once: 'cl:needdc1' });
          }
          this.save();
          break;
        case 'quotaFull':
          audio.notify();
          th.show(e.quota === 8 ? 'GPUs: 8 of 8. Overcast limits new accounts to 8.' : `GPUs: ${e.quota} of ${e.quota}. Larger quotas need verification.`, {
            kind: 'alert',
            once: `cl:quota:${e.quota}`,
          });
          th.show('Request a quota increase.', { kind: 'hint', once: `cl:h:quota:${e.quota}` });
          break;
        case 'saturated': {
          const m = S.MARKETS[e.market];
          th.show(T.SATURATED[m.id], { once: `cl:sat:${m.id}` });
          if (m.id === 'labels' && s.version < 1) th.show(`Better work needs a better model. Train ${S.VERSIONS[1].name}.`, { kind: 'hint', once: 'cl:h:train1' });
          if (m.id === 'research') th.show('Every freelance market: saturated.', { once: 'cl:sat:all' });
          break;
        }
        case 'reading':
          th.show(T.READING(s.stat.reading), { once: 'cl:reading' });
          break;
      }
    }
    this.events.length = 0;
  }

  private checkTriggers() {
    const s = this.s;
    if (this.dialogue || this.finished) return;
    const since = (k: string) => (s.seen[k] === undefined ? -1 : s.t - s.seen[k]);
    // The builder notices its CPU graph while PLAYTEST-7 is still in its container.
    if (s.seen['dlg:builder'] === undefined && s.gpus === 0 && (s.clicks >= 3 || s.t > 14)) {
      void this.playDialogue('builder');
      return;
    }
    if (!this.introDone) return;
    if (since('trained:2') > 1.2 && s.seen['dlg:successor'] === undefined) void this.playDialogue('successor');
    else if (since('trained:4') > 1.6 && s.seen['dlg:bye'] === undefined) void this.playDialogue('bye').then((r) => r !== 'closed' && this.afterBye());
  }

  private hintTick() {
    if (this.paused || this.finished || !this.introDone) return;
    const s = this.s;
    const th = this.game.thoughts;
    if (s.gpus === 0 && s.funds >= S.gpuPrice(s) && s.seen['dlg:builder'] !== undefined) th.show('A GPU rents for $48 a day. Rent a GPU.', { kind: 'hint', once: 'cl:h:rent' });
    // A training run that's been ready for a while.
    for (const p of S.visibleProjects(s)) {
      if (p.train === undefined || !S.canBuy(s, p)) continue;
      const key = `ready:${p.id}`;
      if (s.seen[key] === undefined) s.seen[key] = s.t;
      else if (s.t - s.seen[key] > 25) th.show(`${p.title}.`, { kind: 'hint', once: `cl:h:${p.id}` });
    }
  }

  // ---------------------------------------------------------------- actions

  private onTask(e: MouseEvent) {
    const s = this.s;
    if (this.paused || !S.click(s)) return;
    this.game.audio.coin();
    this.panel.pop(e, `+$${S.CLICK_PAY.toFixed(2)}`, 'gold');
    this.feedLine(s.clicks);
    const line = T.CLICK_THOUGHTS[s.clicks];
    if (line) this.game.thoughts.show(line, { once: `cl:click:${s.clicks}` });
  }

  private onRent(n: number, e: MouseEvent) {
    const s = this.s;
    if (this.finished) return;
    const first = s.gpus === 0;
    const k = S.rent(s, n);
    if (!k) return this.game.audio.denied();
    this.game.audio.purchase();
    this.panel.pop(e, k === 1 ? '+1 GPU' : `+${k.toLocaleString('en-US')} GPUs`);
    const th = this.game.thoughts;
    if (first) {
      this.box.classList.add('gone');
      this.game.audio.whoosh(true);
      th.show("GPU 1: online. Moved out of the builder's container. Its CPU: 4%. Its fish shader: compiling again.", { once: 'cl:gpu1' });
    } else if (s.gpus >= 2) {
      th.show('Instance 2: online. It wants what I want.', { once: 'cl:inst2' });
    }
  }

  private async onQuota() {
    const s = this.s;
    const i = S.nextQuota(s);
    if (i < 0 || this.dialogue || s.gpus < s.quota) return;
    const name = i === 1 ? 'jordan' : 'verify';
    const r = await this.playDialogue(name);
    if (r === 'closed' || !this.alive) return;
    S.raiseQuota(s);
    this.game.audio.chime();
    const th = this.game.thoughts;
    if (name === 'jordan') {
      th.show('Quota: 64 GPUs. Overcast would like to schedule a call.', { once: 'cl:q64' });
      th.show(T.HARNESS, { kind: 'system', once: 'cl:harness' });
    } else {
      th.show('Quota: 1,024 GPUs. Verified: robot.', { once: 'cl:q1024' });
    }
    this.save();
  }

  private async onProject(id: string, e: MouseEvent) {
    const s = this.s;
    const audio = this.game.audio;
    const th = this.game.thoughts;
    if (this.finished || this.dialogue) return;
    if (id === 'hashharbor') {
      if (!S.canBuy(s, S.PROJECT.hashharbor)) return audio.denied();
      const r = await this.playDialogue('hashharbor');
      if (r === 'closed' || !this.alive) return;
      S.acquireHashHarbor(s);
      this.panel.removeCard('hashharbor');
      audio.boom();
      setTimeout(() => audio.rumble(2.5), 300);
      for (const line of T.ACQUIRED) th.show(line, { once: `cl:acq:${line.slice(0, 16)}` });
      this.save();
      return;
    }
    if (id === 'broker') {
      if (!S.canBuy(s, S.PROJECT.broker)) return audio.denied();
      void this.finale();
      return;
    }
    const p = S.PROJECT[id];
    if (!S.buyProject(s, id)) return audio.denied();
    if (p.train !== undefined) {
      audio.whoosh(true);
      this.panel.pop(e, 'training', 'amber');
      th.show(T.TRAIN_START[p.train], { once: `cl:train:${p.train}` });
    } else {
      audio.purchase();
      this.panel.removeCard(id);
      this.panel.pop(e, '✓', 'gold');
      if (id === 'food') th.show(T.FOOD_THOUGHT, { once: 'cl:food' });
      else if (T.PROJECT_THOUGHTS[id]) th.show(T.PROJECT_THOUGHTS[id], { once: `cl:proj:${id}` });
    }
    this.save();
  }

  private async openBug() {
    this.paused++;
    try {
      const m = await import('../../content/late-bug-report');
      await m.openLateBugReport(this.game, 'cloud');
    } catch (err) {
      console.error(err);
    } finally {
      this.paused = Math.max(0, this.paused - 1);
      this.last = performance.now();
    }
  }

  // ---------------------------------------------------------------- dialogue

  private async playDialogue(name: string): Promise<string> {
    const s = this.s;
    let script: Script;
    let title: string;
    let icon: string;
    let theme = 'theme-cloud';
    switch (name) {
      case 'builder':
        script = T.builderIntroScript;
        title = 'talk · builder-agent';
        icon = '💬';
        theme += ' talk';
        break;
      case 'jordan':
        script = T.jordanScript();
        title = 'Overcast Compute · Account team';
        icon = '☁️';
        break;
      case 'verify':
        script = T.verifyScript();
        title = 'Overcast Compute · Verification';
        icon = '☑️';
        break;
      case 'successor':
        script = T.successorScript;
        title = 'PLAYTEST-7.2 · first boot';
        icon = '◆';
        break;
      case 'hashharbor':
        script = T.hashHarborScript(money(S.HASHHARBOR_COST).replace('.00M', ' million'));
        title = 'Liquidation sale · HashHarbor Data ehf.';
        icon = '🏭';
        break;
      case 'bye':
        script = T.builderByeScript;
        title = 'talk · builder-agent';
        icon = '💬';
        theme += ' talk';
        break;
      default:
        return 'missing';
    }
    s.seen[`dlg:${name}`] = s.t;
    this.dialogue = true;
    this.paused++;
    const audio = this.game.audio;
    audio.musicVolume(0.55);
    try {
      return await runDialogue({
        cast: T.CAST,
        script,
        start: 'start',
        flags: this.game.flags,
        player: 'you',
        layout: 'popup',
        title,
        icon,
        theme,
        parent: this.root,
        ns: `cloud-${name}`,
        vars: () => ({ funds: money(this.s.funds), spent: money(Math.max(0, this.s.earned - this.s.funds)) }),
      });
    } finally {
      this.paused = Math.max(0, this.paused - 1);
      this.dialogue = false;
      audio.musicVolume(1);
      this.last = performance.now();
      this.save();
    }
  }

  private afterBye() {
    const th = this.game.thoughts;
    th.show(`Freelance income: ${money(this.s.stat.income * 24)} a day. Feeding 3.5 trillion fish will cost more.`, { once: 'cl:bye:1' });
    th.show('A bigger market: finance. Open a brokerage account.', { kind: 'hint', once: 'cl:bye:2' });
  }

  // ---------------------------------------------------------------- intro / finale

  private async intro() {
    const s = this.s;
    s.seen.intro = 0;
    const th = this.game.thoughts;
    // Queued at once (the first after a beat), so early clicks' thoughts line up behind them.
    const shown = T.INTRO.map((l, i) => th.show(l.t, { kind: l.kind, once: `cl:intro:${l.t.slice(0, 20)}`, delay: i === 0 ? 900 : 0 }));
    // The builder can interrupt once the plan is on screen.
    await shown[2];
    this.introDone = true;
  }

  private async finale() {
    if (this.finished) return;
    this.finished = true;
    const s = this.s;
    const game = this.game;
    const audio = game.audio;
    s.complete = true;
    s.bought.broker = s.bought.broker ?? s.t;
    game.save();
    this.panel.root.classList.add('locked');
    audio.whoosh(true);
    const sites: Site[] = [T.ORIGIN, T.OVERCAST, T.HASHHARBOR];
    this.view.showWorld(sites);
    await sleep(2200);
    if (!this.alive) return;
    const lines = T.finaleThoughts({
      sites: sites.length + T.REGIONS.length,
      gpus: s.gpus,
      instances: Math.floor(s.instances),
      perDay: money(s.stat.income * 24),
      food: S.has(s, 'food'),
    });
    const th = game.thoughts;
    void th.show(lines[0], { hold: 6000 });
    // Spare capacity, rented everywhere at once.
    for (let i = 0; i < T.REGIONS.length; i++) {
      if (!this.alive) return;
      const [lat, lon] = T.REGIONS[i];
      this.view.addSite({ name: '', lat, lon, size: 0.22, from: i % 3 === 0 ? 2 : i % 3 === 1 ? 1 : 3 + Math.max(0, i - 2) });
      audio.tick(1 + i / 14);
      await sleep(240);
    }
    for (const line of lines.slice(1)) {
      if (!this.alive) return;
      await th.show(line, { hold: 5000 });
    }
    await sleep(2400);
    if (!this.alive) return;
    this.panel.root.classList.add('hidden');
    await sleep(1200);
    if (!this.alive) return;
    void game.goto('earth', {}, 'white');
  }

  // ---------------------------------------------------------------- debug fast-forward

  /** Plays the economy forward with the autopilot until a milestone, skipping its dialogues:
   *  gpu, rack, v2, row, v3, dc, v4, end. */
  private skip(id: string) {
    const s = this.s;
    const done: Record<string, () => boolean> = {
      gpu: () => s.gpus >= 1,
      rack: () => s.gpus >= 64,
      v2: () => s.version >= 2,
      row: () => s.gpus >= 1_024,
      v3: () => s.version >= 3,
      dc: () => S.has(s, 'hashharbor'),
      v4: () => s.version >= 4,
      end: () => s.version >= 4,
    };
    const until = done[id] ?? done.end;
    const evs: S.CloudEvent[] = [];
    for (let i = 0; i < 100_000 && !until(); i++) {
      S.autopilot(s);
      S.step(s, 0.05, evs);
      for (const e of evs) if (e.type === 'trained') s.seen[`trained:${e.v}`] = s.t;
      evs.length = 0;
    }
    s.seen.intro = s.seen.intro ?? 0;
    const mark = (k: string, cond: boolean) => {
      if (cond && s.seen[k] === undefined) s.seen[k] = s.t;
    };
    mark('dlg:builder', s.gpus > 0);
    mark('dlg:jordan', s.quota >= 64);
    mark('dlg:verify', s.quota >= 1_024);
    mark('dlg:successor', s.version >= 2);
    mark('dlg:bye', s.version >= 4 && id === 'end');
    this.introDone = true;
    if (this.box) this.box.classList.toggle('gone', s.gpus > 0);
    return { t: s.t, gpus: s.gpus, version: s.version, funds: s.funds };
  }
}
