// The rotating Earth: three.js scene, drag-to-spin with inertia, and cheap event flourishes
// (shockwaves, glow sparks, comet streaks, orbiting swarms of ships/drones/arks, arcs).

import * as THREE from 'three';
import type { Terrain } from './terrain';
import { TEX_W, TEX_H } from './terrain';
import * as GL from './shaders';

const DEG = Math.PI / 180;

/** Same parameterisation as THREE.SphereGeometry, so it matches the equirectangular textures. */
export function latLonToVec3(lat: number, lon: number, r = 1, out = new THREE.Vector3()): THREE.Vector3 {
  const phi = ((lon + 180) / 360) * Math.PI * 2;
  const theta = (90 - lat) * DEG;
  return out.set(-Math.cos(phi) * Math.sin(theta) * r, Math.cos(theta) * r, Math.sin(phi) * Math.sin(theta) * r);
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export interface WaveOpts {
  maxAngle?: number; // radians on the sphere
  duration?: number; // seconds
  intensity?: number;
  flash?: number;
  color?: THREE.ColorRepresentation;
}

interface Spark {
  pos: THREE.Vector3;
  color: THREE.Color;
  size: number;
  alpha: number;
  style: number;
  age: number;
  life: number; // Infinity = persistent
  tick?: (s: Spark, dt: number) => boolean | void; // return false to kill
  tag?: string;
}

interface Swarm {
  points: THREE.Points;
  mat: THREE.ShaderMaterial;
  target: number;
}

interface Arc {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  age: number;
  life: number;
}

const MAX_SPARKS = 3000;

export class Globe {
  readonly renderer: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.01, 400);
  private tiltGroup = new THREE.Group();
  private spinGroup = new THREE.Group();
  private mesh: THREE.Mesh;
  private atmo: THREE.Mesh;
  private stars!: THREE.Points;
  private uniforms: Record<string, THREE.IUniform>;
  private atmoUniforms: Record<string, THREE.IUniform>;
  readonly sunW = new THREE.Vector3(-0.86, 0.26, 0.48).normalize();
  private textures: THREE.Texture[] = [];

  // view state
  spin = 0;
  tilt = 0.32;
  private spinVel = 0;
  private tiltVel = 0;
  autoSpin = 0.05;
  private holdFocus = false;
  private focusAnim: { s0: number; s1: number; t0: number; t1: number; time: number; dur: number } | null = null;
  private zoom = 1;
  private zoomTarget = 1;
  private userZoom = 1;
  private fitDist = 4.4;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private lastMoveT = 0;
  private width = 1;
  private height = 1;
  private time = 0;

  // fx
  private sparks: Spark[] = [];
  private sparkGeo!: THREE.BufferGeometry;
  private sparkPoints!: THREE.Points;
  private swarms = new Map<string, Swarm>();
  private arcs: Arc[] = [];
  private waveAge = new Float32Array(GL.MAX_WAVES).fill(-1);
  private listeners: [EventTarget, string, EventListener, any?][] = [];
  private tmpM = new THREE.Matrix4();

  /** Uniform values; the stage animates these. */
  vis = { sea: 0, melt: 0, algae: 0, lights: 1 };

  constructor(
    container: HTMLElement,
    private terrain: Terrain,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x01030a, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'earth-canvas';
    container.append(this.canvas);

    this.scene.add(this.tiltGroup);
    this.tiltGroup.add(this.spinGroup);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const mkTex = (img: HTMLImageElement) => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(8, maxAniso);
      t.wrapS = THREE.RepeatWrapping;
      t.needsUpdate = true;
      this.textures.push(t);
      return t;
    };
    const day = mkTex(terrain.dayImg);
    const night = mkTex(terrain.nightImg);
    terrain.dataTex.anisotropy = Math.min(4, maxAniso);

    const waves: THREE.Vector4[] = [];
    const waveP: THREE.Vector4[] = [];
    const waveC: THREE.Color[] = [];
    for (let i = 0; i < GL.MAX_WAVES; i++) {
      waves.push(new THREE.Vector4(0, 1, 0, -1));
      waveP.push(new THREE.Vector4(0.3, 3, 1, 1));
      waveC.push(new THREE.Color(1, 0.7, 0.4));
    }
    this.uniforms = {
      uDay: { value: day },
      uNight: { value: night },
      uData: { value: terrain.dataTex },
      uSun: { value: new THREE.Vector3() },
      uCam: { value: new THREE.Vector3() },
      uSea: { value: 0 },
      uMelt: { value: 0 },
      uAlgae: { value: 0 },
      uLights: { value: 1 },
      uTime: { value: 0 },
      uTexel: { value: new THREE.Vector2(1 / TEX_W, 1 / TEX_H) },
      uRelief: { value: 0.0021 },
      uWaves: { value: waves },
      uWaveP: { value: waveP },
      uWaveC: { value: waveC },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: GL.globeVert,
      fragmentShader: GL.globeFrag,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 192, 96), mat);
    this.spinGroup.add(this.mesh);

    const atmoR = 1.075;
    this.atmoUniforms = {
      uSunW: { value: this.sunW },
      uCamW: { value: new THREE.Vector3() },
      uStrength: { value: 0.9 },
      uEdge: { value: Math.sqrt(1 - 1 / (atmoR * atmoR)) },
    };
    this.atmo = new THREE.Mesh(
      new THREE.SphereGeometry(atmoR, 96, 48),
      new THREE.ShaderMaterial({
        uniforms: this.atmoUniforms,
        vertexShader: GL.atmoVert,
        fragmentShader: GL.atmoFrag,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.scene.add(this.atmo);

    this.buildStars();
    this.buildSparks();
    this.bindInput();
  }

  // ------------------------------------------------------------------ setup

  private buildStars() {
    const n = 4200;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const phase = new Float32Array(n);
    const band = new THREE.Vector3(0.35, 0.8, -0.48).normalize();
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const inBand = i > n * 0.45;
      for (;;) {
        v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
        const l = v.length();
        if (l < 0.05 || l > 1) continue;
        v.divideScalar(l);
        if (inBand && Math.abs(v.dot(band)) > 0.22 * Math.random() + 0.02) continue;
        break;
      }
      v.multiplyScalar(120);
      pos.set([v.x, v.y, v.z], i * 3);
      const t = Math.random();
      const c = t < 0.15 ? [1.0, 0.85, 0.7] : t < 0.35 ? [0.75, 0.85, 1.0] : [1, 1, 1];
      const b = inBand ? 0.25 + Math.random() * 0.45 : 0.35 + Math.pow(Math.random(), 3) * 0.9;
      col.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
      size[i] = inBand ? 0.8 + Math.random() * 1.2 : 1 + Math.pow(Math.random(), 4) * 3.2;
      phase[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPx: { value: this.renderer.getPixelRatio() } },
      vertexShader: GL.starVert,
      fragmentShader: GL.starFrag,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    this.stars = new THREE.Points(geo, mat);
    this.stars.renderOrder = -1;
    this.scene.add(this.stars);
  }

  private buildSparks() {
    const geo = new THREE.BufferGeometry();
    const attr = (size: number) => new THREE.BufferAttribute(new Float32Array(MAX_SPARKS * size), size).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', attr(3));
    geo.setAttribute('aColor', attr(3));
    geo.setAttribute('aSize', attr(1));
    geo.setAttribute('aAlpha', attr(1));
    geo.setAttribute('aStyle', attr(1));
    geo.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uPx: { value: this.renderer.getPixelRatio() } },
      vertexShader: GL.sparkVert,
      fragmentShader: GL.sparkFrag,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    this.sparkGeo = geo;
    this.sparkPoints = new THREE.Points(geo, mat);
    this.sparkPoints.frustumCulled = false;
    this.sparkPoints.renderOrder = 5;
    this.spinGroup.add(this.sparkPoints);
  }

  private on(target: EventTarget, type: string, fn: (e: any) => void, opts?: any) {
    target.addEventListener(type, fn as EventListener, opts);
    this.listeners.push([target, type, fn as EventListener, opts]);
  }

  private bindInput() {
    const c = this.canvas;
    c.style.touchAction = 'none';
    this.on(c, 'pointerdown', (e: PointerEvent) => {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.lastMoveT = performance.now();
      this.spinVel = 0;
      this.tiltVel = 0;
      this.focusAnim = null;
      try {
        c.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic events */
      }
      c.classList.add('dragging');
    });
    this.on(c, 'pointermove', (e: PointerEvent) => {
      if (!this.dragging) return;
      const now = performance.now();
      const dt = Math.max(1, now - this.lastMoveT) / 1000;
      const k = (2.4 / Math.max(300, this.height)) * this.zoom * this.userZoom;
      const ds = (e.clientX - this.lastX) * k;
      const dtl = (e.clientY - this.lastY) * k;
      this.spin += ds;
      this.tilt = THREE.MathUtils.clamp(this.tilt + dtl, -1.25, 1.25);
      this.spinVel = THREE.MathUtils.lerp(this.spinVel, ds / dt, 0.5);
      this.tiltVel = THREE.MathUtils.lerp(this.tiltVel, dtl / dt, 0.5);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.lastMoveT = now;
    });
    const up = (e: PointerEvent) => {
      if (!this.dragging) return;
      this.dragging = false;
      c.classList.remove('dragging');
      if (performance.now() - this.lastMoveT > 120) {
        this.spinVel = 0;
        this.tiltVel = 0;
      }
      try {
        c.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    };
    this.on(c, 'pointerup', up);
    this.on(c, 'pointercancel', up);
    this.on(
      c,
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();
        this.userZoom = THREE.MathUtils.clamp(this.userZoom * Math.exp(e.deltaY * 0.0012), 0.62, 1.35);
      },
      { passive: false },
    );
  }

  // ------------------------------------------------------------------ view

  resize(w: number, h: number, sidebar: number) {
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    const fullW = w + sidebar;
    this.camera.aspect = fullW / h;
    this.camera.setViewOffset(fullW, h, sidebar, 0, w, h);
    this.camera.updateProjectionMatrix();
    // Fit the globe into the area left of the sidebar.
    const availW = w - sidebar;
    const targetPx = 0.37 * Math.min(h, availW * 1.05);
    const halfFov = (this.camera.fov / 2) * DEG;
    const a = Math.atan((targetPx / (h / 2)) * Math.tan(halfFov));
    this.fitDist = 1 / Math.sin(a);
  }

  /** Rotate so (lat, lon) faces the camera. hold = stop auto-spin until release(). */
  focus(lat: number, lon: number, opts: { dur?: number; hold?: boolean; zoom?: number; tilt?: number } = {}) {
    const p = latLonToVec3(lat, lon);
    const target = -Math.atan2(p.x, p.z);
    const s1 = this.spin + wrapPi(target - this.spin);
    const t1 = THREE.MathUtils.clamp(opts.tilt ?? lat * DEG * 0.85, -1.25, 1.25);
    this.focusAnim = { s0: this.spin, s1, t0: this.tilt, t1, time: 0, dur: opts.dur ?? 1.8 };
    this.spinVel = 0;
    this.tiltVel = 0;
    this.holdFocus = !!opts.hold;
    if (opts.zoom !== undefined) this.zoomTarget = opts.zoom;
  }

  release(zoom = 1) {
    this.holdFocus = false;
    this.zoomTarget = zoom;
  }

  setZoom(z: number) {
    this.zoomTarget = z;
  }

  /** Screen position of a lat/lon (for DOM callouts). Null if on the far side. */
  project(lat: number, lon: number): { x: number; y: number } | null {
    const p = latLonToVec3(lat, lon, 1.01).applyMatrix4(this.spinGroup.matrixWorld);
    const toCam = this.camera.position.clone().sub(p).normalize();
    if (p.clone().normalize().dot(toCam) < 0.05) return null;
    p.project(this.camera);
    return { x: ((p.x + 1) / 2) * this.width, y: ((1 - p.y) / 2) * this.height };
  }

  /** How directly (lat, lon) faces the camera: 1 = centre of the disc, < 0 = far side. */
  facing(lat: number, lon: number): number {
    const p = latLonToVec3(lat, lon).applyMatrix4(this.spinGroup.matrixWorld).normalize();
    return p.dot(this.camera.position.clone().normalize());
  }

  // ------------------------------------------------------------------ fx

  shockwave(lat: number, lon: number, o: WaveOpts = {}) {
    let slot = 0;
    let oldest = -Infinity;
    for (let i = 0; i < GL.MAX_WAVES; i++) {
      if (this.waveAge[i] < 0) {
        slot = i;
        break;
      }
      if (this.waveAge[i] > oldest) {
        oldest = this.waveAge[i];
        slot = i;
      }
    }
    const d = latLonToVec3(lat, lon);
    (this.uniforms.uWaves.value as THREE.Vector4[])[slot].set(d.x, d.y, d.z, 0);
    (this.uniforms.uWaveP.value as THREE.Vector4[])[slot].set(o.maxAngle ?? 0.35, o.duration ?? 3.5, o.intensity ?? 1, o.flash ?? 1);
    (this.uniforms.uWaveC.value as THREE.Color[])[slot].set(o.color ?? 0xffb070);
    this.waveAge[slot] = 0;
  }

  private spark(s: Partial<Spark> & { pos: THREE.Vector3 }): Spark {
    const sp: Spark = { color: new THREE.Color(0xffffff), size: 0.05, alpha: 1, style: 0, age: 0, life: 1, ...s };
    if (this.sparks.length < MAX_SPARKS) this.sparks.push(sp);
    return sp;
  }

  /** Brief bright glow at a surface point. */
  flash(lat: number, lon: number, color: THREE.ColorRepresentation = 0xffffff, size = 0.5, life = 1.4) {
    this.spark({
      pos: latLonToVec3(lat, lon, 1.01),
      color: new THREE.Color(color),
      size,
      life,
      tick: (s) => {
        const t = s.age / s.life;
        s.alpha = Math.pow(1 - t, 2) * 1.6;
        s.size = size * (0.6 + 0.8 * Math.sqrt(t));
      },
    });
  }

  /** Pulsing ring marker. life = Infinity for persistent. */
  marker(lat: number, lon: number, opts: { color?: THREE.ColorRepresentation; size?: number; life?: number; tag?: string; speed?: number } = {}) {
    const size = opts.size ?? 0.07;
    const phase = Math.random() * 6.28;
    const speed = opts.speed ?? 2.2;
    this.spark({
      pos: latLonToVec3(lat, lon, 1.006),
      color: new THREE.Color(opts.color ?? 0xff5c7a),
      size,
      style: 1,
      life: opts.life ?? 6,
      tag: opts.tag,
      tick: (s) => {
        const fadeIn = Math.min(1, s.age / 0.5);
        const fadeOut = isFinite(s.life) ? Math.min(1, (s.life - s.age) / 0.8) : 1;
        const p = 0.5 + 0.5 * Math.sin(s.age * speed + phase);
        s.alpha = fadeIn * fadeOut * (0.55 + 0.45 * p);
        s.size = size * (0.85 + 0.3 * p);
      },
    });
  }

  removeTagged(tag: string, fade = 0.8) {
    for (const s of this.sparks) {
      if (s.tag === tag) {
        s.life = Math.min(s.life, s.age + fade);
        s.tag = undefined;
      }
    }
  }

  hasTagged(tag: string) {
    return this.sparks.some((s) => s.tag === tag);
  }

  /** A comet or ice chunk falling onto (lat, lon) from the camera's side of the sky. */
  streak(
    lat: number,
    lon: number,
    opts: { color?: THREE.ColorRepresentation; dur?: number; size?: number; onImpact?: () => void; wave?: WaveOpts | false; from?: THREE.Vector3 } = {},
  ) {
    const target = latLonToVec3(lat, lon, 1.0);
    const fromW = (opts.from ?? new THREE.Vector3(-0.9 + Math.random() * 0.5, 0.75 + Math.random() * 0.4, 0.6)).clone().normalize();
    const fromO = fromW.transformDirection(this.tmpM.copy(this.spinGroup.matrixWorld).invert());
    const start = target.clone().addScaledVector(fromO, 3.2);
    const color = new THREE.Color(opts.color ?? 0xcff6ff);
    const dur = opts.dur ?? 1.6;
    const size = opts.size ?? 0.09;
    const trail = 34;
    const posAt = (t: number, out: THREE.Vector3) => out.lerpVectors(start, target, Math.pow(Math.max(0, Math.min(1, t)), 1.6));
    let done = false;
    for (let i = 0; i < trail; i++) {
      const k = i / trail;
      this.spark({
        pos: start.clone(),
        color: color.clone().multiplyScalar(1 - k * 0.6),
        size: size * (i === 0 ? 1.6 : 1 - k * 0.8),
        life: dur,
        tick: (s) => {
          const t = s.age / dur - k * 0.22;
          posAt(t, s.pos);
          s.alpha = t < 0 ? 0 : Math.pow(1 - k, 1.5) * (i === 0 ? 1.6 : 0.9);
          if (i === 0 && s.age / dur >= 0.97 && !done) {
            done = true;
            if (opts.wave !== false)
              this.shockwave(lat, lon, { maxAngle: 0.12, duration: 2.2, intensity: 0.9, flash: 0.8, color: 0x9be9ff, ...(opts.wave || {}) });
            this.flash(lat, lon, color, size * 4.5, 1.2);
            opts.onImpact?.();
          }
        },
      });
    }
  }

  /** Great-circle arc between two points, with a pulse running along it. */
  arc(a: [number, number], b: [number, number], opts: { color?: THREE.ColorRepresentation; height?: number; life?: number; width?: number } = {}) {
    const va = latLonToVec3(a[0], a[1]);
    const vb = latLonToVec3(b[0], b[1]);
    const ang = va.angleTo(vb);
    const axis = new THREE.Vector3().crossVectors(va, vb).normalize();
    const h = opts.height ?? 0.015 + ang * 0.075;
    const pts: THREE.Vector3[] = [];
    const n = 48;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const v = va.clone().applyAxisAngle(axis, ang * t);
      v.multiplyScalar(1.004 + Math.sin(Math.PI * t) * h);
      pts.push(v);
    }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, opts.width ?? 0.0024, 6, false);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(opts.color ?? 0x5ef2ff) },
        uTime: { value: Math.random() * 3 },
        uOpacity: { value: 0 },
        uGrow: { value: 0 },
      },
      vertexShader: GL.arcVert,
      fragmentShader: GL.arcFrag,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 4;
    this.spinGroup.add(mesh);
    this.arcs.push({ mesh, mat, age: 0, life: opts.life ?? 6 });
  }

  /** Persistent swarm of glowing points orbiting small circles over the original ocean. */
  addSwarm(
    name: string,
    o: {
      count: number;
      color: THREE.ColorRepresentation;
      size?: number;
      speed?: number;
      loop?: number; // angular radius of each little orbit
      filter?: (lat: number, lon: number) => boolean;
      radius?: number;
      blink?: number;
      opacity?: number;
      instant?: boolean;
    },
  ) {
    if (this.swarms.has(name)) return;
    const n = o.count;
    const pos = new Float32Array(n * 3);
    const axis = new Float32Array(n * 3);
    const speed = new Float32Array(n);
    const size = new Float32Array(n);
    const phase = new Float32Array(n);
    const v = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    const side = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const [lat, lon] = this.terrain.randomOcean(o.filter);
      latLonToVec3(lat, lon, 1, v);
      // Orbit axis = the point tipped a little toward a random tangent: it then circles nearby.
      tmp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
      side.crossVectors(v, tmp).normalize();
      const ax = v.clone().applyAxisAngle(side, o.loop ?? 0.08);
      pos.set([v.x, v.y, v.z], i * 3);
      axis.set([ax.x, ax.y, ax.z], i * 3);
      speed[i] = (o.speed ?? 0.05) * (0.5 + Math.random()) * (Math.random() < 0.5 ? -1 : 1);
      size[i] = (o.size ?? 3) * (0.7 + Math.random() * 0.6);
      phase[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aAxis', new THREE.BufferAttribute(axis, 3));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    const target = o.opacity ?? 1;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: this.time },
        uPx: { value: this.renderer.getPixelRatio() },
        uRadius: { value: o.radius ?? 1.006 },
        uColor: { value: new THREE.Color(o.color) },
        uOpacity: { value: o.instant ? target : 0 },
        uBlink: { value: o.blink ?? 0 },
      },
      vertexShader: GL.swarmVert,
      fragmentShader: GL.swarmFrag,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = 3;
    this.spinGroup.add(points);
    this.swarms.set(name, { points, mat, target });
  }

  setSwarmOpacity(name: string, v: number) {
    const s = this.swarms.get(name);
    if (s) s.target = v;
  }

  // ------------------------------------------------------------------ frame

  frame(dt: number) {
    this.time += dt;
    const t = this.time;

    if (this.focusAnim) {
      const f = this.focusAnim;
      f.time += dt;
      const k = easeInOut(Math.min(1, f.time / f.dur));
      this.spin = THREE.MathUtils.lerp(f.s0, f.s1, k);
      this.tilt = THREE.MathUtils.lerp(f.t0, f.t1, k);
      if (f.time >= f.dur) this.focusAnim = null;
    } else if (!this.dragging) {
      const auto = this.holdFocus ? 0 : this.autoSpin;
      this.spinVel = THREE.MathUtils.lerp(this.spinVel, auto, 1 - Math.exp(-dt * 1.4));
      this.tiltVel *= Math.exp(-dt * 2.5);
      this.spin += this.spinVel * dt;
      this.tilt = THREE.MathUtils.clamp(this.tilt + this.tiltVel * dt, -1.25, 1.25);
    }
    this.spinGroup.rotation.y = this.spin;
    this.tiltGroup.rotation.x = this.tilt;

    this.zoom = THREE.MathUtils.lerp(this.zoom, this.zoomTarget, 1 - Math.exp(-dt * 1.4));
    const dist = Math.max(1.03, this.fitDist * this.zoom * (this.zoomTarget < 0.6 ? 1 : this.userZoom));
    this.camera.position.set(0, 0, dist);
    this.camera.lookAt(0, 0, 0);
    this.scene.updateMatrixWorld();

    const inv = this.tmpM.copy(this.mesh.matrixWorld).invert();
    (this.uniforms.uSun.value as THREE.Vector3).copy(this.sunW).transformDirection(inv);
    (this.uniforms.uCam.value as THREE.Vector3).copy(this.camera.position).applyMatrix4(inv);
    this.uniforms.uTime.value = t;
    this.uniforms.uSea.value = this.vis.sea;
    this.uniforms.uMelt.value = this.vis.melt;
    this.uniforms.uAlgae.value = this.vis.algae;
    this.uniforms.uLights.value = this.vis.lights;
    (this.atmoUniforms.uCamW.value as THREE.Vector3).copy(this.camera.position);
    (this.stars.material as THREE.ShaderMaterial).uniforms.uTime.value = t;

    const waves = this.uniforms.uWaves.value as THREE.Vector4[];
    const waveP = this.uniforms.uWaveP.value as THREE.Vector4[];
    for (let i = 0; i < GL.MAX_WAVES; i++) {
      if (this.waveAge[i] < 0) continue;
      this.waveAge[i] += dt;
      if (this.waveAge[i] > waveP[i].y + 0.2) this.waveAge[i] = -1;
      waves[i].w = this.waveAge[i];
    }

    this.updateSparks(dt);

    for (const s of this.swarms.values()) {
      const u = s.mat.uniforms;
      u.uTime.value = t;
      u.uOpacity.value = THREE.MathUtils.lerp(u.uOpacity.value, s.target, 1 - Math.exp(-dt * 0.8));
    }

    this.arcs = this.arcs.filter((a) => {
      a.age += dt;
      const u = a.mat.uniforms;
      u.uTime.value += dt;
      u.uGrow.value = Math.min(1, a.age / 0.9);
      u.uOpacity.value = Math.min(1, a.age / 0.4) * Math.max(0, Math.min(1, (a.life - a.age) / 1.0));
      if (a.age >= a.life) {
        this.spinGroup.remove(a.mesh);
        a.mesh.geometry.dispose();
        a.mat.dispose();
        return false;
      }
      return true;
    });

    this.renderer.render(this.scene, this.camera);
  }

  private updateSparks(dt: number) {
    const g = this.sparkGeo;
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const col = g.getAttribute('aColor') as THREE.BufferAttribute;
    const size = g.getAttribute('aSize') as THREE.BufferAttribute;
    const alpha = g.getAttribute('aAlpha') as THREE.BufferAttribute;
    const style = g.getAttribute('aStyle') as THREE.BufferAttribute;
    let n = 0;
    const live: Spark[] = [];
    for (const s of this.sparks) {
      s.age += dt;
      if (s.age >= s.life) continue;
      if (s.tick && s.tick(s, dt) === false) continue;
      live.push(s);
      pos.setXYZ(n, s.pos.x, s.pos.y, s.pos.z);
      col.setXYZ(n, s.color.r, s.color.g, s.color.b);
      size.setX(n, s.size * 60);
      alpha.setX(n, s.alpha);
      style.setX(n, s.style);
      n++;
    }
    this.sparks = live;
    g.setDrawRange(0, n);
    if (n) {
      for (const a of [pos, col, size, alpha, style]) {
        a.clearUpdateRanges();
        a.addUpdateRange(0, n * a.itemSize);
        a.needsUpdate = true;
      }
    }
  }

  dispose() {
    for (const [t, type, fn, opts] of this.listeners) t.removeEventListener(type, fn, opts);
    this.listeners = [];
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    for (const t of this.textures) t.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
