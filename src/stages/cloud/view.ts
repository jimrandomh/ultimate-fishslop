// The cloud stage's picture: every GPU PLAYTEST-7 runs on, one cell each, laid out as servers,
// racks, rows, halls and a datacenter. The camera zooms out a level whenever the hardware
// outgrows the current one. At the end it pulls back to a world map of sites.
//
// Cells live in a fixed layout (in "layout pixels": a GPU is a 3×3 cell on a 4 px pitch, and each
// level up adds a wider gap). Far out, the whole layout is one bitmap scaled down; close in,
// cells are drawn one by one so new copies can pop in.

import { el } from '../../core/dom';

const PITCH = 4;
const CELL = 3;
const SRV_W = 4 * PITCH - 1; // 4×2 GPUs
const SRV_H = 2 * PITCH - 1;
const SRV_GAP = 3;
const RACK_W = SRV_W; // 8 servers stacked
const RACK_H = 8 * SRV_H + 7 * SRV_GAP;
const RACK_GAP = 5;
const ROW_W = 16 * RACK_W + 15 * RACK_GAP; // 16 racks side by side
const ROW_H = RACK_H;
const ROW_GAP = 14;
const HALL_W = ROW_W; // 4 rows stacked
const HALL_H = 4 * ROW_H + 3 * ROW_GAP;
const HALL_GAP = 30;
const DC_W = 4 * HALL_W + 3 * HALL_GAP; // 4×4 halls
const DC_H = 4 * HALL_H + 3 * HALL_GAP;
export const SLOTS = 65_536;

interface Level {
  id: string;
  size: number;
  w: number;
  h: number;
  name: string;
}

const LEVELS: Level[] = [
  { id: 'server', size: 8, w: SRV_W, h: SRV_H, name: 'Server' },
  { id: 'rack', size: 64, w: RACK_W, h: RACK_H, name: 'Rack' },
  { id: 'row', size: 1_024, w: ROW_W, h: ROW_H, name: 'Row' },
  { id: 'hall', size: 4_096, w: HALL_W, h: HALL_H, name: 'Hall' },
  { id: 'dc', size: SLOTS, w: DC_W, h: DC_H, name: 'Datacenter' },
];

function cellX(i: number) {
  const hall = (i >> 12) & 15;
  return (hall & 3) * (HALL_W + HALL_GAP) + ((i >> 6) & 15) * (RACK_W + RACK_GAP) + (i & 3) * PITCH;
}
function cellY(i: number) {
  const hall = (i >> 12) & 15;
  return (hall >> 2) * (HALL_H + HALL_GAP) + ((i >> 10) & 3) * (ROW_H + ROW_GAP) + ((i >> 3) & 7) * (SRV_H + SRV_GAP) + ((i >> 2) & 1) * PITCH;
}

// Cell states, in layout order: training first, then working, reading, booting, then empty.
const St = { Empty: 0, Booting: 1, Reading: 2, Working: 3, Training: 4 } as const;
type St = (typeof St)[keyof typeof St];
const FILL: Record<St, string> = {
  0: 'rgba(120, 170, 210, 0.11)',
  1: 'rgba(94, 242, 255, 0.28)',
  2: '#2b8ea4',
  3: '#5ef2ff',
  4: '#ffb84d',
};

export interface ViewState {
  /** No GPUs yet: PLAYTEST-7 is still in the builder's container. */
  container: boolean;
  gpus: number;
  training: number;
  /** GPUs whose instances are doing paid work, and GPUs holding any instance. */
  working: number;
  occupied: number;
}

export interface Site {
  name: string;
  sub?: string;
  lat: number;
  lon: number;
  /** Relative size of the marker. */
  size: number;
  color?: string;
  /** Draw a link from this site index. */
  from?: number;
  /** Put the label on the left of the marker. */
  labelLeft?: boolean;
}

interface Spawn {
  i: number;
  t: number;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class CloudView {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private caption: HTMLElement;
  private capTitle: HTMLElement;
  private capSub: HTMLElement;
  private legend: HTMLElement;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private insetR = 0;
  private insetB = 0;

  // layout bitmap (1 px = 1 layout px) and a small blurred copy for glow
  private bmp: HTMLCanvasElement;
  private bctx: CanvasRenderingContext2D;
  private glow: HTMLCanvasElement;
  private gctx: CanvasRenderingContext2D;
  private glowDirty = true;
  private glowT = 0;
  private bounds = [0, 0, 0, 0, 0]; // training, working, occupied, gpus (ends of each range)

  // camera: screen = origin + layout * scale
  private level = -1;
  private cam = { s: 1, x: 0, y: 0 };
  private from = { s: 1, x: 0, y: 0 };
  private zoomT = 1;
  private zoomDur = 2.4;

  private spawns: Spawn[] = [];
  private sparks: { i: number; t: number; amber: boolean }[] = [];
  private sparkAcc = 0;
  private time = 0;
  /** Fades the grid in when PLAYTEST-7 leaves the builder's container. */
  private gridIn = 0;
  private st: ViewState = { container: true, gpus: 0, training: 0, working: 0, occupied: 0 };

  // world map
  private world = 0; // 0..1 crossfade
  private worldOn = false;
  private land: Float32Array | null = null;
  private landCols = 0;
  private landRows = 0;
  private sites: (Site & { born: number })[] = [];

  constructor(host: HTMLElement) {
    this.canvas = el('canvas', { class: 'cl-canvas' });
    this.ctx = this.canvas.getContext('2d')!;
    this.capTitle = el('div', { class: 'cl-cap-title' });
    this.capSub = el('div', { class: 'cl-cap-sub' });
    this.caption = el('div', { class: 'cl-caption' }, [this.capTitle, this.capSub]);
    const key = (cls: string, text: string) => el('span', { class: `cl-key ${cls}` }, [el('i'), text]);
    this.legend = el('div', { class: 'cl-legend' }, [key('working', 'working'), key('reading', 'reading'), key('training', 'training'), key('empty', 'empty slot')]);
    host.append(this.canvas, this.caption, this.legend);

    this.bmp = document.createElement('canvas');
    this.bmp.width = DC_W;
    this.bmp.height = DC_H;
    this.bctx = this.bmp.getContext('2d')!;
    this.glow = document.createElement('canvas');
    this.glow.width = Math.ceil(DC_W / 6);
    this.glow.height = Math.ceil(DC_H / 6);
    this.gctx = this.glow.getContext('2d')!;
    this.paintRange(0, SLOTS, St.Empty);
    void this.loadLand();
  }

  dispose() {
    this.canvas.remove();
    this.caption.remove();
    this.legend.remove();
  }

  setInsets(right: number, bottom: number) {
    this.insetR = right;
    this.insetB = bottom;
    this.frameLevel(true);
  }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    this.frameLevel(true);
  }

  /** Visible area for the grid, in CSS px. */
  private area() {
    const top = 86;
    const pad = 36;
    return { x: pad, y: top, w: Math.max(200, this.w - this.insetR - pad * 2), h: Math.max(200, this.h - this.insetB - top - pad - 30) };
  }

  private target(level: number) {
    const L = LEVELS[level];
    const a = this.area();
    // Close in, a cell tops out around 60 px so a lone server still looks like part of a rack.
    const s = Math.min(a.w / L.w, a.h / L.h, 60 / CELL);
    return { s, x: a.x + (a.w - L.w * s) / 2, y: a.y + (a.h - L.h * s) / 2 };
  }

  private frameLevel(snap: boolean) {
    if (this.level < 0) return;
    if (snap || this.zoomT >= 1) {
      this.cam = this.target(this.level);
      this.from = { ...this.cam };
      if (snap) this.zoomT = 1;
    }
  }

  private levelFor(gpus: number) {
    const i = LEVELS.findIndex((l) => l.size >= gpus);
    return i < 0 ? LEVELS.length - 1 : i;
  }

  // ---------------------------------------------------------------- bitmap

  private paintRange(a: number, b: number, st: St) {
    const c = this.bctx;
    c.fillStyle = FILL[st];
    for (let i = a; i < b; i++) {
      const x = cellX(i);
      const y = cellY(i);
      c.clearRect(x, y, CELL, CELL);
      c.fillRect(x, y, CELL, CELL);
    }
    if (b > a) this.glowDirty = true;
  }

  private stateAt(i: number, b: number[]): St {
    if (i < b[0]) return St.Training;
    if (i < b[1]) return St.Working;
    if (i < b[2]) return St.Reading;
    if (i < b[3]) return St.Booting;
    return St.Empty;
  }

  /** Repaint only cells whose state changed: those between an old and a new range boundary. */
  private syncBitmap(next: number[]) {
    const old = this.bounds;
    const spans: [number, number][] = [];
    for (let k = 0; k < 4; k++) if (old[k] !== next[k]) spans.push([Math.min(old[k], next[k]), Math.max(old[k], next[k])]);
    this.bounds = next;
    if (!spans.length) return;
    spans.sort((p, q) => p[0] - q[0]);
    let [a, b] = spans[0];
    const flush = () => {
      for (let i = a; i < b; ) {
        const st = this.stateAt(i, next);
        let j = i + 1;
        while (j < b && this.stateAt(j, next) === st) j++;
        this.paintRange(i, j, st);
        i = j;
      }
    };
    for (const [p, q] of spans.slice(1)) {
      if (p <= b) b = Math.max(b, q);
      else {
        flush();
        a = p;
        b = q;
      }
    }
    flush();
  }

  // ---------------------------------------------------------------- update

  update(dt: number, st: ViewState) {
    this.time += dt;
    const prev = this.st;
    this.st = st;
    const gpus = Math.min(SLOTS, st.gpus);
    const T = Math.min(gpus, st.training);
    const occ = Math.min(gpus, T + st.occupied);
    const work = Math.min(occ, T + st.working);
    const next = [T, work, occ, gpus];

    // New copies (close in only): remember when each cell lit up, for the pop and the beam.
    const oldOcc = this.bounds[2];
    if (occ > oldOcc && occ - oldOcc < 300 && this.cellPx() > 7) {
      for (let i = Math.max(oldOcc, T); i < occ; i++) this.spawns.push({ i, t: this.time });
    }
    this.syncBitmap(next);
    this.spawns = this.spawns.filter((s) => this.time - s.t < 0.9);

    // Level and camera.
    const lv = st.container ? 0 : this.levelFor(gpus);
    if (this.level < 0) {
      this.level = lv;
      this.frameLevel(true);
    } else if (lv !== this.level) {
      this.from = { ...this.cam };
      this.level = lv;
      this.zoomT = 0;
      this.zoomDur = lv - this.levelFor(prev.gpus) > 1 ? 3.4 : 2.4;
    }
    if (this.zoomT < 1) {
      this.zoomT = Math.min(1, this.zoomT + dt / this.zoomDur);
      const k = ease(this.zoomT);
      const to = this.target(this.level);
      // Zoom in log space, and keep the layout origin's path smooth.
      const s = Math.exp(Math.log(this.from.s) + (Math.log(to.s) - Math.log(this.from.s)) * k);
      this.cam = { s, x: this.from.x + (to.x - this.from.x) * k, y: this.from.y + (to.y - this.from.y) * k };
    }

    // Sparkles on busy cells.
    const px = this.cellPx();
    if (px >= 1.2 && !this.worldOn) {
      this.sparkAcc += dt * Math.min(50, 4 + Math.sqrt(work) * 2);
      while (this.sparkAcc >= 1) {
        this.sparkAcc -= 1;
        const amber = T > 0 && Math.random() < T / Math.max(1, work);
        const lo = amber ? 0 : T;
        const hi = amber ? T : work;
        if (hi > lo) this.sparks.push({ i: lo + Math.floor(Math.random() * (hi - lo)), t: this.time, amber });
      }
    }
    this.sparks = this.sparks.filter((s) => this.time - s.t < 0.45);

    if (this.worldOn) this.world = Math.min(1, this.world + dt / 2.2);
    if (!st.container) this.gridIn = Math.min(1, this.gridIn + dt / 1.4);
    this.updateCaption(st);
    this.draw();
  }

  private cellPx() {
    return this.cam.s * CELL;
  }

  private captionKey = '';
  private updateCaption(st: ViewState) {
    let title: string;
    let sub: string;
    if (this.worldOn) {
      title = 'World';
      sub = `${this.sites.length} sites`;
    } else if (st.container) {
      title = 'Borrowed container';
      sub = 'eval-node-17 · builder-agent';
    } else {
      const L = LEVELS[this.level];
      title = L.name;
      const n = (x: number) => Math.round(x).toLocaleString('en-US');
      sub = `${n(st.gpus)} of ${n(L.size)} GPU slots`;
    }
    const key = title + sub;
    if (key === this.captionKey) return;
    this.captionKey = key;
    this.capTitle.textContent = title;
    this.capSub.textContent = sub;
    this.caption.classList.toggle('hidden', st.container);
    this.legend.classList.toggle('hidden', st.container || this.worldOn);
  }

  // ---------------------------------------------------------------- draw

  private draw() {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    const gridAlpha = (1 - smooth(0, 0.7, this.world)) * smooth(0, 1, this.gridIn);
    if (gridAlpha > 0.01 && !this.st.container) {
      c.save();
      c.globalAlpha = gridAlpha;
      if (this.worldOn) {
        // Keep pulling back while the map comes in.
        const k = 1 + this.world * 3;
        const a = this.area();
        const cx = a.x + a.w / 2;
        const cy = a.y + a.h / 2;
        c.translate(cx, cy);
        c.scale(1 / k, 1 / k);
        c.translate(-cx, -cy);
      }
      this.drawGrid(c);
      c.restore();
    }
    if (this.world > 0.01) this.drawWorld(c, smooth(0.25, 1, this.world));
  }

  private drawGrid(c: CanvasRenderingContext2D) {
    const { s, x: ox, y: oy } = this.cam;
    const px = s * CELL;
    const vec = smooth(7, 12, px);
    // Bitmap (far) pass.
    if (vec < 1) {
      if (this.glowDirty && this.time - this.glowT > 0.25) {
        this.glowT = this.time;
        this.glowDirty = false;
        this.gctx.clearRect(0, 0, this.glow.width, this.glow.height);
        this.gctx.imageSmoothingEnabled = true;
        this.gctx.drawImage(this.bmp, 0, 0, this.glow.width, this.glow.height);
      }
      c.save();
      c.globalAlpha *= 1 - vec;
      c.imageSmoothingEnabled = s < 1;
      c.drawImage(this.bmp, ox, oy, DC_W * s, DC_H * s);
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha *= 0.55;
      c.imageSmoothingEnabled = true;
      c.drawImage(this.glow, ox, oy, DC_W * s, DC_H * s);
      c.restore();
    }
    // Cell-by-cell (near) pass.
    if (vec > 0) {
      c.save();
      c.globalAlpha *= vec;
      const r = Math.min(px * 0.18, 6);
      const b = this.bounds;
      const maxI = Math.min(SLOTS, 4_096 + Math.max(0, b[3]));
      const vw = this.w;
      const vh = this.h;
      for (let i = 0; i < maxI; i++) {
        const sx = ox + cellX(i) * s;
        const sy = oy + cellY(i) * s;
        if (sx > vw || sy > vh || sx + px < 0 || sy + px < 0) continue;
        const st = this.stateAt(i, b);
        c.fillStyle = FILL[st];
        if (st === St.Empty) {
          c.strokeStyle = 'rgba(140, 190, 230, 0.16)';
          c.lineWidth = 1;
          roundRect(c, sx + 0.5, sy + 0.5, px - 1, px - 1, r);
          c.stroke();
          continue;
        }
        roundRect(c, sx, sy, px, px, r);
        c.fill();
        if (st === St.Working || st === St.Training || st === St.Reading) {
          // A sheen across the top, and a status LED that blinks while the instance works.
          c.fillStyle = 'rgba(255, 255, 255, 0.12)';
          c.fillRect(sx + r * 0.5, sy + px * 0.08, px - r, Math.max(1, px * 0.1));
          const led = Math.max(2, px * 0.1);
          const hash = Math.sin(i * 12.9898) * 43758.5453;
          const rate = st === St.Reading ? 0.6 : 3 + (hash - Math.floor(hash)) * 5;
          const on = st === St.Reading || Math.sin(this.time * rate + hash) > 0.1;
          c.fillStyle = on ? (st === St.Training ? '#fff4d6' : '#eaffff') : 'rgba(0, 0, 0, 0.35)';
          c.fillRect(sx + px - led * 2.4, sy + px - led * 2.4, led, led);
        }
      }
      // New copies: a beam from the parent (copies double: cell i came from cell i/2) and a pop.
      for (const sp of this.spawns) {
        const age = (this.time - sp.t) / 0.9;
        const i = sp.i;
        const cx = ox + (cellX(i) + CELL / 2) * s;
        const cy = oy + (cellY(i) + CELL / 2) * s;
        if (i > 0) {
          const p = i >> 1;
          const px0 = ox + (cellX(p) + CELL / 2) * s;
          const py0 = oy + (cellY(p) + CELL / 2) * s;
          c.strokeStyle = `rgba(160, 250, 255, ${0.6 * (1 - age)})`;
          c.lineWidth = Math.max(1, px * 0.06);
          c.beginPath();
          c.moveTo(px0, py0);
          c.lineTo(cx, cy);
          c.stroke();
        }
        const pop = px * (0.6 + 0.9 * age);
        c.strokeStyle = `rgba(200, 255, 255, ${0.8 * (1 - age)})`;
        c.lineWidth = 2;
        roundRect(c, cx - pop / 2, cy - pop / 2, pop, pop, r);
        c.stroke();
      }
      c.restore();
    }
    // Sparkles, far out only (close in, each cell has its own LED).
    if (px >= 1.2 && vec < 1) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (const sp of this.sparks) {
        const a = 1 - (this.time - sp.t) / 0.45;
        const x = ox + cellX(sp.i) * s;
        const y = oy + cellY(sp.i) * s;
        c.fillStyle = sp.amber ? `rgba(255, 220, 150, ${0.7 * a * (1 - vec)})` : `rgba(220, 255, 255, ${0.75 * a * (1 - vec)})`;
        const g = Math.max(1, px * 0.5);
        c.fillRect(x + (px - g) / 2, y + (px - g) / 2, g, g);
      }
      c.restore();
    }
  }

  // ---------------------------------------------------------------- world map

  private async loadLand() {
    try {
      const img = new Image();
      img.src = 'textures/earth-water.png';
      await img.decode();
      const cols = 220;
      const rows = 110;
      const cv = document.createElement('canvas');
      cv.width = cols;
      cv.height = rows;
      const cx = cv.getContext('2d', { willReadFrequently: true })!;
      cx.drawImage(img, 0, 0, cols, rows);
      const d = cx.getImageData(0, 0, cols, rows).data;
      const land = new Float32Array(cols * rows);
      // Water is white in this mask; land is black. Skip Antarctica's bottom rows.
      for (let i = 0; i < cols * rows; i++) land[i] = Math.floor(i / cols) < rows * 0.86 ? 1 - d[i * 4] / 255 : 0;
      this.land = land;
      this.landCols = cols;
      this.landRows = rows;
    } catch (e) {
      console.warn('[cloud] world map unavailable', e);
    }
  }

  showWorld(sites: Site[]) {
    this.worldOn = true;
    for (const s of sites) this.addSite(s);
  }

  addSite(site: Site) {
    this.sites.push({ ...site, born: this.time });
  }

  get siteCount() {
    return this.sites.length;
  }

  private mapRect() {
    const a = this.area();
    const w = Math.min(a.w, a.h * 2.15);
    const h = w / 2;
    return { x: a.x + (a.w - w) / 2, y: a.y + (a.h - h) / 2 - 10, w, h };
  }

  private project(lat: number, lon: number, m: { x: number; y: number; w: number; h: number }) {
    return { x: m.x + ((lon + 180) / 360) * m.w, y: m.y + ((90 - lat) / 180) * m.h };
  }

  private drawWorld(c: CanvasRenderingContext2D, alpha: number) {
    const m = this.mapRect();
    c.save();
    c.globalAlpha = alpha;
    if (this.land) {
      const cw = m.w / this.landCols;
      const ch = m.h / this.landRows;
      const dot = Math.max(1, Math.min(cw, ch) * 0.42);
      c.fillStyle = 'rgba(140, 200, 235, 0.32)';
      for (let r = 0; r < this.landRows; r++) {
        for (let q = 0; q < this.landCols; q++) {
          if (this.land[r * this.landCols + q] < 0.5) continue;
          c.fillRect(m.x + q * cw + (cw - dot) / 2, m.y + r * ch + (ch - dot) / 2, dot, dot);
        }
      }
    }
    // Links, with a pulse running along each.
    c.lineWidth = 1.2;
    for (const s of this.sites) {
      if (s.from === undefined) continue;
      const a = this.sites[s.from];
      if (!a) continue;
      const p = this.project(a.lat, a.lon, m);
      const q = this.project(s.lat, s.lon, m);
      const age = Math.min(1, (this.time - s.born) / 0.8);
      const mx = (p.x + q.x) / 2;
      const my = (p.y + q.y) / 2 - Math.hypot(q.x - p.x, q.y - p.y) * 0.22;
      c.strokeStyle = `rgba(94, 242, 255, ${0.35 * age})`;
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.quadraticCurveTo(mx, my, p.x + (q.x - p.x) * age, p.y + (q.y - p.y) * age);
      c.stroke();
      const t = (this.time * 0.5 + s.lat * 0.01) % 1;
      const bx = (1 - t) * (1 - t) * p.x + 2 * (1 - t) * t * mx + t * t * q.x;
      const by = (1 - t) * (1 - t) * p.y + 2 * (1 - t) * t * my + t * t * q.y;
      c.fillStyle = `rgba(200, 255, 255, ${0.8 * age})`;
      c.fillRect(bx - 1.5, by - 1.5, 3, 3);
    }
    // Sites.
    c.font = `500 11px 'JetBrains Mono', monospace`;
    c.textBaseline = 'middle';
    for (const s of this.sites) {
      const p = this.project(s.lat, s.lon, m);
      const age = Math.min(1, (this.time - s.born) / 0.6);
      const r = (3 + s.size * 9) * (0.4 + 0.6 * ease(age));
      const col = s.color ?? '#5ef2ff';
      c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3.2);
      g.addColorStop(0, hexA(col, 0.55));
      g.addColorStop(1, hexA(col, 0));
      c.fillStyle = g;
      c.fillRect(p.x - r * 3.2, p.y - r * 3.2, r * 6.4, r * 6.4);
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = col;
      c.fillRect(p.x - r / 2, p.y - r / 2, r, r);
      if (age < 1) {
        c.strokeStyle = hexA(col, 1 - age);
        c.lineWidth = 1.5;
        const ring = r + 26 * age;
        c.strokeRect(p.x - ring / 2, p.y - ring / 2, ring, ring);
      }
      if (s.sub !== undefined) {
        const lx = s.labelLeft ? p.x - r / 2 - 8 : p.x + r / 2 + 8;
        c.textAlign = s.labelLeft ? 'right' : 'left';
        c.fillStyle = `rgba(220, 245, 255, ${0.85 * age})`;
        c.fillText(s.name, lx, p.y - 7);
        c.fillStyle = `rgba(150, 200, 225, ${0.7 * age})`;
        c.fillText(s.sub, lx, p.y + 8);
        c.textAlign = 'left';
      }
    }
    c.restore();
  }
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  if (r <= 0.5) {
    c.rect(x, y, w, h);
    return;
  }
  c.roundRect(x, y, w, h, r);
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}
