// Procedural equirectangular planet textures, painted on a canvas from 3D noise sampled on the
// sphere (so there is no seam at the date line).

import * as THREE from 'three';

// ---------------------------------------------------------------- noise

const PERM = new Uint8Array(512);
const GRAD = new Float32Array(256);
(() => {
  let seed = 1234567;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  for (let i = 0; i < 256; i++) GRAD[i] = rnd();
})();

const fade = (t: number) => t * t * (3 - 2 * t);

function vnoise(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const X = xi & 255, Y = yi & 255, Z = zi & 255;
  const u = fade(xf), v = fade(yf), w = fade(zf);
  const h = (a: number, b: number, c: number) => GRAD[PERM[PERM[PERM[a] + b] + c]];
  const X1 = (X + 1) & 255, Y1 = (Y + 1) & 255, Z1 = (Z + 1) & 255;
  const x00 = h(X, Y, Z) + (h(X1, Y, Z) - h(X, Y, Z)) * u;
  const x10 = h(X, Y1, Z) + (h(X1, Y1, Z) - h(X, Y1, Z)) * u;
  const x01 = h(X, Y, Z1) + (h(X1, Y, Z1) - h(X, Y, Z1)) * u;
  const x11 = h(X, Y1, Z1) + (h(X1, Y1, Z1) - h(X, Y1, Z1)) * u;
  const y0 = x00 + (x10 - x00) * v;
  const y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

export function fbm(x: number, y: number, z: number, oct = 5): number {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x * f, y * f, z * f);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}

// ---------------------------------------------------------------- painting

type RGB = [number, number, number];
type Shader = (x: number, y: number, z: number, lat: number) => RGB;

function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function ramp(stops: [number, string][]): (t: number) => RGB {
  const s = stops.map(([t, c]) => [t, hex(c)] as [number, RGB]);
  return (t: number) => {
    if (t <= s[0][0]) return s[0][1];
    for (let i = 1; i < s.length; i++) {
      if (t <= s[i][0]) {
        const [t0, c0] = s[i - 1];
        const [t1, c1] = s[i];
        const k = (t - t0) / (t1 - t0);
        return [c0[0] + (c1[0] - c0[0]) * k, c0[1] + (c1[1] - c0[1]) * k, c0[2] + (c1[2] - c0[2]) * k];
      }
    }
    return s[s.length - 1][1];
  };
}

function paint(w: number, h: number, shader: Shader): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let j = 0; j < h; j++) {
    const lat = Math.PI / 2 - ((j + 0.5) / h) * Math.PI;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      const lon = ((i + 0.5) / w) * Math.PI * 2;
      const x = cl * Math.cos(lon), z = cl * Math.sin(lon);
      const [r, g, b] = shader(x, sl, z, lat);
      const k = (j * w + i) * 4;
      d[k] = r;
      d[k + 1] = g;
      d[k + 2] = b;
      d[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function toTex(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Craters: darken rims and lighten floors around random centres on the sphere. */
function cratered(base: (t: number) => RGB, freq: number, count: number, seed: number, dark = 0.55): Shader {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const craters: [number, number, number, number][] = [];
  for (let i = 0; i < count; i++) {
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    const size = 0.03 + Math.pow(rnd(), 3) * 0.22;
    craters.push([r * Math.cos(th), u, r * Math.sin(th), size]);
  }
  return (x, y, z) => {
    let t = fbm(x * freq + 7, y * freq, z * freq, 5);
    // large maria-like patches
    const m = fbm(x * 1.6 + 3, y * 1.6, z * 1.6, 3);
    t -= Math.max(0, m - 0.55) * dark;
    for (const [cx, cy, cz, sz] of craters) {
      const dx = x - cx, dy = y - cy, dz = z - cz;
      const dd = Math.sqrt(dx * dx + dy * dy + dz * dz) / sz;
      if (dd < 1.25) {
        if (dd < 0.85) t -= 0.07 * (1 - dd / 0.85);
        else if (dd < 1.0) t += 0.09 * (1 - Math.abs(dd - 0.92) / 0.08);
      }
    }
    return base(t);
  };
}

function banded(r: (t: number) => RGB, opts: { bands: number; turb: number; spot?: [number, number, number, RGB]; seed: number }): Shader {
  return (x, y, z, lat) => {
    const warp = fbm(x * 3 + opts.seed, y * 3, z * 3, 4) - 0.5;
    const fine = fbm(x * 9 + opts.seed, y * 22, z * 9, 3) - 0.5;
    const t = 0.5 + 0.5 * Math.sin(lat * opts.bands + warp * opts.turb * 6) * 0.8 + fine * 0.25;
    let col = r(Math.max(0, Math.min(1, t)));
    if (opts.spot) {
      const [slat, slon, size, sc] = opts.spot;
      const lon = Math.atan2(z, x);
      const dl = lat - slat;
      let dlon = lon - slon;
      if (dlon > Math.PI) dlon -= Math.PI * 2;
      if (dlon < -Math.PI) dlon += Math.PI * 2;
      const e = Math.sqrt((dl / size) ** 2 + (dlon / (size * 1.9)) ** 2);
      if (e < 1) {
        const k = Math.pow(1 - e, 0.6) * (0.75 + fine);
        col = [col[0] + (sc[0] - col[0]) * k, col[1] + (sc[1] - col[1]) * k, col[2] + (sc[2] - col[2]) * k];
      }
    }
    return col;
  };
}

export interface PlanetTextures {
  [id: string]: THREE.Texture;
}

/** Earth after the flood: no land, deep blue, clouds. */
function earthShader(): Shader {
  const sea = ramp([
    [0, '#06224d'],
    [0.5, '#0b3f86'],
    [1, '#1767b8'],
  ]);
  return (x, y, z, lat) => {
    const t = fbm(x * 2.5, y * 2.5, z * 2.5, 4);
    const c = sea(t);
    // cloud bands: denser in mid-latitudes, swirled
    const sw = fbm(x * 2 + 11, y * 2, z * 2, 3);
    const cl = fbm(x * 5 + sw * 2.2, y * 9 + sw, z * 5, 5);
    const band = 0.55 + 0.25 * Math.cos(lat * 4.2);
    let k = Math.max(0, Math.min(1, (cl - (1 - band * 0.62)) * 4.2));
    k *= 0.92;
    return [c[0] + (245 - c[0]) * k, c[1] + (248 - c[1]) * k, c[2] + (255 - c[2]) * k];
  };
}

export function makePlanetTextures(): PlanetTextures {
  const S = 256, M = 512;
  const out: PlanetTextures = {};
  out.earth = toTex(paint(M, M / 2, earthShader()));
  out.moon = toTex(paint(S * 2, S, cratered(ramp([[0.15, '#3f3f42'], [0.5, '#8e8c88'], [0.8, '#c9c6bf']]), 6, 70, 99)));
  out.mercury = toTex(paint(S, S / 2, cratered(ramp([[0.15, '#3a332e'], [0.5, '#82766a'], [0.85, '#b9ab9a']]), 7, 60, 7, 0.3)));
  out.venus = toTex(
    paint(S, S / 2, (x, y, z, lat) => {
      const w = fbm(x * 2 + 5, y * 2, z * 2, 3);
      const t = fbm(x * 3 + w * 2, y * 6 + Math.sin(lat * 3) * 0.6, z * 3, 5);
      return ramp([[0.2, '#a9793f'], [0.5, '#dcb874'], [0.8, '#f3e1b0']])(t);
    }),
  );
  out.mars = toTex(
    paint(S, S / 2, (x, y, z, lat) => {
      const t = fbm(x * 3 + 2, y * 3, z * 3, 6);
      const c = ramp([[0.25, '#5a2614'], [0.48, '#9c4a26'], [0.7, '#cf7a45'], [0.9, '#e2a272']])(t);
      const cap = Math.max(0, (Math.abs(lat) - 1.3) * 6);
      const k = Math.min(1, cap);
      return [c[0] + (240 - c[0]) * k, c[1] + (236 - c[1]) * k, c[2] + (230 - c[2]) * k];
    }),
  );
  out.jupiter = toTex(
    paint(M, M / 2, banded(ramp([[0, '#6e4a2e'], [0.3, '#b98a5c'], [0.55, '#e8d4b4'], [0.75, '#c99a6b'], [1, '#f5ebd9']]), { bands: 13, turb: 0.9, seed: 3, spot: [-0.38, 1.2, 0.11, hex('#b5532e')] })),
  );
  out.saturn = toTex(paint(M, M / 2, banded(ramp([[0, '#9a7d52'], [0.4, '#d6bd8a'], [0.7, '#ecdcb4'], [1, '#f6ecd2']]), { bands: 11, turb: 0.4, seed: 9 })));
  out.uranus = toTex(paint(S, S / 2, banded(ramp([[0, '#86c9d4'], [0.6, '#a6dde4'], [1, '#c4ecef']]), { bands: 7, turb: 0.15, seed: 4 })));
  out.neptune = toTex(
    paint(S, S / 2, banded(ramp([[0, '#1f3f9a'], [0.5, '#3866d0'], [1, '#6f97e8']]), { bands: 9, turb: 0.5, seed: 8, spot: [-0.35, 2.0, 0.14, hex('#16245e')] })),
  );
  out.io = toTex(paint(128, 64, cratered(ramp([[0.2, '#7a5a1c'], [0.5, '#d8b545'], [0.8, '#f2e7a0']]), 5, 20, 3, 0.2)));
  out.europa = toTex(paint(128, 64, cratered(ramp([[0.2, '#8d7a62'], [0.55, '#c9b9a0'], [0.9, '#eee6d6']]), 9, 6, 5, 0.1)));
  out.ganymede = toTex(paint(128, 64, cratered(ramp([[0.2, '#4c443c'], [0.55, '#8a7f71'], [0.9, '#c4baa8']]), 5, 30, 11, 0.5)));
  out.callisto = toTex(paint(128, 64, cratered(ramp([[0.2, '#2f2a25'], [0.55, '#5f554a'], [0.9, '#a39784']]), 6, 50, 13, 0.3)));
  out.titan = toTex(paint(128, 64, (x, y, z) => ramp([[0.3, '#b77a2c'], [0.7, '#e3a84e']])(fbm(x * 2, y * 4, z * 2, 3))));
  out.enceladus = toTex(paint(64, 32, (x, y, z) => ramp([[0.3, '#c7d4dc'], [0.7, '#ffffff']])(fbm(x * 4, y * 4, z * 4, 3))));
  out.pluto = toTex(
    paint(128, 64, (x, y, z) => {
      const t = fbm(x * 3, y * 3, z * 3, 4);
      const heart = Math.sqrt((x - 0.75) ** 2 + (y + 0.1) ** 2 + (z - 0.4) ** 2) < 0.45 ? 0.35 : 0;
      return ramp([[0.2, '#5c4232'], [0.55, '#b48a6a'], [1, '#f2e2cf']])(t + heart);
    }),
  );
  out.ocean = toTex(paint(128, 64, (x, y, z) => ramp([[0.2, '#0a3a80'], [0.6, '#1d74c8'], [1, '#6ec3ff']])(fbm(x * 3, y * 3, z * 3, 4))));
  return out;
}

/** Glowing seams for bodies under disassembly (used as an emissive map). */
export function makeCrackTexture(): THREE.CanvasTexture {
  const pts: [number, number, number][] = [];
  let s = 4242;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 46; i++) {
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    pts.push([r * Math.cos(th), u, r * Math.sin(th)]);
  }
  const c = paint(512, 256, (x, y, z) => {
    // jitter the lookup for organic edges
    const jx = x + (fbm(x * 6, y * 6, z * 6, 3) - 0.5) * 0.18;
    const jy = y + (fbm(x * 6 + 9, y * 6, z * 6, 3) - 0.5) * 0.18;
    const jz = z + (fbm(x * 6, y * 6 + 5, z * 6, 3) - 0.5) * 0.18;
    let d1 = 9, d2 = 9;
    for (const [px, py, pz] of pts) {
      const d = (jx - px) ** 2 + (jy - py) ** 2 + (jz - pz) ** 2;
      if (d < d1) {
        d2 = d1;
        d1 = d;
      } else if (d < d2) d2 = d;
    }
    const edge = Math.sqrt(d2) - Math.sqrt(d1);
    const k = Math.max(0, 1 - edge / 0.035);
    const glow = Math.pow(k, 2.2);
    return [255 * glow, 140 * glow * glow + 20 * glow, 40 * glow * glow];
  });
  return toTex(c);
}

/** Soft radial sprite, white center fading out (tinted by material color). */
export function makeGlowTexture(size = 256, falloff = 2.2): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const dx = (i + 0.5) / size - 0.5, dy = (j + 0.5) / size - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy) * 2;
      const a = Math.max(0, 1 - r);
      const v = Math.pow(a, falloff);
      const k = (j * size + i) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
      img.data[k + 3] = Math.round(v * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Saturn ring radial profile (alpha bands), sampled along u. */
export function makeRingTexture(): THREE.CanvasTexture {
  const w = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = 4;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, 4);
  for (let i = 0; i < w; i++) {
    const u = i / w;
    let a = 0.35 + 0.65 * fbm(u * 40, 0.5, 0.5, 4);
    if (u > 0.62 && u < 0.67) a *= 0.08; // Cassini division
    if (u < 0.05 || u > 0.97) a *= 0.2;
    a *= 0.4 + 0.6 * Math.sin(Math.min(1, u * 1.2) * Math.PI * 0.5);
    const shade = 0.75 + 0.25 * fbm(u * 70, 2, 2, 2);
    for (let j = 0; j < 4; j++) {
      const k = (j * w + i) * 4;
      img.data[k] = 230 * shade;
      img.data[k + 1] = 210 * shade;
      img.data[k + 2] = 170 * shade;
      img.data[k + 3] = Math.round(Math.min(1, a) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
