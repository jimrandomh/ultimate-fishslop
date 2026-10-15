// The player's little yellow submarine: procedural model plus swim physics.

import * as THREE from 'three';
import { sandHeight, TANK } from './env';

export interface SubInput {
  forward: number;
  turn: number;
  vertical: number;
}

export class Submarine {
  readonly group = new THREE.Group();
  readonly body = new THREE.Group();
  readonly pos = new THREE.Vector3(7, 8, 2.5);
  readonly vel = new THREE.Vector3();
  yaw = Math.PI * 0.5;
  private yawVel = 0;
  private prop!: THREE.Group;
  private eye!: THREE.Mesh;
  private lamp!: THREE.SpotLight;
  private beam!: THREE.Mesh;
  private time = 0;
  maxSpeed = 6.5;
  thrusting = 0;

  constructor() {
    this.build();
    this.group.add(this.body);
    this.group.position.copy(this.pos);
  }

  private build() {
    const yellow = new THREE.MeshStandardMaterial({ color: 0xffc72c, roughness: 0.32, metalness: 0.15 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xff6b3d, roughness: 0.4, metalness: 0.1 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b3a44, roughness: 0.5, metalness: 0.6 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.3, metalness: 0.9 });
    const glass = new THREE.MeshStandardMaterial({
      color: 0x8fe6ff,
      emissive: 0x1f6a86,
      emissiveIntensity: 0.6,
      roughness: 0.05,
      metalness: 0.2,
      transparent: true,
      opacity: 0.78,
    });

    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 1.55, 10, 24), yellow);
    hull.rotation.z = Math.PI / 2;
    this.body.add(hull);

    // Accent rings.
    for (const x of [-0.55, 0.45]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.625, 0.045, 8, 32), orange);
      ring.rotation.y = Math.PI / 2;
      ring.position.x = x;
      this.body.add(ring);
    }

    // Front viewport, with the grader's "eye" glowing inside.
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.47, 24, 16), glass);
    dome.position.x = 0.92;
    dome.scale.set(0.8, 1, 1);
    this.body.add(dome);
    const domeRing = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.06, 10, 32), brass);
    domeRing.rotation.y = Math.PI / 2;
    domeRing.position.x = 0.82;
    this.body.add(domeRing);
    this.eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), new THREE.MeshBasicMaterial({ color: 0x5ef2ff }));
    this.eye.position.x = 0.9;
    this.body.add(this.eye);

    // Conning tower + periscope.
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.5, 20), yellow);
    tower.scale.z = 0.65;
    tower.position.set(0.05, 0.72, 0);
    this.body.add(tower);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.28, 0.06, 20), orange);
    cap.scale.z = 0.65;
    cap.position.set(0.05, 0.98, 0);
    this.body.add(cap);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8), dark);
    scope.position.set(-0.05, 1.2, 0);
    this.body.add(scope);
    const scopeTop = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 8), dark);
    scopeTop.rotation.z = Math.PI / 2;
    scopeTop.position.set(0.02, 1.46, 0);
    this.body.add(scopeTop);

    // Portholes.
    for (const side of [1, -1]) {
      for (const x of [-0.05, 0.4]) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 20), brass);
        rim.position.set(x, 0.12, side * 0.6);
        this.body.add(rim);
        const win = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20), glass);
        win.position.set(x, 0.12, side * 0.605);
        if (side < 0) win.rotation.y = Math.PI;
        this.body.add(win);
      }
    }

    // Tail fins.
    const finGeo = new THREE.BoxGeometry(0.45, 0.04, 0.95);
    const hFin = new THREE.Mesh(finGeo, orange);
    hFin.position.set(-1.12, 0, 0);
    this.body.add(hFin);
    const vFin = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.85, 0.04), orange);
    vFin.position.set(-1.12, 0.05, 0);
    this.body.add(vFin);

    // Propeller.
    this.prop = new THREE.Group();
    this.prop.position.x = -1.45;
    const hub = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 12), brass);
    hub.rotation.z = Math.PI / 2;
    this.prop.add(hub);
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.42, 0.13), brass);
      blade.position.y = 0.2;
      const holder = new THREE.Group();
      holder.rotation.x = (i / 3) * Math.PI * 2;
      blade.rotation.y = 0.5;
      holder.add(blade);
      this.prop.add(holder);
    }
    this.body.add(this.prop);

    // Food hopper underneath.
    const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 0.25, 12), dark);
    hopper.position.set(0.15, -0.66, 0);
    this.body.add(hopper);

    // Headlamp + visible beam.
    const lampHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.16, 12), dark);
    lampHousing.rotation.z = Math.PI / 2;
    lampHousing.position.set(0.7, -0.42, 0);
    this.body.add(lampHousing);
    this.lamp = new THREE.SpotLight(0xfff3c4, 18, 22, 0.42, 0.6, 1.4);
    this.lamp.position.set(0.8, -0.42, 0);
    this.lamp.target.position.set(6, -1.6, 0);
    this.body.add(this.lamp, this.lamp.target);
    const beamGeo = new THREE.CylinderGeometry(0.1, 2.4, 9, 24, 1, true);
    beamGeo.translate(0, -4.5, 0);
    beamGeo.rotateZ(Math.PI / 2);
    this.beam = new THREE.Mesh(
      beamGeo,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        vertexShader: /* glsl */ `
          varying float vT;
          varying float vF;
          void main() {
            vT = clamp(position.x / 9.0, 0.0, 1.0);
            vec3 n = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vF = pow(abs(dot(n, normalize(-mv.xyz))), 1.5);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          varying float vT;
          varying float vF;
          void main() {
            float a = (1.0 - vT) * (1.0 - vT) * vF * 0.16;
            gl_FragColor = vec4(vec3(1.0, 0.95, 0.75) * a, 1.0);
          }`,
      }),
    );
    this.beam.position.set(0.8, -0.42, 0);
    this.beam.rotation.z = -0.15;
    this.body.add(this.beam);

    this.body.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o !== this.beam) o.castShadow = true;
    });
  }

  get forward(): THREE.Vector3 {
    return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  /** Where food comes out. */
  get hatch(): THREE.Vector3 {
    return this.pos.clone().add(new THREE.Vector3(0, -0.85, 0)).addScaledVector(this.forward, 0.15);
  }

  get propPos(): THREE.Vector3 {
    return this.pos.clone().addScaledVector(this.forward, -1.6);
  }

  get speed() {
    return this.vel.length();
  }

  update(dt: number, input: SubInput, obstacles: THREE.Vector4[]) {
    this.time += dt;
    const fwd = this.forward;
    const accel = 11 * (this.maxSpeed / 6.5);
    this.vel.addScaledVector(fwd, input.forward * accel * dt);
    this.vel.y += input.vertical * 8 * dt;
    // Water drag: stronger sideways than forward so the sub "tracks" like a boat.
    const along = this.vel.dot(fwd);
    const side = this.vel.clone().addScaledVector(fwd, -along);
    side.y = 0;
    this.vel.addScaledVector(side, -Math.min(1, dt * 3.5));
    this.vel.multiplyScalar(Math.exp(-dt * 1.4));
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > this.maxSpeed) {
      this.vel.x *= this.maxSpeed / hs;
      this.vel.z *= this.maxSpeed / hs;
    }
    this.vel.y = THREE.MathUtils.clamp(this.vel.y, -4, 4);

    this.yawVel = THREE.MathUtils.lerp(this.yawVel, -input.turn * 2.0, Math.min(1, dt * 5));
    this.yaw += this.yawVel * dt;

    this.pos.addScaledVector(this.vel, dt);

    // Keep inside the glass and above the sand.
    const pad = 1.4;
    const clampAxis = (k: 'x' | 'y' | 'z', lo: number, hi: number) => {
      if (this.pos[k] < lo) {
        this.pos[k] = lo;
        if (this.vel[k] < 0) this.vel[k] *= -0.3;
      } else if (this.pos[k] > hi) {
        this.pos[k] = hi;
        if (this.vel[k] > 0) this.vel[k] *= -0.3;
      }
    };
    clampAxis('x', TANK.minX + pad, TANK.maxX - pad);
    clampAxis('z', TANK.minZ + pad, TANK.maxZ - pad);
    clampAxis('y', sandHeight(this.pos.x, this.pos.z) + 0.95, TANK.maxY - 0.6);
    for (const o of obstacles) {
      const dx = this.pos.x - o.x;
      const dy = this.pos.y - o.y;
      const dz = this.pos.z - o.z;
      const r = o.w + 0.9;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 0.001;
        const push = r - d;
        this.pos.x += (dx / d) * push;
        this.pos.y += (dy / d) * push;
        this.pos.z += (dz / d) * push;
        const vn = (this.vel.x * dx + this.vel.y * dy + this.vel.z * dz) / d;
        if (vn < 0) {
          this.vel.x -= (dx / d) * vn * 1.3;
          this.vel.y -= (dy / d) * vn * 1.3;
          this.vel.z -= (dz / d) * vn * 1.3;
        }
      }
    }

    // Visual attitude: pitch with climb, roll into turns, gentle idle bob.
    this.thrusting = THREE.MathUtils.lerp(this.thrusting, Math.abs(input.forward), Math.min(1, dt * 4));
    const pitch = THREE.MathUtils.clamp(this.vel.y * 0.12, -0.35, 0.35);
    const roll = THREE.MathUtils.clamp(-this.yawVel * 0.18 * Math.min(1, hs / 3 + 0.3), -0.35, 0.35);
    this.group.position.copy(this.pos);
    this.group.position.y += Math.sin(this.time * 1.6) * 0.05;
    this.group.rotation.set(0, this.yaw, 0);
    this.body.rotation.z = THREE.MathUtils.lerp(this.body.rotation.z, pitch, Math.min(1, dt * 4));
    this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, roll, Math.min(1, dt * 4));
    this.prop.rotation.x += dt * (3 + Math.abs(along) * 6 + this.thrusting * 14) * Math.sign(along || 1);
    const pulse = 0.85 + 0.15 * Math.sin(this.time * 3);
    (this.eye.material as THREE.MeshBasicMaterial).color.setRGB(0.37 * pulse, 0.95 * pulse, 1.0 * pulse);
  }
}
