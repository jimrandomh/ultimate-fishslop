// Procedural fish: per-species geometry with a swimming vertex shader, rendered instanced,
// plus the steering/hunger simulation for every fish in the tank.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TANK } from './env';

export interface Species {
  id: string;
  label: string;
  length: number;
  height: number;
  width: number;
  tail: 'fork' | 'round' | 'fan' | 'lyre';
  tailSize: number;
  dorsal: number;
  colA: number;
  colB: number;
  colC: number;
  /** 0 countershaded, 1 vertical bands, 2 spots, 3 tang (accent tail + dark streak), 4 neon stripe */
  pattern: number;
  stripes?: number;
  cruise: number;
}

export const SPECIES: Species[] = [
  { id: 'goldfish', label: 'goldfish', length: 1.5, height: 1.0, width: 0.7, tail: 'fan', tailSize: 1.25, dorsal: 0.55, colA: 0xff7a12, colB: 0xffd27a, colC: 0xffa53d, pattern: 0, cruise: 1.6 },
  { id: 'clown', label: 'clownfish', length: 1.3, height: 0.72, width: 0.48, tail: 'round', tailSize: 0.8, dorsal: 0.5, colA: 0xff6a00, colB: 0xff8f2e, colC: 0xffffff, pattern: 1, stripes: 3, cruise: 1.9 },
  { id: 'tang', label: 'blue tang', length: 1.75, height: 1.1, width: 0.42, tail: 'fork', tailSize: 0.85, dorsal: 0.32, colA: 0x1d4fe0, colB: 0x4f97ff, colC: 0xffd21a, pattern: 3, cruise: 2.3 },
  { id: 'angel', label: 'angelfish', length: 1.25, height: 1.55, width: 0.26, tail: 'lyre', tailSize: 1.0, dorsal: 1.0, colA: 0xe9e4d8, colB: 0xfffaf0, colC: 0x2a2622, pattern: 1, stripes: 3.2, cruise: 1.4 },
  { id: 'tetra', label: 'neon tetra', length: 0.95, height: 0.42, width: 0.28, tail: 'fork', tailSize: 0.75, dorsal: 0.35, colA: 0x27408f, colB: 0xe8405a, colC: 0x3ff2ff, pattern: 4, cruise: 2.6 },
  { id: 'puffer', label: 'pufferfish', length: 1.25, height: 1.05, width: 1.0, tail: 'round', tailSize: 0.6, dorsal: 0.25, colA: 0xe0b83a, colB: 0xfff2c8, colC: 0x5c4a1c, pattern: 2, cruise: 1.2 },
];

export const FISH_NAMES = [
  'Bubbles', 'Pickles', 'Wanda', 'Duchess', 'Zip', 'Puff',
  'Goldie', 'Captain', 'Sushi', 'Mr. Scales', 'Zap', 'Kevin',
];

/** A fish becomes fed at FED_AT and stays fed until it drops below HUNGRY_AT. */
const FED_AT = 0.6;
const HUNGRY_AT = 0.32;

// ------------------------------------------------------------------ geometry

function bodyScale(u: number) {
  const a = Math.pow(u, 0.62);
  let s = Math.pow(Math.sin(Math.PI * a), 0.75);
  const ped = THREE.MathUtils.smoothstep(u, 0.82, 1.0);
  s = THREE.MathUtils.lerp(s, 0.16, ped);
  return Math.max(s, 0);
}

function finShape(points: [number, number][]) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (const p of points.slice(1)) shape.lineTo(p[0], p[1]);
  shape.closePath();
  return new THREE.ShapeGeometry(shape, 6);
}

function tagGeometry(g: THREE.BufferGeometry, part: number, kFn: (x: number) => number) {
  g.deleteAttribute('uv');
  const pos = g.attributes.position as THREE.BufferAttribute;
  const partArr = new Float32Array(pos.count).fill(part);
  const kArr = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) kArr[i] = kFn(pos.getX(i));
  g.setAttribute('aPart', new THREE.BufferAttribute(partArr, 1));
  g.setAttribute('aK', new THREE.BufferAttribute(kArr, 1));
  if (!g.index) return g;
  return g.toNonIndexed();
}

export function buildFishGeometry(sp: Species, lowDetail = false): THREE.BufferGeometry {
  const L = sp.length;
  const H = sp.height;
  const W = sp.width;
  const tailLen = L * 0.42 * sp.tailSize;
  const total = L + tailLen;
  const kOf = (x: number) => THREE.MathUtils.clamp((L / 2 - x) / total, 0, 1);

  // Body: a lofted ellipse along x, nose at +x.
  const segU = lowDetail ? 12 : 30;
  const segV = lowDetail ? 8 : 20;
  const verts: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segU; i++) {
    const u = i / segU;
    const s = bodyScale(u);
    const x = L / 2 - u * L;
    for (let j = 0; j <= segV; j++) {
      const v = (j / segV) * Math.PI * 2;
      const sy = Math.sin(v);
      // Slightly flatter belly, rounder back.
      const yScale = sy > 0 ? 1 : 0.88;
      verts.push(x, (sy * H * 0.5 * s * yScale) - H * 0.03 * s, Math.cos(v) * W * 0.5 * s);
    }
  }
  for (let i = 0; i < segU; i++)
    for (let j = 0; j < segV; j++) {
      const a = i * (segV + 1) + j;
      const b = a + segV + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  body.setIndex(idx);
  body.computeVertexNormals();
  const parts: THREE.BufferGeometry[] = [tagGeometry(body, 0, kOf)];

  // Tail fin in the xy plane, starting at the peduncle.
  const tx = -L / 2 + L * 0.03;
  const th = H * 0.55 * sp.tailSize;
  let tail: THREE.BufferGeometry;
  if (sp.tail === 'fork') {
    tail = finShape([[0, 0.06 * H], [-tailLen * 0.95, th], [-tailLen * 0.55, 0], [-tailLen * 0.95, -th], [0, -0.06 * H]]);
  } else if (sp.tail === 'lyre') {
    tail = finShape([[0, 0.08 * H], [-tailLen * 1.25, th * 1.25], [-tailLen * 0.5, 0.02], [-tailLen * 1.25, -th * 1.25], [0, -0.08 * H]]);
  } else {
    const pts: [number, number][] = [[0, 0.07 * H]];
    const r = sp.tail === 'fan' ? th * 1.1 : th * 0.8;
    for (let a = 0; a <= 12; a++) {
      const ang = Math.PI * 0.5 - (a / 12) * Math.PI;
      const wob = sp.tail === 'fan' ? 1 + 0.12 * Math.sin(a * 2.2) : 1;
      pts.push([-tailLen * 0.35 - Math.cos(ang) * tailLen * 0.65 * wob, Math.sin(ang) * r * wob]);
    }
    pts.push([0, -0.07 * H]);
    tail = finShape(pts);
  }
  tail.translate(tx, -H * 0.03, 0);
  parts.push(tagGeometry(tail, 1, kOf));

  // Dorsal fin.
  const topAt = (x: number) => bodyScale(THREE.MathUtils.clamp((L / 2 - x) / L, 0, 1)) * H * 0.5;
  const d0 = L * 0.18;
  const d1 = -L * 0.32;
  const dh = H * 0.5 * sp.dorsal;
  const dorsal = finShape([
    [d0, topAt(d0) - 0.06],
    [d0 - L * 0.18, topAt(d0 - L * 0.18) + dh],
    [d1 - L * 0.05, topAt(d1) + dh * 0.45],
    [d1, topAt(d1) - 0.06],
  ]);
  parts.push(tagGeometry(dorsal, 1, kOf));

  // Anal/ventral fin.
  const v0 = -L * 0.05;
  const v1 = -L * 0.34;
  const ventral = finShape([
    [v0, -topAt(v0) * 0.85 + 0.06],
    [v0 - L * 0.16, -topAt(v0) * 0.85 - dh * 0.6],
    [v1, -topAt(v1) * 0.85 + 0.04],
  ]);
  parts.push(tagGeometry(ventral, 1, kOf));

  // Pectoral fins on both sides, angled back.
  for (const side of [1, -1]) {
    const pf = finShape([[0, 0], [-L * 0.2, H * 0.12], [-L * 0.24, -H * 0.06]]);
    pf.rotateX(side * 0.5);
    pf.rotateY(side * 0.5);
    const px = L * 0.12;
    pf.translate(px, -H * 0.12, side * bodyScale((L / 2 - px) / L) * W * 0.46);
    parts.push(tagGeometry(pf, 1, kOf));
  }

  // Eyes.
  const ex = L / 2 - L * 0.17;
  const eu = (L / 2 - ex) / L;
  const er = Math.max(0.07, H * 0.11);
  for (const side of [1, -1]) {
    const ez = side * bodyScale(eu) * W * 0.5 * 0.82;
    const white = new THREE.SphereGeometry(er, lowDetail ? 6 : 12, lowDetail ? 4 : 8);
    white.translate(ex, H * 0.1, ez);
    parts.push(tagGeometry(white, 2, kOf));
    const pupil = new THREE.SphereGeometry(er * 0.6, lowDetail ? 5 : 10, lowDetail ? 3 : 6);
    pupil.translate(ex + er * 0.25, H * 0.1, ez + side * er * 0.55);
    parts.push(tagGeometry(pupil, 3, kOf));
  }

  const merged = mergeGeometries(parts);
  merged.computeBoundingSphere();
  return merged;
}

function fishMaterial(sp: Species, uTime: { value: number }) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.05, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.uniforms.uLen = { value: sp.length };
    shader.uniforms.uH = { value: sp.height };
    shader.uniforms.uColA = { value: new THREE.Color(sp.colA) };
    shader.uniforms.uColB = { value: new THREE.Color(sp.colB) };
    shader.uniforms.uColC = { value: new THREE.Color(sp.colC) };
    shader.uniforms.uPattern = { value: sp.pattern };
    shader.uniforms.uStripes = { value: sp.stripes ?? 3 };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uLen;
        attribute float aPart;
        attribute float aK;
        attribute vec4 iAnim; // x: tail phase, y: swim amplitude, z: satiety, w: excitement
        varying float vPart;
        varying vec3 vLocal;
        varying float vSat;
        varying float vExcite;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vPart = aPart;
        vLocal = position;
        vSat = iAnim.z;
        vExcite = iAnim.w;
        float k = aK;
        float wave = sin(iAnim.x - k * 4.2);
        float amp = iAnim.y * (0.025 + 0.5 * k * k) * uLen;
        transformed.z += wave * amp;
        transformed.x -= abs(wave) * amp * 0.15 * k;
        if (aPart > 0.5 && aPart < 1.5) {
          transformed.z += sin(iAnim.x * 1.3 + position.x * 5.0 + position.y * 3.0) * 0.035 * uLen;
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uLen;
        uniform float uH;
        uniform vec3 uColA;
        uniform vec3 uColB;
        uniform vec3 uColC;
        uniform float uPattern;
        uniform float uStripes;
        varying float vPart;
        varying vec3 vLocal;
        varying float vSat;
        varying float vExcite;
        float fHash(vec3 p) { return fract(sin(dot(p, vec3(17.1, 113.7, 51.3))) * 43758.5453); }
        float fNoise(vec3 p) {
          vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(fHash(i), fHash(i + vec3(1,0,0)), f.x), mix(fHash(i + vec3(0,1,0)), fHash(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(fHash(i + vec3(0,0,1)), fHash(i + vec3(1,0,1)), f.x), mix(fHash(i + vec3(0,1,1)), fHash(i + vec3(1,1,1)), f.x), f.y), f.z);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float yN = vLocal.y / (uH * 0.5);
        float xN = (uLen * 0.5 - vLocal.x) / uLen;
        vec3 col = mix(uColB, uColA, smoothstep(-0.7, 0.45, yN));
        if (uPattern > 0.5 && uPattern < 1.5) {
          float b = fract(xN * uStripes + 0.18);
          float band = smoothstep(0.0, 0.035, b) * smoothstep(0.25, 0.215, b);
          float edge = smoothstep(0.0, 0.02, b) * smoothstep(0.29, 0.27, b) - band;
          col = mix(col, uColC, band * step(xN, 0.98));
          if (uColC.r > 0.5) col = mix(col, vec3(0.05), clamp(edge, 0.0, 1.0) * 0.9);
        } else if (uPattern > 1.5 && uPattern < 2.5) {
          float n = fNoise(vLocal * 9.0);
          col = mix(col, uColC, smoothstep(0.62, 0.68, n) * smoothstep(-0.4, 0.2, yN));
        } else if (uPattern > 2.5 && uPattern < 3.5) {
          float streak = smoothstep(0.35, 0.0, abs(yN - 0.25 - xN * 0.3)) * smoothstep(0.15, 0.35, xN) * smoothstep(0.95, 0.7, xN);
          col = mix(col, vec3(0.03, 0.05, 0.15), streak * 0.95);
          col = mix(col, uColC, smoothstep(0.9, 0.97, xN));
        } else if (uPattern > 3.5) {
          float neon = smoothstep(0.16, 0.04, abs(yN - 0.12));
          col = mix(col, uColA, step(0.0, yN));
          col = mix(col, uColB, step(yN, 0.0) * smoothstep(0.35, 0.55, xN));
          col = mix(col, vec3(0.85, 0.85, 0.9), step(yN, 0.0) * smoothstep(0.55, 0.35, xN));
          col = mix(col, uColC * 1.4, neon);
        }
        if (vPart > 0.5 && vPart < 1.5) {
          col = mix(uColA, uColC, uPattern > 2.5 && uPattern < 3.5 ? 1.0 : 0.35);
          if (uPattern > 0.5 && uPattern < 1.5 && uColC.r > 0.5) col = mix(uColA, vec3(0.08), 0.15);
          col *= 1.08;
        }
        if (vPart > 1.5) col = vPart > 2.5 ? vec3(0.02) : vec3(0.97);
        // Hungry fish look a little washed out; fed fish are vivid.
        float luma = dot(col, vec3(0.299, 0.587, 0.114));
        float hunger = 1.0 - smoothstep(0.35, 0.6, vSat);
        if (vPart < 1.5) col = mix(col, vec3(luma) * 0.9 + 0.05, hunger * 0.35);
        diffuseColor.rgb = col * vColor;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if (vPart < 1.5) totalEmissiveRadiance += diffuseColor.rgb * (smoothstep(0.6, 0.9, vSat) * 0.12 + vExcite * 0.35);
        if (vPart > 2.5) totalEmissiveRadiance = vec3(0.0);`,
      );
  };
  mat.customProgramCacheKey = () => `fish-${sp.id}`;
  return mat;
}

// ------------------------------------------------------------------ simulation

export interface Fish {
  index: number;
  name: string;
  species: Species;
  slot: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  dir: THREE.Vector3;
  target: THREE.Vector3;
  retarget: number;
  satiety: number;
  fed: boolean;
  scale: number;
  tailPhase: number;
  bank: number;
  coinTimer: number;
  eatCooldown: number;
  excite: number;
  /** Seconds since first becoming fed (for "fed" stats). */
  everFed: boolean;
}

export interface PelletLike {
  pos: THREE.Vector3;
  alive: boolean;
}

export type FishEvent =
  | { type: 'eat'; fish: Fish; pellet: number }
  | { type: 'fed'; fish: Fish }
  | { type: 'hungry'; fish: Fish }
  | { type: 'coin'; fish: Fish };

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YZX');
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();
const _d = new THREE.Vector3();

export class School {
  readonly group = new THREE.Group();
  readonly fish: Fish[] = [];
  private meshes = new Map<string, THREE.InstancedMesh>();
  private anim = new Map<string, THREE.InstancedBufferAttribute>();
  private counts = new Map<string, number>();
  private uTime = { value: 0 };
  readonly named: boolean;
  decayRate = 0.0062;

  constructor(
    count: number,
    private obstacles: THREE.Vector4[],
    opts: { capacity?: number } = {},
  ) {
    this.named = count <= 24;
    const capacity = Math.max(count, opts.capacity ?? count) + 8;
    for (const sp of SPECIES) {
      const geo = buildFishGeometry(sp, !this.named);
      const per = Math.ceil(capacity / SPECIES.length) + 4;
      const attr = new THREE.InstancedBufferAttribute(new Float32Array(per * 4), 4);
      attr.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('iAnim', attr);
      const mesh = new THREE.InstancedMesh(geo, fishMaterial(sp, this.uTime), per);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.castShadow = this.named;
      mesh.frustumCulled = false;
      for (let i = 0; i < per; i++) mesh.setColorAt(i, new THREE.Color(1, 1, 1));
      this.meshes.set(sp.id, mesh);
      this.anim.set(sp.id, attr);
      this.counts.set(sp.id, 0);
      this.group.add(mesh);
    }
    for (let i = 0; i < count; i++) this.add();
  }

  /** Adds a fish (also used by the shop). */
  add(): Fish {
    const i = this.fish.length;
    const sp = SPECIES[i % SPECIES.length];
    const slot = this.counts.get(sp.id)!;
    const mesh = this.meshes.get(sp.id)!;
    if (slot >= mesh.instanceMatrix.count) throw new Error('fish capacity exceeded');
    this.counts.set(sp.id, slot + 1);
    mesh.count = slot + 1;
    const tint = 0.88 + Math.random() * 0.2;
    mesh.setColorAt(slot, new THREE.Color(tint, tint * (0.95 + Math.random() * 0.08), tint));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    const pos = new THREE.Vector3(
      THREE.MathUtils.randFloat(TANK.minX + 3, TANK.maxX - 3),
      THREE.MathUtils.randFloat(3, TANK.maxY - 3),
      THREE.MathUtils.randFloat(TANK.minZ + 3, TANK.maxZ - 3),
    );
    const dir = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
    const big = this.named ? 1 : 0.8;
    const f: Fish = {
      index: i,
      name: this.named ? FISH_NAMES[i] ?? `Fish #${i + 1}` : `Fish #${i + 1}`,
      species: sp,
      slot,
      pos,
      vel: dir.clone().multiplyScalar(sp.cruise),
      dir,
      target: pos.clone(),
      retarget: 0,
      satiety: this.named ? 0.12 + Math.random() * 0.3 : Math.random() * 0.3,
      fed: false,
      scale: big * THREE.MathUtils.randFloat(0.85, 1.15),
      tailPhase: Math.random() * 100,
      bank: 0,
      coinTimer: 6 + Math.random() * 6,
      eatCooldown: 0,
      excite: 0,
      everFed: false,
    };
    this.fish.push(f);
    return f;
  }

  get fedCount() {
    let n = 0;
    for (const f of this.fish) if (f.fed) n++;
    return n;
  }

  private newTarget(f: Fish) {
    f.target.set(
      THREE.MathUtils.randFloat(TANK.minX + 3, TANK.maxX - 3),
      THREE.MathUtils.randFloat(2.2, TANK.maxY - 2),
      THREE.MathUtils.randFloat(TANK.minZ + 3, TANK.maxZ - 3),
    );
    f.retarget = THREE.MathUtils.randFloat(4, 10);
  }

  update(
    dt: number,
    ctx: { pellets: PelletLike[]; subPos: THREE.Vector3; subSpeed: number; hungerPaused: boolean },
    events: FishEvent[],
  ) {
    this.uTime.value += dt;
    const many = this.fish.length > 60;
    const pellets = ctx.pellets;
    let anyPellet = false;
    for (const p of pellets) if (p.alive) anyPellet = true;

    for (const f of this.fish) {
      const sp = f.species;
      // ---- hunger
      if (!ctx.hungerPaused) {
        const before = f.satiety;
        f.satiety = Math.max(0, f.satiety - this.decayRate * dt);
        if (f.fed && before >= HUNGRY_AT && f.satiety < HUNGRY_AT) {
          f.fed = false;
          events.push({ type: 'hungry', fish: f });
        }
      }
      f.eatCooldown -= dt;
      f.excite = Math.max(0, f.excite - dt * 1.5);
      const hungry = f.satiety < 0.97;
      const wantsFood = !f.fed || f.satiety < 0.75;

      // ---- choose a desire
      let speed = sp.cruise;
      _d.set(0, 0, 0);
      let seeking = false;
      if (hungry && anyPellet && f.eatCooldown <= 0) {
        let best = -1;
        let bestD = (wantsFood ? 15 : 6) ** 2;
        for (let i = 0; i < pellets.length; i++) {
          const p = pellets[i];
          if (!p.alive) continue;
          const d2 = f.pos.distanceToSquared(p.pos);
          if (d2 < bestD) {
            bestD = d2;
            best = i;
          }
        }
        if (best >= 0) {
          const p = pellets[best];
          seeking = true;
          _d.subVectors(p.pos, f.pos);
          const dist = _d.length();
          speed = sp.cruise * (wantsFood ? 2.1 : 1.4);
          _d.multiplyScalar(1 / Math.max(dist, 0.001));
          if (dist < 0.45 + 0.35 * f.scale * sp.length) {
            p.alive = false;
            f.satiety = Math.min(1, f.satiety + 0.34);
            f.eatCooldown = 0.5;
            f.excite = 1;
            events.push({ type: 'eat', fish: f, pellet: best });
            if (!f.fed && f.satiety >= FED_AT) {
              f.fed = true;
              f.everFed = true;
              f.coinTimer = 2 + Math.random() * 3;
              events.push({ type: 'fed', fish: f });
            }
          }
        }
      }
      if (!seeking) {
        const toSub = _v.subVectors(ctx.subPos, f.pos);
        const subDist = toSub.length();
        if (wantsFood && subDist < 11 && subDist > 3.4) {
          // Hungry fish trail the submarine: it's where food comes from.
          _d.copy(toSub).multiplyScalar(1 / subDist);
          _d.y -= 0.35;
          _d.normalize();
          speed = sp.cruise * 1.25;
        } else {
          f.retarget -= dt;
          if (f.retarget <= 0 || f.pos.distanceToSquared(f.target) < 2) this.newTarget(f);
          _d.subVectors(f.target, f.pos).normalize();
          speed = sp.cruise * (0.75 + 0.25 * Math.sin(f.tailPhase * 0.05));
        }
        if (!wantsFood && subDist < 2.8) {
          // Scatter from the submarine when not hungry.
          _d.addScaledVector(toSub, -1.5 / Math.max(subDist, 0.3)).normalize();
          speed = sp.cruise * 2;
        }
      }

      // ---- avoidance
      const m = 2.4;
      const avoid = _v.set(0, 0, 0);
      if (f.pos.x < TANK.minX + m) avoid.x += (TANK.minX + m - f.pos.x) / m;
      if (f.pos.x > TANK.maxX - m) avoid.x -= (f.pos.x - (TANK.maxX - m)) / m;
      if (f.pos.z < TANK.minZ + m) avoid.z += (TANK.minZ + m - f.pos.z) / m;
      if (f.pos.z > TANK.maxZ - m) avoid.z -= (f.pos.z - (TANK.maxZ - m)) / m;
      if (f.pos.y < 1.6) avoid.y += (1.6 - f.pos.y) * 1.5;
      if (f.pos.y > TANK.maxY - 1.2) avoid.y -= (f.pos.y - (TANK.maxY - 1.2)) * 1.5;
      for (const o of this.obstacles) {
        const dx = f.pos.x - o.x;
        const dy = f.pos.y - o.y;
        const dz = f.pos.z - o.z;
        const r = o.w + 1.1;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < r * r) {
          const d = Math.sqrt(d2) || 0.001;
          const k = (r - d) / r;
          avoid.x += (dx / d) * k * 2.5;
          avoid.y += (dy / d) * k * 2.5;
          avoid.z += (dz / d) * k * 2.5;
        }
      }
      {
        const dx = f.pos.x - ctx.subPos.x;
        const dy = f.pos.y - ctx.subPos.y;
        const dz = f.pos.z - ctx.subPos.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 6.25) {
          const d = Math.sqrt(d2) || 0.001;
          const k = (2.5 - d) / 2.5;
          avoid.x += (dx / d) * k * 4;
          avoid.y += (dy / d) * k * 4;
          avoid.z += (dz / d) * k * 4;
        }
      }
      if (!many) {
        for (const o of this.fish) {
          if (o === f) continue;
          const dx = f.pos.x - o.pos.x;
          const dy = f.pos.y - o.pos.y;
          const dz = f.pos.z - o.pos.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < 1.6 && d2 > 0.0001) {
            const d = Math.sqrt(d2);
            avoid.x += (dx / d) * (1.3 - d) * 0.8;
            avoid.y += (dy / d) * (1.3 - d) * 0.8;
            avoid.z += (dz / d) * (1.3 - d) * 0.8;
          }
        }
      }
      _d.add(avoid);
      if (_d.lengthSq() > 0.0001) _d.normalize();

      // ---- steer
      const desired = _d.multiplyScalar(speed);
      const turn = seeking ? 3.2 : 1.6;
      const prevDir = _s.copy(f.dir);
      f.vel.lerp(desired, Math.min(1, dt * turn));
      f.pos.addScaledVector(f.vel, dt);
      f.pos.x = THREE.MathUtils.clamp(f.pos.x, TANK.minX + 0.6, TANK.maxX - 0.6);
      f.pos.y = THREE.MathUtils.clamp(f.pos.y, 0.9, TANK.maxY - 0.3);
      f.pos.z = THREE.MathUtils.clamp(f.pos.z, TANK.minZ + 0.6, TANK.maxZ - 0.6);
      const sp2 = f.vel.length();
      if (sp2 > 0.05) f.dir.lerp(_v.copy(f.vel).multiplyScalar(1 / sp2), Math.min(1, dt * 6)).normalize();
      // Bank into turns.
      const yawRate = Math.atan2(prevDir.z * f.dir.x - prevDir.x * f.dir.z, prevDir.x * f.dir.x + prevDir.z * f.dir.z) / Math.max(dt, 0.001);
      f.bank = THREE.MathUtils.lerp(f.bank, THREE.MathUtils.clamp(-yawRate * 0.25, -0.6, 0.6), Math.min(1, dt * 4));
      f.tailPhase += dt * (5 + sp2 * 3.2 + f.excite * 6);

      // ---- coins
      if (f.fed) {
        f.coinTimer -= dt;
        if (f.coinTimer <= 0) {
          f.coinTimer = 9 + Math.random() * 7;
          events.push({ type: 'coin', fish: f });
        }
      }

      // ---- write instance
      const mesh = this.meshes.get(sp.id)!;
      const yaw = Math.atan2(-f.dir.z, f.dir.x);
      const pitch = Math.asin(THREE.MathUtils.clamp(f.dir.y, -0.7, 0.7));
      _e.set(f.bank, yaw, pitch, 'YZX');
      _q.setFromEuler(_e);
      const puff = sp.id === 'puffer' ? 1 + f.excite * 0.35 : 1;
      _s.setScalar(f.scale * puff);
      _m.compose(f.pos, _q, _s);
      mesh.setMatrixAt(f.slot, _m);
      const attr = this.anim.get(sp.id)!;
      attr.setXYZW(f.slot, f.tailPhase, 0.35 + Math.min(1, sp2 / 4) * 0.55 + f.excite * 0.4, f.satiety, f.excite);
    }
    for (const [id, mesh] of this.meshes) {
      mesh.instanceMatrix.needsUpdate = true;
      this.anim.get(id)!.needsUpdate = true;
    }
  }

  dispose() {
    for (const mesh of this.meshes.values()) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }
}
