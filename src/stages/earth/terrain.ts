// CPU side of the globe: decodes the NASA textures, builds the data texture the globe shader
// samples, and computes hypsometry (how much land is above a given sea level) from exactly the
// same numbers, so the sidebar always agrees with what the globe shows.
//
// Data texture (RGBA8, 2048×1024, row 0 = south so it lines up with SphereGeometry UVs):
//   R  elevation in "gray units" (0..242). Shader adds sub-unit dither noise; see elevOf().
//   G  original water mask (255 = ocean, lakes and rivers)
//   B  ice-sheet mask (Antarctica, Greenland)
//   A  ice melt threshold: the cell melts once iceMelt exceeds A/255 (coasts first, domes last)

import * as THREE from 'three';

export const TEX_W = 2048;
export const TEX_H = 1024;

/** Gray units at which elevation reaches the top of the curve (Everest's summit cell is 242). */
export const G_TOP = 243;
export const EVEREST_M = 8849;
export const H_POW = 1.083;

/** Elevation in metres for a dithered gray value x (0..243). Everest = 8,849 m, median land ≈ 510 m. */
export function elevOf(x: number): number {
  return EVEREST_M * Math.pow(Math.max(0, x) / G_TOP, H_POW);
}
function grayOf(m: number): number {
  return m <= 0 ? 0 : G_TOP * Math.pow(m / EVEREST_M, 1 / H_POW);
}

export const EARTH_AREA_KM2 = 510.1e6;
export const OCEAN_KM3 = 1.335e9;
const MELT_BINS = 32;
const VOL_STEP = 5; // metres
const VOL_MAX = 9400;

export const EVEREST = { lat: 27.988, lon: 86.925 };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

/** Raw pixel values: the elevation PNG carries an ICC gray-gamma profile the browser would apply. */
async function loadRaw(src: string): Promise<ImageBitmap> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`failed to load ${src}`);
  return createImageBitmap(await res.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
}

function pixels(img: CanvasImageSource, w: number, h: number): Uint8ClampedArray {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class Terrain {
  dayImg!: HTMLImageElement;
  nightImg!: HTMLImageElement;
  dataTex!: THREE.DataTexture;
  /** cos(lat)-weighted histograms. */
  private hLand = new Float64Array(256);
  private hIce = new Float64Array(256 * MELT_BINS);
  private hIceTot = new Float64Array(256);
  private hVeg = new Float64Array(256);
  private hLights = new Float64Array(256);
  private totalW = 0;
  private veg0 = 0;
  private lights0 = 0;
  /** Cumulative added ocean volume (km³) at sea level i*VOL_STEP, with ice fully melted. */
  private volTable = new Float64Array(Math.ceil(VOL_MAX / VOL_STEP) + 1);
  land0 = 0;
  /** Original ocean cells (lat, lon in degrees), for placing ships and drones. */
  private oceanCells: Uint32Array = new Uint32Array(0);
  private waterMask!: Uint8Array;

  async load(base = 'textures/') {
    const [day, night, topo, water] = await Promise.all([
      loadImage(`${base}earth-blue-marble.jpg`),
      loadImage(`${base}earth-night.jpg`),
      loadRaw(`${base}earth-topology.png`),
      loadRaw(`${base}earth-water.png`),
    ]);
    this.dayImg = day;
    this.nightImg = night;
    this.build(pixels(topo, TEX_W, TEX_H), pixels(water, TEX_W, TEX_H), pixels(day, TEX_W, TEX_H), pixels(night, TEX_W, TEX_H));
    topo.close();
    water.close();
  }

  private build(topo: Uint8ClampedArray, water: Uint8ClampedArray, day: Uint8ClampedArray, night: Uint8ClampedArray) {
    const W = TEX_W;
    const H = TEX_H;
    const data = new Uint8Array(W * H * 4);
    const wm = new Uint8Array(W * H);
    const ocean: number[] = [];
    const evX = ((EVEREST.lon + 180) / 360) * W;
    const evY = ((90 - EVEREST.lat) / 180) * H;
    for (let y = 0; y < H; y++) {
      const lat = 90 - ((y + 0.5) / H) * 180;
      const w = Math.cos((lat * Math.PI) / 180);
      const row = (H - 1 - y) * W;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const p = i * 4;
        const lon = ((x + 0.5) / W) * 360 - 180;
        let g = topo[p];
        // Everest is the summit of the world; flatten a few noisy Kunlun texels that beat it.
        const nearEverest = Math.hypot(x - evX, y - evY) < 3;
        if (!nearEverest) g = Math.min(g, 238);
        else g = Math.min(g, 242);
        const wv = water[p];
        const isWater = wv >= 128;
        wm[i] = isWater ? 1 : 0;
        if (isWater && (x & 3) === 0 && (y & 3) === 0 && Math.abs(lat) < 72) ocean.push(i);
        const r = day[p];
        const gg = day[p + 1];
        const b = day[p + 2];
        const bright = (r + gg + b) / 3;
        let ice = 0;
        if (!isWater) {
          if (lat < -60) ice = 1;
          else if (lat > 59 && lon > -74 && lon < -10 && (bright > 140 || g > 30)) ice = 1;
        }
        let thr = 0;
        if (ice) {
          const e = elevOf(g + 0.5);
          thr = 0.04 + 0.9 * Math.pow(Math.min(1, e / 3800), 0.85) + (hash2(x, y) - 0.5) * 0.05;
          thr = Math.min(0.97, Math.max(0.02, thr));
        }
        const o = (row + x) * 4;
        data[o] = g;
        data[o + 1] = wv;
        data[o + 2] = ice ? 255 : 0;
        data[o + 3] = Math.round(thr * 255);
        this.totalW += w;
        if (isWater) continue;
        if (ice) {
          const bin = Math.min(MELT_BINS - 1, Math.floor(Math.round(thr * 255) / 255 * MELT_BINS));
          this.hIce[g * MELT_BINS + bin] += w;
          this.hIceTot[g] += w;
        } else {
          this.hLand[g] += w;
          // Vegetation: green and not too bright (forest, savanna, farmland).
          const green = Math.min(1, Math.max(0, (gg - 0.5 * (r + b)) / 25));
          const darkness = 1 - Math.min(1, Math.max(0, (bright - 110) / 60));
          const veg = green * darkness;
          this.hVeg[g] += w * veg;
          this.veg0 += w * veg;
          const lights = cityLightsOf(night[p], night[p + 1], night[p + 2]);
          this.hLights[g] += w * lights;
          this.lights0 += w * lights;
        }
      }
    }
    this.waterMask = wm;
    this.oceanCells = Uint32Array.from(ocean);
    const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = THREE.NoColorSpace;
    tex.needsUpdate = true;
    this.dataTex = tex;
    this.land0 = this.landFrac(0, 0);
    // Volume table: integrate water area over sea level (ice fully melted).
    let v = 0;
    this.volTable[0] = 0;
    let water0 = 1 - this.landFrac(0, 1);
    for (let k = 1; k < this.volTable.length; k++) {
      const water1 = 1 - this.landFrac(k * VOL_STEP, 1);
      v += EARTH_AREA_KM2 * ((water0 + water1) / 2) * (VOL_STEP / 1000);
      this.volTable[k] = v;
      water0 = water1;
    }
  }

  /** Fraction of a gray bucket g whose dithered elevation is above sea level s (gray units). */
  private static above(g: number, xs: number) {
    const f = g + 1 - xs;
    return f <= 0 ? 0 : f >= 1 ? 1 : f;
  }

  /** Fraction of Earth's surface that is land above water. */
  landFrac(sea: number, melt: number): number {
    const xs = grayOf(sea);
    let sum = 0;
    const g0 = Math.max(0, Math.floor(xs) - 1);
    for (let g = g0; g < 256; g++) {
      const a = g < xs - 1 ? 0 : Terrain.above(g, xs);
      if (a === 0) continue;
      sum += this.hLand[g] * a;
      if (melt <= 0) sum += this.hIceTot[g] * a;
      else if (melt < 1 && this.hIceTot[g]) {
        for (let b = Math.floor(melt * MELT_BINS); b < MELT_BINS; b++) {
          const thr = (b + 0.5) / MELT_BINS;
          if (melt < thr) sum += this.hIce[g * MELT_BINS + b] * a;
        }
      }
    }
    return sum / this.totalW;
  }

  /** Fraction of the original vegetated land still above water. */
  vegFrac(sea: number): number {
    return this.weighted(this.hVeg, sea) / this.veg0;
  }
  /** Fraction of the original city lights still above water. */
  lightsFrac(sea: number): number {
    return this.weighted(this.hLights, sea) / this.lights0;
  }
  private weighted(h: Float64Array, sea: number) {
    const xs = grayOf(sea);
    let sum = 0;
    for (let g = Math.max(0, Math.floor(xs) - 1); g < 256; g++) sum += h[g] * Terrain.above(g, xs);
    return sum;
  }

  /** Added ocean volume (km³) needed to raise sea level to `sea` metres (ice melted). */
  volumeFor(sea: number): number {
    if (sea <= 0) return 0;
    const k = sea / VOL_STEP;
    const i = Math.min(this.volTable.length - 2, Math.floor(k));
    const t = k - i;
    return this.volTable[i] + (this.volTable[i + 1] - this.volTable[i]) * t;
  }

  /** Sea level (m) produced by an added volume (km³). */
  seaFor(volume: number): number {
    if (volume <= 0) return 0;
    const tbl = this.volTable;
    let lo = 0;
    let hi = tbl.length - 1;
    if (volume >= tbl[hi]) {
      // Beyond the table the planet is all ocean: extra volume spreads over the whole sphere.
      return hi * VOL_STEP + ((volume - tbl[hi]) / EARTH_AREA_KM2) * 1000;
    }
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (tbl[mid] < volume) lo = mid;
      else hi = mid;
    }
    const t = (volume - tbl[lo]) / (tbl[hi] - tbl[lo] || 1);
    return (lo + t) * VOL_STEP;
  }

  /** Random original-ocean point, optionally filtered. Returns [lat, lon]. */
  randomOcean(filter?: (lat: number, lon: number) => boolean, tries = 60): [number, number] {
    for (let k = 0; k < tries; k++) {
      const i = this.oceanCells[Math.floor(Math.random() * this.oceanCells.length)];
      const y = Math.floor(i / TEX_W);
      const x = i % TEX_W;
      const lat = 90 - ((y + Math.random() * 4) / TEX_H) * 180;
      const lon = ((x + Math.random() * 4) / TEX_W) * 360 - 180;
      if (!filter || filter(lat, lon)) return [lat, lon];
    }
    return [0, -150];
  }

  isWater(lat: number, lon: number): boolean {
    const x = Math.floor(((lon + 180) / 360) * TEX_W) % TEX_W;
    const y = Math.min(TEX_H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * TEX_H)));
    return this.waterMask[y * TEX_W + x] === 1;
  }

  dispose() {
    this.dataTex?.dispose();
  }
}

const lin = (c: number) => Math.pow((c / 255 + 0.055) / 1.055, 2.4) * 255;
/** Same formula as the shader (in linear light): warm city light minus the bluish moonlit ambient. */
export function cityLightsOf(r: number, g: number, b: number): number {
  const v = (Math.max(lin(r), lin(g)) - 0.8 * lin(b) - 0.6) / 6;
  return v <= 0 ? 0 : v >= 1 ? 1 : v;
}
