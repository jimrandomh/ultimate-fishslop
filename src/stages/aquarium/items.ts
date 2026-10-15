// Food pellets and coins: small pooled, instanced objects that sink and settle on the sand.

import * as THREE from 'three';
import { sandHeight, TANK } from './env';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

export interface Pellet {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  alive: boolean;
  age: number;
  rest: number;
  spin: number;
}

export class Pellets {
  readonly list: Pellet[] = [];
  readonly mesh: THREE.InstancedMesh;

  constructor(private max = 220) {
    const geo = new THREE.IcosahedronGeometry(0.13, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xc8742e, roughness: 0.75, emissive: 0x3a1a04 });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.count = 0;
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    const palette = [0xc8742e, 0xd9a03c, 0x9b4f2a, 0x7fae3a];
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, new THREE.Color(palette[i % palette.length]));
  }

  drop(at: THREE.Vector3, vel: THREE.Vector3) {
    if (this.list.length >= this.max) {
      // Recycle the oldest resting pellet.
      const idx = this.list.findIndex((p) => p.rest > 0);
      this.list.splice(Math.max(0, idx), 1);
    }
    this.list.push({
      pos: at.clone(),
      vel: vel.clone(),
      alive: true,
      age: 0,
      rest: 0,
      spin: Math.random() * 6,
    });
  }

  get aliveCount() {
    return this.list.length;
  }

  update(dt: number) {
    for (const p of this.list) {
      p.age += dt;
      const floor = sandHeight(p.pos.x, p.pos.z) + 0.1;
      if (p.pos.y > floor) {
        // Sinks with drag toward a slow terminal velocity, wobbling a little.
        p.vel.x *= 1 - Math.min(1, dt * 1.8);
        p.vel.z *= 1 - Math.min(1, dt * 1.8);
        p.vel.y += (-0.75 - p.vel.y) * Math.min(1, dt * 2.5);
        p.pos.addScaledVector(p.vel, dt);
        p.pos.x += Math.sin(p.age * 3 + p.spin) * 0.15 * dt;
        p.pos.z += Math.cos(p.age * 2.5 + p.spin) * 0.15 * dt;
        p.pos.x = THREE.MathUtils.clamp(p.pos.x, TANK.minX + 0.3, TANK.maxX - 0.3);
        p.pos.z = THREE.MathUtils.clamp(p.pos.z, TANK.minZ + 0.3, TANK.maxZ - 0.3);
      } else {
        p.pos.y = floor;
        p.rest += dt;
        if (p.rest > 14) p.alive = false;
      }
    }
    // Compact dead pellets.
    for (let i = this.list.length - 1; i >= 0; i--) if (!this.list[i].alive) this.list.splice(i, 1);
    this.mesh.count = this.list.length;
    this.list.forEach((p, i) => {
      const fade = p.rest > 11 ? Math.max(0.05, 1 - (p.rest - 11) / 3) : 1;
      _e.set(p.age * 1.3 + p.spin, p.age * 0.9, 0);
      _q.setFromEuler(_e);
      _s.setScalar(fade);
      _m.compose(p.pos, _q, _s);
      this.mesh.setMatrixAt(i, _m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.list.length = 0;
  }
}

export interface Coin {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  rest: number;
  collecting: number;
  done: boolean;
  value: number;
}

export class Coins {
  readonly list: Coin[] = [];
  readonly mesh: THREE.InstancedMesh;
  private glow: THREE.Points;
  private glowPos: Float32Array;

  constructor(private max = 120) {
    const geo = new THREE.CylinderGeometry(0.32, 0.32, 0.07, 24);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffcc33,
      metalness: 0.9,
      roughness: 0.25,
      emissive: 0x6b4a00,
      emissiveIntensity: 0.8,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    // Soft additive halo so coins read from across the tank.
    this.glowPos = new Float32Array(max * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.glowPos, 3));
    g.setDrawRange(0, 0);
    this.glow = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = 900.0 / -mv.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d);
            gl_FragColor = vec4(vec3(1.0, 0.8, 0.3) * a * a * 0.45, 1.0);
          }`,
      }),
    );
    this.glow.frustumCulled = false;
  }

  get objects() {
    return [this.mesh, this.glow];
  }

  spawn(at: THREE.Vector3, value = 1) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({
      pos: at.clone(),
      vel: new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.8, (Math.random() - 0.5) * 0.6),
      age: 0,
      rest: 0,
      collecting: 0,
      done: false,
      value,
    });
  }

  /** Moves coins; ones inside `magnet` of `collector` fly to it. Returns coins collected this frame. */
  update(dt: number, collector: THREE.Vector3, magnet: number): Coin[] {
    const got: Coin[] = [];
    for (const c of this.list) {
      c.age += dt;
      const d = c.pos.distanceTo(collector);
      if (c.collecting > 0 || d < magnet) {
        c.collecting += dt;
        const k = Math.min(1, dt * (4 + c.collecting * 10));
        c.pos.lerp(collector, k);
        if (d < 0.6 || c.collecting > 0.8) {
          c.done = true;
          got.push(c);
        }
        continue;
      }
      const floor = sandHeight(c.pos.x, c.pos.z) + 0.34;
      if (c.pos.y > floor) {
        c.vel.y += (-0.55 - c.vel.y) * Math.min(1, dt * 2);
        c.vel.x *= 1 - Math.min(1, dt);
        c.vel.z *= 1 - Math.min(1, dt);
        c.pos.addScaledVector(c.vel, dt);
      } else {
        c.pos.y = floor;
        c.rest += dt;
        if (c.rest > 24) c.done = true;
      }
    }
    for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].done) this.list.splice(i, 1);
    this.mesh.count = this.list.length;
    this.list.forEach((c, i) => {
      const fade = c.rest > 20 ? Math.max(0.05, 1 - (c.rest - 20) / 4) : 1;
      _e.set(0, c.age * 2.6, 0);
      _q.setFromEuler(_e);
      _s.setScalar(fade * (1 + Math.max(0, 0.4 - c.age) * 1.5));
      _m.compose(c.pos, _q, _s);
      this.mesh.setMatrixAt(i, _m);
      this.glowPos.set([c.pos.x, c.pos.y, c.pos.z], i * 3);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.glow.geometry.setDrawRange(0, this.list.length);
    (this.glow.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    return got;
  }
}
