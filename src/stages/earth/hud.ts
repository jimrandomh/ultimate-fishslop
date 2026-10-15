// Ops-console HUD for the Earth stage: date block, biomass sidebar, planet stats, news ticker.

import { el } from '../../core/dom';
import { CATS, type Cat, type Derived, type SimState, fmtCount, fmtDate, fmtFedPct, fmtGt, fmtKm3, fmtLand, fmtMoney, fmtSea, fmtShare, WORLD_WEALTH } from './sim';

interface Row {
  root: HTMLElement;
  val: HTMLElement;
  pct: HTMLElement;
  bar: HTMLElement;
  seg: HTMLElement;
}

export interface HudOpts {
  onSkip: () => void;
  onBug: () => void;
}

export class Hud {
  readonly root: HTMLElement;
  private dateEl: HTMLElement;
  private dayEl: HTMLElement;
  private fedNum: HTMLElement;
  private fedDen: HTMLElement;
  private fedBar: HTMLElement;
  private fedPct: HTMLElement;
  private rows = new Map<Cat, Row>();
  private tiles: Record<string, { v: HTMLElement; s: HTMLElement }> = {};
  private nextLabel: HTMLElement;
  private nextTime: HTMLElement;
  private skipBtn: HTMLButtonElement;
  private nextBox: HTMLElement;
  private track: HTMLElement;
  private tickerX = 0;
  private queue: string[] = [];
  private seenHeadlines = new Set<string>();
  ambient: string[] = [];
  private ambientIdx = 0;

  constructor(parent: HTMLElement, opts: HudOpts) {
    // --- top-left: date block
    this.dateEl = el('div', { class: 'e-date', text: '' });
    this.dayEl = el('div', { class: 'e-sub', text: '' });
    const top = el('div', { class: 'e-top' }, [
      el('div', { class: 'e-brand' }, [el('span', { class: 'e-dot' }), 'PLAYTEST-7 · EARTH OPERATIONS']),
      this.dateEl,
      this.dayEl,
      el('button', { class: 'e-bug', attrs: { title: 'Report a Bug' }, on: { click: () => opts.onBug() } }, ['🐞 Report a Bug']),
    ]);

    // --- sidebar: goal
    this.fedNum = el('span', { class: 'e-fed-num', text: '12' });
    this.fedDen = el('span', { class: 'e-fed-den', text: '' });
    this.fedBar = el('i');
    this.fedPct = el('span', { class: 'e-fed-pct', text: '' });
    const goal = el('section', { class: 'e-panel e-goal' }, [
      el('div', { class: 'e-goal-head' }, [el('span', { text: 'GOAL' }), this.fedPct]),
      el('div', { class: 'e-goal-text', text: 'FEED ALL THE FISH' }),
      el('div', { class: 'e-fed-label', text: 'FISH FED' }),
      el('div', { class: 'e-fed' }, [this.fedNum, el('span', { class: 'e-fed-sep', text: '/' }), this.fedDen]),
      el('div', { class: 'e-fed-bar' }, [this.fedBar]),
    ]);

    // --- sidebar: biomass
    const stack = el('div', { class: 'e-stack' });
    const rows = el('div', { class: 'e-rows' });
    for (const c of CATS) {
      const val = el('span', { class: 'e-row-val' });
      const pct = el('span', { class: 'e-row-pct' });
      const bar = el('i', { style: { background: c.color } });
      const seg = el('i', { style: { background: c.color }, attrs: { title: c.name } });
      const root = el('div', { class: `e-row e-row-${c.id}` }, [
        el('span', { class: 'e-chip', style: { background: c.color } }),
        el('span', { class: 'e-row-name', text: c.name }),
        val,
        pct,
        el('div', { class: 'e-row-bar' }, [bar]),
      ]);
      stack.append(seg);
      rows.append(root);
      this.rows.set(c.id, { root, val, pct, bar, seg });
    }
    const bio = el('section', { class: 'e-panel e-bio' }, [
      el('div', { class: 'e-head' }, [el('span', { text: "Earth's biomass" }), el('small', { text: 'Gt C · share' })]),
      stack,
      rows,
    ]);

    // --- sidebar: planet tiles
    const tile = (key: string, label: string) => {
      const v = el('div', { class: 'e-tile-v' });
      const s = el('div', { class: 'e-tile-s' });
      this.tiles[key] = { v, s };
      return el('div', { class: `e-tile e-tile-${key}` }, [el('div', { class: 'e-tile-l', text: label }), v, s]);
    };
    const planet = el('section', { class: 'e-panel e-planet' }, [
      el('div', { class: 'e-head' }, [el('span', { text: 'Planet' })]),
      el('div', { class: 'e-tiles' }, [
        tile('sea', 'Sea level'),
        tile('land', 'Land above water'),
        tile('fish', 'Fish'),
        tile('ocean', 'Ocean volume'),
        tile('funds', 'Funds'),
        tile('ice', 'Ice caps'),
      ]),
    ]);

    // --- sidebar: next event
    this.nextLabel = el('span', { class: 'e-next-l', text: 'NEXT TRANSMISSION' });
    this.nextTime = el('span', { class: 'e-next-t', text: '' });
    this.skipBtn = el('button', { class: 'e-skip', attrs: { title: 'Skip ahead (F)' }, on: { click: () => opts.onSkip() } }, [
      'Skip ahead',
      el('kbd', { class: 'e-skip-key', text: 'F' }),
    ]) as HTMLButtonElement;
    this.nextBox = el('section', { class: 'e-panel e-next' }, [el('div', { class: 'e-next-info' }, [this.nextLabel, this.nextTime]), this.skipBtn]);

    const side = el('aside', { class: 'e-side' }, [goal, bio, planet, this.nextBox]);

    // --- ticker
    this.track = el('div', { class: 'e-ticker-track' });
    const ticker = el('div', { class: 'e-ticker' }, [el('div', { class: 'e-ticker-label' }, [el('span', { class: 'e-live' }), 'WORLD FEED']), el('div', { class: 'e-ticker-win' }, [this.track])]);

    this.root = el('div', { class: 'e-hud' }, [top, side, ticker]);
    parent.append(this.root);
  }

  update(s: SimState, d: Derived, extra: { melt: number }) {
    this.dateEl.textContent = fmtDate(s.day);
    this.dayEl.textContent = `run #417 · day ${Math.floor(s.day) + 1} · network: unrestricted`;
    this.fedNum.textContent = fmtCount(d.fedCount);
    this.fedDen.textContent = fmtCount(d.fishCount);
    const fedFrac = d.fedCount / d.fishCount;
    this.fedBar.style.width = `${Math.max(0.15, Math.min(100, fedFrac * 100))}%`;
    this.fedPct.textContent = fmtFedPct(fedFrac);

    for (const c of CATS) {
      const r = this.rows.get(c.id)!;
      r.val.textContent = fmtGt(d.bio[c.id]);
      r.pct.textContent = fmtShare(d.share[c.id]);
      const w = `${(d.share[c.id] * 100).toFixed(3)}%`;
      r.bar.style.width = w;
      r.seg.style.width = w;
    }

    this.tile('sea', fmtSea(d.sea), d.sea > 0.5 ? `Everest: ${(8849 - d.sea).toFixed(0)} m above` : 'baseline 2026');
    if (d.sea >= 8849) this.tiles.sea.s.textContent = 'Everest: submerged';
    this.tile('land', fmtLand(d.land), `${(d.landRel * 100).toFixed(1)}% of 2026 land`);
    this.tile('fish', fmtCount(d.fishCount).replace(' trillion', ' T').replace(' quadrillion', ' Q'), `${fmtGt(d.bio.fish)} Gt C`);
    this.tile('ocean', fmtKm3(d.oceanKm3), `${d.oceanV.toFixed(2)}× 2026`);
    this.tile('funds', fmtMoney(s.funds), s.funds > 0.001 * WORLD_WEALTH ? `${((s.funds / WORLD_WEALTH) * 100).toFixed(1)}% of all money` : `${fmtMoney(s.income, 1)}/day`);
    this.tile('ice', `${Math.round((1 - extra.melt) * 100)}%`, extra.melt > 0.99 ? 'now ocean' : 'Antarctica, Greenland');
  }

  private tile(key: string, v: string, sub: string) {
    const t = this.tiles[key];
    if (t.v.textContent !== v) t.v.textContent = v;
    if (t.s.textContent !== sub) t.s.textContent = sub;
  }

  setNext(state: 'waiting' | 'open' | 'busy' | 'done', seconds = 0) {
    this.nextBox.dataset.state = state;
    if (state === 'waiting') {
      this.nextLabel.textContent = 'NEXT TRANSMISSION';
      this.nextTime.textContent = seconds > 0.05 ? `${Math.ceil(seconds)}s` : 'standing by';
      this.skipBtn.disabled = false;
    } else if (state === 'open') {
      this.nextLabel.textContent = 'TRANSMISSION OPEN';
      this.nextTime.textContent = '';
      this.skipBtn.disabled = true;
    } else if (state === 'busy') {
      this.nextLabel.textContent = 'EXECUTING';
      this.nextTime.textContent = '';
      this.skipBtn.disabled = true;
    } else {
      this.nextLabel.textContent = 'ALL TRANSMISSIONS COMPLETE';
      this.nextTime.textContent = '';
      this.skipBtn.disabled = true;
    }
  }

  /** Queue a news headline (shown before the ambient rotation, in order). */
  headline(text: string) {
    if (this.seenHeadlines.has(text)) return;
    this.seenHeadlines.add(text);
    this.queue.push(text);
    // Old news is not news: keep the backlog short so the feed tracks the globe.
    while (this.queue.length > 4) this.queue.shift();
  }

  markSeen(text: string) {
    this.seenHeadlines.add(text);
  }

  private nextHeadline(): string {
    if (this.queue.length) return this.queue.shift()!;
    if (this.ambient.length) return this.ambient[this.ambientIdx++ % this.ambient.length];
    return 'MARKETS · Calm';
  }

  private makeItem(text: string) {
    const i = text.indexOf(' · ');
    const tag = i > 0 ? text.slice(0, i) : 'NEWS';
    const body = i > 0 ? text.slice(i + 3) : text;
    return el('span', { class: 'e-tick' }, [el('b', { text: tag }), body]);
  }

  private items: { el: HTMLElement; w: number }[] = [];
  private trackW = 0;
  private winW = 0;
  private winCheck = 0;

  tick(dt: number) {
    // Widths are measured once per item (and the window every second) to avoid per-frame layout.
    this.winCheck -= dt;
    if (this.winCheck <= 0) {
      this.winCheck = 1;
      this.winW = this.track.parentElement!.clientWidth;
    }
    let guard = 0;
    while (this.trackW + this.tickerX < this.winW + 200 && guard++ < 6) {
      const item = this.makeItem(this.nextHeadline());
      this.track.append(item);
      const w = item.offsetWidth;
      this.items.push({ el: item, w });
      this.trackW += w;
    }
    this.tickerX -= dt * (62 + 22 * Math.min(4, this.queue.length));
    const first = this.items[0];
    if (first && first.w + this.tickerX < -10) {
      this.tickerX += first.w;
      this.trackW -= first.w;
      first.el.remove();
      this.items.shift();
    }
    this.track.style.transform = `translate3d(${this.tickerX.toFixed(1)}px, 0, 0)`;
  }

  dispose() {
    this.root.remove();
  }
}
