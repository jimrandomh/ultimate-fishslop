// The solar system, rendered with three.js: Sun, planets (that crack, shrink and stream debris
// as they are disassembled), a Dyson swarm that thickens into a geodesic shell, ocean worlds on
// Earth's orbit, and probe streaks leaving for other stars. Bloom does most of the prettiness.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeCrackTexture, makeGlowTexture, makePlanetTextures, makeRingTexture, type PlanetTextures } from './textures';

/** Display distance for a real orbit (square-root compression). */
export const dist = (au: number) => 10 * Math.sqrt(au);
export const SHELL_R = dist(2.0);

export type Framing = 'earth' | 'inner' | 'outer' | 'all' | 'finale';

export interface ViewState {
  frac: Record<string, number>; // sim body id -> fraction disassembled
  active: string | null;
  completion: number; // shell, 0..1
  shellBuilt: boolean; // shell project bought
  swarm: number; // 0..1 visual density of the swarm
  drones: number;
  oceanWorlds: number;
  framing: Framing;
  probesAuto: number; // ambient probe launches per second
}

interface Orbiter {
  id: string;
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  size: number;
  body: string; // sim body id ('' = never mined)
  parent: Orbiter | null;
  r: number; // orbit radius (display units)
  period: number; // seconds per orbit
  phase: number;
  spin: number;
  orbitLine?: THREE.LineLoop;
  label: string;
  pos: THREE.Vector3;
  gone: boolean;
}

const PLANETS: { id: string; au: number; size: number; body: string; label: string; tilt?: number }[] = [
  { id: 'mercury', au: 0.387, size: 0.34, body: 'mercury', label: 'Mercury' },
  { id: 'venus', au: 0.723, size: 0.56, body: 'venus', label: 'Venus' },
  { id: 'earth', au: 1.0, size: 0.6, body: '', label: 'Earth', tilt: 0.41 },
  { id: 'mars', au: 1.524, size: 0.42, body: 'mars', label: 'Mars' },
  { id: 'jupiter', au: 5.2, size: 1.75, body: 'jupiter', label: 'Jupiter', tilt: 0.05 },
  { id: 'saturn', au: 9.54, size: 1.45, body: 'saturn', label: 'Saturn', tilt: 0.47 },
  { id: 'uranus', au: 19.2, size: 1.0, body: 'uranus', label: 'Uranus', tilt: 1.7 },
  { id: 'neptune', au: 30.1, size: 0.98, body: 'neptune', label: 'Neptune', tilt: 0.49 },
];

const MOONS: { id: string; parent: string; r: number; size: number; body: string; period: number; label: string }[] = [
  { id: 'moon', parent: 'earth', r: 1.65, size: 0.2, body: 'moon', period: 14, label: 'The Moon' },
  { id: 'io', parent: 'jupiter', r: 2.5, size: 0.13, body: 'jovian', period: 5, label: 'Io' },
  { id: 'europa', parent: 'jupiter', r: 3.0, size: 0.12, body: 'jovian', period: 8, label: 'Europa' },
  { id: 'ganymede', parent: 'jupiter', r: 3.7, size: 0.17, body: 'jovian', period: 13, label: 'Ganymede' },
  { id: 'callisto', parent: 'jupiter', r: 4.5, size: 0.16, body: 'jovian', period: 21, label: 'Callisto' },
  { id: 'titan', parent: 'saturn', r: 4.4, size: 0.16, body: 'saturnian', period: 17, label: 'Titan' },
  { id: 'enceladus', parent: 'saturn', r: 3.5, size: 0.075, body: 'saturnian', period: 7, label: 'Enceladus' },
];

/** Where the camera centres each sim body for labels / debris. */
const BODY_ANCHOR: Record<string, string> = {
  moon: 'moon',
  mercury: 'mercury',
  mars: 'mars',
  belt: 'belt',
  venus: 'venus',
  jovian: 'ganymede',
  saturnian: 'titan',
  uranus: 'uranus',
  neptune: 'neptune',
  kuiper: 'pluto',
  saturn: 'saturn',
  jupiter: 'jupiter',
};

const BELT_IN = dist(2.2), BELT_OUT = dist(3.3);
const KUIPER_IN = dist(32), KUIPER_OUT = dist(50);

// GLSL value noise shared by the Sun shader.
const NOISE_GLSL = /* glsl */ `
float h3(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vn(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h3(i+vec3(0,0,0)),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*vn(p); p*=2.03; a*=0.5; } return s; }
`;

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

export class SolarView {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private disposables: { dispose(): void }[] = [];
  private textures: PlanetTextures;
  private orbiters = new Map<string, Orbiter>();
  private sun: THREE.Mesh;
  private sunMat: THREE.ShaderMaterial;
  private corona: THREE.Sprite;
  private halo: THREE.Sprite;
  private light: THREE.PointLight;
  private swarm: THREE.Points;
  private swarmMat: THREE.ShaderMaterial;
  private shell: THREE.Mesh;
  private shellMat: THREE.ShaderMaterial;
  private shellGuide: THREE.LineLoop;
  private beltMat: THREE.ShaderMaterial;
  private kuiperMat: THREE.ShaderMaterial;
  private rings: THREE.Mesh;
  private ringMat: THREE.MeshBasicMaterial;
  private earthAtmo: THREE.Mesh;
  private oceans: THREE.InstancedMesh;
  private oceanRing: THREE.Points;
  private oceanRingMat: THREE.ShaderMaterial;
  private stars: THREE.Points;
  private starMat: THREE.ShaderMaterial;
  // particles
  private debris: DebrisSystem;
  private drones: DroneCloud;
  private probes: ProbeStreaks;
  // camera
  private camTarget = new THREE.Vector3();
  private camDist = 6;
  private camElev = 0.3;
  private camYaw = 0;
  private userYaw = 0;
  private userZoom = 1;
  private userElev = 0;
  private autoYaw = 0;
  private leftInset = 0;
  private rightInset = 0;
  private offX = 0;
  private width = 1;
  private height = 1;
  private time = 0;
  private sunDim = 0;
  private finaleT = -1;
  private shellFlash = 0;
  private lastFrame: ViewState | null = null;
  private disposeInput: () => void;
  private oceanDummy = new THREE.Object3D();

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.setClearColor(0x000000, 1);
    container.append(this.renderer.domElement);
    this.renderer.domElement.classList.add('sp-canvas');

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 8000);
    this.scene.add(this.camera);

    this.textures = makePlanetTextures();
    Object.values(this.textures).forEach((t) => this.disposables.push(t));
    const crack = makeCrackTexture();
    const glow = makeGlowTexture(256, 2.0);
    const ringTex = makeRingTexture();
    this.disposables.push(crack, glow, ringTex);

    // ---- stars
    {
      const N = 7000;
      const pos = new Float32Array(N * 3);
      const col = new Float32Array(N * 3);
      const size = new Float32Array(N);
      const r = rng(77);
      const bandAxis = new THREE.Vector3(0.3, 0.86, 0.4).normalize();
      for (let i = 0; i < N; i++) {
        let v: THREE.Vector3;
        if (i < N * 0.45) {
          // Milky Way band: points near the great circle perpendicular to bandAxis
          const a = r() * Math.PI * 2;
          const u = new THREE.Vector3(1, 0, 0).cross(bandAxis).normalize();
          const w = bandAxis.clone().cross(u);
          const off = (r() + r() + r() - 1.5) * 0.22;
          v = u.multiplyScalar(Math.cos(a)).add(w.multiplyScalar(Math.sin(a))).add(bandAxis.clone().multiplyScalar(off)).normalize();
        } else {
          const z = r() * 2 - 1, t = r() * Math.PI * 2, q = Math.sqrt(1 - z * z);
          v = new THREE.Vector3(q * Math.cos(t), z, q * Math.sin(t));
        }
        v.multiplyScalar(3000);
        pos.set([v.x, v.y, v.z], i * 3);
        const temp = r();
        const c = temp < 0.15 ? [1.0, 0.75, 0.55] : temp < 0.3 ? [0.7, 0.8, 1.0] : [1, 0.96, 0.92];
        const b = i < N * 0.45 ? 0.25 + r() * 0.5 : 0.35 + Math.pow(r(), 4) * 1.4;
        col.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
        size[i] = i < N * 0.45 ? 1.0 + r() * 1.2 : 1.2 + Math.pow(r(), 6) * 3.2;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
      this.starMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uPx: { value: this.renderer.getPixelRatio() } },
        vertexShader: /* glsl */ `
          attribute float aSize; varying vec3 vCol; uniform float uTime; uniform float uPx;
          void main(){
            vCol = color * (0.8 + 0.2*sin(uTime*1.7 + position.x*0.13 + position.y*0.07));
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
            gl_PointSize = aSize * uPx;
          }`,
        fragmentShader: /* glsl */ `
          varying vec3 vCol;
          void main(){ vec2 d = gl_PointCoord-0.5; float a = smoothstep(0.5,0.0,length(d)); gl_FragColor = vec4(vCol*a, a); }`,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      this.stars = new THREE.Points(g, this.starMat);
      this.stars.frustumCulled = false;
      this.scene.add(this.stars);
      this.disposables.push(g, this.starMat);
    }

    // ---- sun
    {
      this.sunMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uDim: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec3 vPos; varying vec3 vN; varying vec3 vV;
          void main(){ vPos = position; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
        fragmentShader: /* glsl */ `
          uniform float uTime; uniform float uDim; varying vec3 vPos; varying vec3 vN; varying vec3 vV;
          ${NOISE_GLSL}
          void main(){
            vec3 p = normalize(vPos);
            float n = fbm(p*4.0 + vec3(uTime*0.04, uTime*0.02, 0.0));
            float g = fbm(p*16.0 - vec3(0.0, uTime*0.09, uTime*0.05));
            vec3 col = mix(vec3(1.0,0.38,0.06), vec3(1.0,0.86,0.5), smoothstep(0.25,0.75,n));
            col += vec3(1.0,0.92,0.7) * pow(g, 2.5) * 0.9;
            float mu = max(dot(vN, vV), 0.0);
            col *= 0.45 + 0.55*pow(mu, 0.45);
            gl_FragColor = vec4(col * 3.2 * (1.0 - uDim), 1.0);
          }`,
      });
      const g = new THREE.SphereGeometry(2.2, 64, 32);
      this.sun = new THREE.Mesh(g, this.sunMat);
      this.scene.add(this.sun);
      this.disposables.push(g, this.sunMat);
      const cm = new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(1.0, 0.62, 0.28).multiplyScalar(1.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
      this.corona = new THREE.Sprite(cm);
      this.corona.scale.setScalar(15);
      this.scene.add(this.corona);
      const hm = new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(1.0, 0.55, 0.25).multiplyScalar(0.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
      this.halo = new THREE.Sprite(hm);
      this.halo.scale.setScalar(70);
      this.scene.add(this.halo);
      this.disposables.push(cm, hm);
      this.light = new THREE.PointLight(0xfff2e0, 3.2, 0, 0);
      this.scene.add(this.light);
      this.scene.add(new THREE.AmbientLight(0x6080b0, 0.07));
    }

    // ---- planets & moons
    const sphere = new THREE.SphereGeometry(1, 48, 24);
    this.disposables.push(sphere);
    const r = rng(5);
    const orbitMatBase = new THREE.LineBasicMaterial({ color: 0x7fa6d6, transparent: true, opacity: 0.14, depthWrite: false });
    this.disposables.push(orbitMatBase);
    const addOrbiter = (o: Omit<Orbiter, 'mesh' | 'mat' | 'pos' | 'gone'>, tex: THREE.Texture, tilt = 0, rough = 0.95) => {
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: rough, metalness: 0, emissiveMap: crack, emissive: new THREE.Color(1.0, 0.45, 0.12), emissiveIntensity: 0 });
      const mesh = new THREE.Mesh(sphere, mat);
      mesh.scale.setScalar(o.size);
      mesh.rotation.z = tilt;
      this.scene.add(mesh);
      this.disposables.push(mat);
      const orb: Orbiter = { ...o, mesh, mat, pos: new THREE.Vector3(), gone: false };
      // orbit line
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < 256; i++) {
        const a = (i / 256) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * o.r, 0, Math.sin(a) * o.r));
      }
      const lg = new THREE.BufferGeometry().setFromPoints(pts);
      const lm = orbitMatBase.clone();
      if (o.parent) lm.opacity = 0.12;
      if (o.id === 'earth') {
        lm.color.set(0x8fd0ff);
        lm.opacity = 0.32;
      }
      orb.orbitLine = new THREE.LineLoop(lg, lm);
      this.scene.add(orb.orbitLine);
      this.disposables.push(lg, lm);
      this.orbiters.set(o.id, orb);
      return orb;
    };
    for (const p of PLANETS) {
      const R = dist(p.au);
      addOrbiter(
        { id: p.id, size: p.size, body: p.body, parent: null, r: R, period: 80 * Math.pow(p.au, 1.5), phase: r() * Math.PI * 2, spin: 0.3 + r() * 0.4, label: p.label },
        this.textures[p.id],
        p.tilt ?? 0,
        p.id === 'earth' ? 0.45 : 0.95,
      );
    }
    // Start with Earth somewhere photogenic.
    this.orbiters.get('earth')!.phase = 0.6;
    for (const m of MOONS) {
      addOrbiter(
        { id: m.id, size: m.size, body: m.body, parent: this.orbiters.get(m.parent)!, r: m.r, period: m.period, phase: r() * Math.PI * 2, spin: 0.2, label: m.label },
        this.textures[m.id === 'moon' ? 'moon' : m.id],
      );
    }
    addOrbiter(
      { id: 'pluto', size: 0.14, body: 'kuiper', parent: null, r: dist(39.5), period: 80 * Math.pow(39.5, 1.5), phase: 2.2, spin: 0.2, label: 'Pluto' },
      this.textures.pluto,
    );

    // Earth atmosphere rim
    {
      const am = new THREE.ShaderMaterial({
        uniforms: { uSun: { value: new THREE.Vector3() } },
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vW;
          void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uSun; varying vec3 vN; varying vec3 vW;
          void main(){
            vec3 v = normalize(cameraPosition - vW);
            float rim = pow(1.0 - abs(dot(vN, v)), 3.0);
            float lit = smoothstep(-0.25, 0.4, dot(vN, normalize(uSun - vW)));
            gl_FragColor = vec4(vec3(0.35,0.65,1.0)*rim*lit*1.6, rim*lit);
          }`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.BackSide,
      });
      this.earthAtmo = new THREE.Mesh(sphere, am);
      this.scene.add(this.earthAtmo);
      this.disposables.push(am);
    }

    // Saturn's rings
    {
      const g = new THREE.RingGeometry(1.95, 3.3, 128, 1);
      const uv = g.attributes.uv as THREE.BufferAttribute;
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) {
        const rr = Math.hypot(p.getX(i), p.getY(i));
        uv.setXY(i, (rr - 1.95) / (3.3 - 1.95), 0.5);
      }
      this.ringMat = new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, color: 0xbbb3a0 });
      this.rings = new THREE.Mesh(g, this.ringMat);
      this.rings.rotation.x = -Math.PI / 2 + 0.47;
      this.scene.add(this.rings);
      this.disposables.push(g, this.ringMat);
    }

    // ---- asteroid & Kuiper belts (orbiting point clouds; aKeep lets them thin out)
    const beltPoints = (n: number, rin: number, rout: number, thick: number, seed: number, color: THREE.Color) => {
      const rr = rng(seed);
      const orbit = new Float32Array(n * 4);
      const keep = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const R = rin + (rout - rin) * Math.pow(rr(), 0.9);
        orbit.set([R, (rr() - 0.5) * thick, rr() * Math.PI * 2, 0.6 + rr() * 0.8], i * 4);
        keep[i] = rr();
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      g.setAttribute('aOrbit', new THREE.BufferAttribute(orbit, 4));
      g.setAttribute('aKeep', new THREE.BufferAttribute(keep, 1));
      const m = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uGone: { value: 0 }, uColor: { value: color }, uPx: { value: this.renderer.getPixelRatio() }, uLight: { value: 1 } },
        vertexShader: /* glsl */ `
          attribute vec4 aOrbit; attribute float aKeep; uniform float uTime; uniform float uGone; uniform float uPx; varying float vA;
          void main(){
            float R = aOrbit.x;
            float a = aOrbit.z + uTime * 6.2831 / (80.0 * pow(R/10.0, 3.0));
            vec3 p = vec3(cos(a)*R, aOrbit.y, sin(a)*R);
            vec4 mv = modelViewMatrix*vec4(p,1.0);
            gl_Position = projectionMatrix*mv;
            vA = aKeep < uGone ? 0.0 : 1.0;
            gl_PointSize = vA * aOrbit.w * 1.6 * uPx;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; uniform float uLight; varying float vA;
          void main(){ if (vA < 0.5) discard; float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.1,d); gl_FragColor = vec4(uColor*uLight, a*0.9); }`,
        transparent: true,
        depthWrite: false,
      });
      const pts = new THREE.Points(g, m);
      pts.frustumCulled = false;
      this.scene.add(pts);
      this.disposables.push(g, m);
      return m;
    };
    this.beltMat = beltPoints(2600, BELT_IN, BELT_OUT, 0.9, 31, new THREE.Color(0.62, 0.55, 0.48));
    this.kuiperMat = beltPoints(3400, KUIPER_IN, KUIPER_OUT, 4.5, 37, new THREE.Color(0.55, 0.62, 0.72));

    // ---- Dyson swarm: collectors on inclined orbits around the shell radius
    {
      const N = 26000;
      const rr = rng(11);
      const orbit = new Float32Array(N * 4);
      const idx = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const R = SHELL_R * (0.94 + rr() * 0.12);
        const inc = Math.acos(1 - 2 * rr()); // isotropic orbit normals
        orbit.set([R, inc, rr() * Math.PI * 2, rr() * Math.PI * 2], i * 4);
        idx[i] = i / N;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      g.setAttribute('aOrbit', new THREE.BufferAttribute(orbit, 4));
      g.setAttribute('aIdx', new THREE.BufferAttribute(idx, 1));
      this.swarmMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uCount: { value: 0 }, uPx: { value: this.renderer.getPixelRatio() }, uFade: { value: 1 } },
        vertexShader: /* glsl */ `
          attribute vec4 aOrbit; attribute float aIdx; uniform float uTime; uniform float uCount; uniform float uPx; varying float vG; varying float vA;
          void main(){
            if (aIdx > uCount) { gl_Position = vec4(2.0,2.0,2.0,1.0); gl_PointSize = 0.0; vA = 0.0; return; }
            float R = aOrbit.x; float inc = aOrbit.y; float node = aOrbit.z;
            float a = aOrbit.w + uTime * 0.35 * pow(14.0/R, 1.5);
            vec3 p = vec3(cos(a)*R, 0.0, sin(a)*R);
            p = vec3(p.x, -p.z*sin(inc), p.z*cos(inc));
            float cn = cos(node), sn = sin(node);
            p = vec3(p.x*cn - p.z*sn, p.y, p.x*sn + p.z*cn);
            vec4 mv = modelViewMatrix*vec4(p,1.0);
            gl_Position = projectionMatrix*mv;
            vG = pow(0.5 + 0.5*sin(uTime*2.3 + aIdx*7919.0), 14.0);
            vA = 1.0 - smoothstep(uCount - 0.02, uCount, aIdx);
            gl_PointSize = (1.1 + vG*2.4) * uPx;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uFade; varying float vG; varying float vA;
          void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d) * vA * uFade; gl_FragColor = vec4(vec3(1.0,0.78,0.42)*(0.32+vG*2.2)*a, a); }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      this.swarm = new THREE.Points(g, this.swarmMat);
      this.swarm.frustumCulled = false;
      this.scene.add(this.swarm);
      this.disposables.push(g, this.swarmMat);
    }

    // ---- the shell: a geodesic sphere whose triangles appear as completion rises
    {
      const g = new THREE.IcosahedronGeometry(SHELL_R, 15);
      const pos = g.attributes.position as THREE.BufferAttribute;
      const tris = pos.count / 3;
      const bary = new Float32Array(pos.count * 3);
      const reveal = new Float32Array(pos.count);
      const seed = new Float32Array(pos.count);
      const raw: { i: number; v: number }[] = [];
      const rr = rng(23);
      for (let t = 0; t < tris; t++) {
        const cx = (pos.getX(t * 3) + pos.getX(t * 3 + 1) + pos.getX(t * 3 + 2)) / 3 / SHELL_R;
        const cy = (pos.getY(t * 3) + pos.getY(t * 3 + 1) + pos.getY(t * 3 + 2)) / 3 / SHELL_R;
        const cz = (pos.getZ(t * 3) + pos.getZ(t * 3 + 1) + pos.getZ(t * 3 + 2)) / 3 / SHELL_R;
        // Construction spreads from a few nuclei and in a band around the ecliptic.
        const n = Math.sin(cx * 3.1 + 1.0) * Math.sin(cy * 2.3 + 2.0) * Math.sin(cz * 2.7 + 0.5);
        const band = Math.abs(cy);
        raw.push({ i: t, v: band * 0.55 + (0.5 - n) * 0.35 + rr() * 0.32 });
      }
      raw.sort((a, b) => a.v - b.v);
      raw.forEach((x, rank) => {
        const v = (rank + 1) / tris;
        const s = rr();
        for (let k = 0; k < 3; k++) {
          reveal[x.i * 3 + k] = v;
          seed[x.i * 3 + k] = s;
        }
      });
      for (let t = 0; t < tris; t++) bary.set([1, 0, 0, 0, 1, 0, 0, 0, 1], t * 9);
      g.setAttribute('aBary', new THREE.BufferAttribute(bary, 3));
      g.setAttribute('aReveal', new THREE.BufferAttribute(reveal, 1));
      g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
      this.shellMat = new THREE.ShaderMaterial({
        uniforms: { uProgress: { value: 0 }, uTime: { value: 0 }, uSun: { value: 1 }, uHeat: { value: 0 }, uFlash: { value: 0 }, uFresh: { value: 1 } },
        vertexShader: /* glsl */ `
          attribute vec3 aBary; attribute float aReveal; attribute float aSeed;
          varying vec3 vBary; varying float vReveal; varying float vSeed; varying vec3 vW; varying vec3 vN;
          void main(){
            vBary = aBary; vReveal = aReveal; vSeed = aSeed;
            vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vN = normalize(position);
            gl_Position = projectionMatrix*viewMatrix*w;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uProgress; uniform float uTime; uniform float uSun; uniform float uHeat; uniform float uFlash; uniform float uFresh;
          varying vec3 vBary; varying float vReveal; varying float vSeed; varying vec3 vW; varying vec3 vN;
          void main(){
            if (vReveal > uProgress) discard;
            float e = min(min(vBary.x, vBary.y), vBary.z);
            float line = 1.0 - smoothstep(0.0, 0.045, e);
            float fresh = (1.0 - smoothstep(0.0, 0.004, uProgress - vReveal)) * uFresh * smoothstep(0.02, 0.08, uProgress);
            vec3 col;
            vec3 v = normalize(cameraPosition - vW);
            float facing = dot(vN, v);
            if (facing > 0.0) {
              // outer surface: dark, faintly warm, construction seams
              float rim = pow(1.0 - facing, 2.0);
              vec3 base = vec3(0.009, 0.0085, 0.01) * (0.6 + 0.8*vSeed);
              // waste heat: a dim infrared glow that breathes slowly once the shell is closed
              float breathe = 0.85 + 0.15*sin(uTime*0.7 + vSeed*6.0);
              vec3 heat = vec3(1.0, 0.22, 0.05) * (0.003 + 0.016*vSeed) * uHeat * breathe;
              col = base + heat + vec3(0.05,0.032,0.024)*rim*rim;
              col += line * vec3(1.0, 0.45, 0.16) * (0.07 + 0.05*uHeat) * mix(1.0, breathe, uHeat);
              col += fresh * vec3(1.0, 0.75, 0.4) * 1.4;
              col += uFlash * vec3(1.0, 0.8, 0.55) * (0.6 + line*2.0);
            } else {
              col = vec3(1.0, 0.66, 0.32) * (0.75 + 0.45*vSeed) * uSun * 0.42;
              col *= 1.0 - line*0.5;
            }
            gl_FragColor = vec4(col, 1.0);
          }`,
        side: THREE.DoubleSide,
      });
      this.shell = new THREE.Mesh(g, this.shellMat);
      this.scene.add(this.shell);
      this.disposables.push(g, this.shellMat);

      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < 360; i++) {
        const a = (i / 360) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * SHELL_R, 0, Math.sin(a) * SHELL_R));
      }
      const lg = new THREE.BufferGeometry().setFromPoints(pts);
      const lm = new THREE.LineDashedMaterial({ color: 0xffc070, transparent: true, opacity: 0, dashSize: 0.5, gapSize: 0.5, depthWrite: false });
      this.shellGuide = new THREE.LineLoop(lg, lm);
      this.shellGuide.computeLineDistances();
      this.scene.add(this.shellGuide);
      this.disposables.push(lg, lm);
    }

    // ---- ocean worlds on Earth's orbit
    {
      const om = new THREE.MeshStandardMaterial({ map: this.textures.ocean, roughness: 0.35, emissive: new THREE.Color(0.03, 0.12, 0.3), emissiveIntensity: 1 });
      this.oceans = new THREE.InstancedMesh(sphere, om, 64);
      this.oceans.count = 0;
      this.oceans.frustumCulled = false;
      this.scene.add(this.oceans);
      this.disposables.push(om);
      const N = 5000;
      const rr = rng(41);
      const orbit = new Float32Array(N * 4);
      const idx = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        orbit.set([dist(1) + (rr() - 0.5) * 0.9 * Math.sqrt(rr()), (rr() - 0.5) * 0.25, rr() * Math.PI * 2, 0.6 + rr()], i * 4);
        idx[i] = rr();
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      g.setAttribute('aOrbit', new THREE.BufferAttribute(orbit, 4));
      g.setAttribute('aIdx', new THREE.BufferAttribute(idx, 1));
      this.oceanRingMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uCount: { value: 0 }, uPx: { value: this.renderer.getPixelRatio() } },
        vertexShader: /* glsl */ `
          attribute vec4 aOrbit; attribute float aIdx; uniform float uTime; uniform float uCount; uniform float uPx; varying float vA;
          void main(){
            float a = aOrbit.z + uTime * 6.2831 / 80.0;
            vec3 p = vec3(cos(a)*aOrbit.x, aOrbit.y, sin(a)*aOrbit.x);
            gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0);
            vA = aIdx < uCount ? 1.0 : 0.0;
            gl_PointSize = vA * aOrbit.w * 1.5 * uPx;
          }`,
        fragmentShader: /* glsl */ `
          varying float vA;
          void main(){ if (vA < 0.5) discard; float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d); gl_FragColor = vec4(vec3(0.25,0.6,1.0)*a*0.9, a); }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      this.oceanRing = new THREE.Points(g, this.oceanRingMat);
      this.oceanRing.frustumCulled = false;
      this.scene.add(this.oceanRing);
      this.disposables.push(g, this.oceanRingMat);
    }

    // ---- particles
    this.debris = new DebrisSystem(this.renderer.getPixelRatio());
    this.drones = new DroneCloud(this.renderer.getPixelRatio());
    this.probes = new ProbeStreaks(this.renderer.getPixelRatio());
    this.scene.add(this.debris.points, this.drones.points, this.probes.lines, this.probes.heads);
    this.disposables.push(this.debris, this.drones, this.probes);

    // ---- post
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.5, 0.78);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.disposeInput = this.bindInput();
    this.resize();
    this.positionOrbiters();
    // Snap camera to its first framing.
    const earth = this.orbiters.get('earth')!;
    this.camTarget.copy(earth.pos);
  }

  // ---------------------------------------------------------------- input

  private bindInput() {
    const el = this.renderer.domElement;
    let dragging = false;
    let lx = 0, ly = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      lx = e.clientX;
      ly = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      this.userYaw += (e.clientX - lx) * 0.005;
      this.userElev = Math.max(-0.35, Math.min(0.75, this.userElev + (e.clientY - ly) * 0.003));
      lx = e.clientX;
      ly = e.clientY;
    };
    const up = () => (dragging = false);
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      this.userZoom = Math.max(0.45, Math.min(2.2, this.userZoom * Math.exp(e.deltaY * 0.0012)));
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }

  // ---------------------------------------------------------------- layout

  setLeftInset(px: number) {
    this.leftInset = px;
    this.offX = this.targetOffX();
    this.applyViewOffset();
  }

  /** Space taken by overlays on the right (eased, so the scene glides rather than jumps). */
  setRightInset(px: number) {
    this.rightInset = px;
  }

  private targetOffX() {
    return -(this.leftInset - this.rightInset) / 2;
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.composer.setSize(w, h);
    this.bloom.resolution.set(Math.max(1, w / 2), Math.max(1, h / 2));
    this.camera.aspect = w / h;
    this.applyViewOffset();
  }

  private applyViewOffset() {
    // Shift the projection so the scene centres in the area right of the panel.
    this.camera.setViewOffset(this.width, this.height, this.offX, 0, this.width, this.height);
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- per-frame

  private positionOrbiters() {
    for (const o of this.orbiters.values()) {
      const a = o.phase + (this.time / o.period) * Math.PI * 2;
      o.pos.set(Math.cos(a) * o.r, 0, Math.sin(a) * o.r);
      if (o.parent) {
        o.pos.y = Math.sin(a * 0.7) * o.r * 0.06;
        o.pos.add(o.parent.pos);
        o.orbitLine!.position.copy(o.parent.pos);
      }
      o.mesh.position.copy(o.pos);
      o.mesh.rotation.y = this.time * o.spin;
    }
  }

  anchorPos(bodyId: string, out = new THREE.Vector3()): THREE.Vector3 {
    if (bodyId === 'belt') {
      const a = this.time * 0.02;
      return out.set(Math.cos(a) * (BELT_IN + BELT_OUT) * 0.5, 0, Math.sin(a) * (BELT_IN + BELT_OUT) * 0.5);
    }
    const o = this.orbiters.get(BODY_ANCHOR[bodyId] ?? bodyId);
    return o ? out.copy(o.pos) : out.set(0, 0, 0);
  }

  update(dt: number, vs: ViewState) {
    this.time += dt;
    const t = this.time;
    this.lastFrame = vs;
    this.positionOrbiters();

    // ---- bodies: crack, shrink, vanish
    for (const o of this.orbiters.values()) {
      if (!o.body) continue;
      const f = vs.frac[o.body] ?? 0;
      const active = vs.active === o.body;
      const s = f >= 1 ? 0 : Math.cbrt(1 - f);
      o.mesh.scale.setScalar(o.size * Math.max(0.0001, s));
      o.mesh.visible = f < 1;
      const glow = f >= 1 ? 0 : active ? 0.55 + 1.6 * Math.pow(f, 0.6) + 0.25 * Math.sin(t * 3.0) : f > 0 ? 0.4 : 0;
      o.mat.emissiveIntensity += (glow - o.mat.emissiveIntensity) * Math.min(1, dt * 3);
      if (o.orbitLine) {
        const lm = o.orbitLine.material as THREE.LineBasicMaterial;
        const local = o.id === 'earth' || o.id === 'moon';
        const want = (f >= 1 ? 0.03 : o.parent ? 0.1 : 0.14) * (vs.framing === 'earth' && !local ? 0.25 : 1) * (o.id === 'moon' ? 2 : 1);
        lm.opacity += (want - lm.opacity) * Math.min(1, dt * 1.5);
      }
      if (f >= 1 && !o.gone) o.gone = true;
    }
    const earth = this.orbiters.get('earth')!;
    this.earthAtmo.position.copy(earth.pos);
    this.earthAtmo.scale.setScalar(earth.size * 1.06);
    (this.earthAtmo.material as THREE.ShaderMaterial).uniforms.uSun.value.set(0, 0, 0);

    const saturn = this.orbiters.get('saturn')!;
    this.rings.position.copy(saturn.pos);
    const satFrac = vs.frac.saturn ?? 0;
    this.rings.scale.setScalar(Math.max(0.0001, Math.cbrt(1 - satFrac)));
    this.ringMat.opacity = Math.max(0, 1 - (vs.frac.saturnian ?? 0)) * (satFrac >= 1 ? 0 : 1);
    this.rings.visible = this.ringMat.opacity > 0.01;

    // ---- belts
    this.beltMat.uniforms.uTime.value = t;
    this.beltMat.uniforms.uGone.value = vs.frac.belt ?? 0;
    this.kuiperMat.uniforms.uTime.value = t;
    this.kuiperMat.uniforms.uGone.value = vs.frac.kuiper ?? 0;

    // ---- Sun & light, dimmed by the shell
    const c = vs.completion;
    const finale = this.finaleT >= 0 ? Math.min(1, (t - this.finaleT) / 5) : 0;
    const dimTarget = Math.max(finale, Math.pow(c, 1.4) * 0.7);
    this.sunDim += (dimTarget - this.sunDim) * Math.min(1, dt * 1.2);
    this.sunMat.uniforms.uTime.value = t;
    this.sunMat.uniforms.uDim.value = this.sunDim * 0.6;
    (this.corona.material as THREE.SpriteMaterial).opacity = 1 - this.sunDim;
    (this.halo.material as THREE.SpriteMaterial).opacity = 1 - this.sunDim;
    // Glows keep a roughly constant angular size so they never flood the screen up close.
    const dSun = this.camera.position.length();
    this.corona.scale.setScalar(Math.min(10, dSun * 0.2) * (1 + Math.sin(t * 0.8) * 0.03));
    this.halo.scale.setScalar(Math.min(52, dSun * 0.55));
    this.light.intensity = 3.2 * (1 - this.sunDim * 0.9);
    this.beltMat.uniforms.uLight.value = 1 - this.sunDim * 0.9;
    this.kuiperMat.uniforms.uLight.value = 1 - this.sunDim * 0.9;

    // ---- swarm & shell
    this.swarmMat.uniforms.uTime.value = t;
    const swarmTarget = vs.shellBuilt ? vs.swarm : 0;
    const cur = this.swarmMat.uniforms.uCount.value as number;
    this.swarmMat.uniforms.uCount.value = cur + (swarmTarget - cur) * Math.min(1, dt * 2);
    this.swarmMat.uniforms.uFade.value = (1 - Math.sqrt(c) * 0.6) * (1 - finale * 0.85);
    const shellVis = c <= 0 ? 0 : Math.pow(c, 0.72);
    const sp = this.shellMat.uniforms.uProgress.value as number;
    this.shellMat.uniforms.uProgress.value = sp + (shellVis - sp) * Math.min(1, dt * 2.5);
    this.shellMat.uniforms.uTime.value = t;
    this.shellMat.uniforms.uSun.value = 1 - this.sunDim;
    this.shellMat.uniforms.uHeat.value = Math.min(1, Math.pow(c, 2) + finale);
    this.shellMat.uniforms.uFresh.value = c >= 1 ? Math.max(0, 1 - finale * 3) : 1;
    this.shellFlash = Math.max(0, this.shellFlash - dt * 0.8);
    this.shellMat.uniforms.uFlash.value = this.shellFlash;
    const gm = this.shellGuide.material as THREE.LineDashedMaterial;
    gm.opacity += ((vs.shellBuilt && c < 0.5 ? 0.35 : 0) - gm.opacity) * Math.min(1, dt * 1.5);

    // ---- ocean worlds: first a string of pearls, then a ring
    const nWorlds = Math.min(64, Math.max(0, vs.oceanWorlds));
    this.oceans.count = nWorlds;
    const ea = Math.atan2(earth.pos.z, earth.pos.x);
    for (let i = 0; i < nWorlds; i++) {
      const k = i + 1;
      const off = k === 1 ? Math.PI / 3 : k === 2 ? -Math.PI / 3 : ((k * 0.6180339) % 1) * Math.PI * 2;
      const a = ea + off;
      const R = dist(1) + Math.sin(k * 12.9898) * 0.25;
      this.oceanDummy.position.set(Math.cos(a) * R, Math.sin(k * 4.1) * 0.12, Math.sin(a) * R);
      this.oceanDummy.scale.setScalar(0.17 + 0.05 * Math.abs(Math.sin(k * 7.3)));
      this.oceanDummy.rotation.y = t * 0.3 + k;
      this.oceanDummy.updateMatrix();
      this.oceans.setMatrixAt(i, this.oceanDummy.matrix);
    }
    this.oceans.instanceMatrix.needsUpdate = true;
    this.oceanRingMat.uniforms.uTime.value = t;
    const ringFrac = vs.oceanWorlds > 64 ? Math.min(1, Math.log10(vs.oceanWorlds / 64) / Math.log10(6090 / 64)) : 0;
    this.oceanRingMat.uniforms.uCount.value = ringFrac;

    // ---- drones swarm around the active body; debris streams to the shell
    const anchor = vs.active ? this.anchorPos(vs.active) : null;
    const activeOrb = vs.active ? this.orbiters.get(BODY_ANCHOR[vs.active] ?? '') : undefined;
    const bodySize = vs.active === 'belt' ? 2.2 : activeOrb ? activeOrb.size * Math.max(0.35, Math.cbrt(1 - (vs.frac[vs.active!] ?? 0))) : 1;
    this.drones.update(dt, t, anchor, bodySize, vs.drones);
    if (anchor && vs.drones > 0) {
      const f = vs.frac[vs.active!] ?? 0;
      const rate = Math.min(220, 6 + Math.log10(1 + vs.drones) * 9) * (vs.shellBuilt ? 1 : 0.35);
      this.debris.emitStream(dt, rate * (0.4 + f), anchor, bodySize, vs.active === 'belt');
    }
    this.debris.update(t);

    // ---- probes
    if (vs.probesAuto > 0 && Math.random() < vs.probesAuto * dt) this.launchProbe();
    this.probes.update(dt);

    // ---- camera
    this.updateCamera(dt, vs);
    this.starMat.uniforms.uTime.value = t;

    this.composer.render(dt);
  }

  private updateCamera(dt: number, vs: ViewState) {
    const tx = this.targetOffX();
    if (Math.abs(tx - this.offX) > 0.5) {
      this.offX += (tx - this.offX) * (1 - Math.exp(-dt * 1.5));
      this.applyViewOffset();
    }
    const earth = this.orbiters.get('earth')!;
    let target = new THREE.Vector3();
    let d = 46, elev = 0.5, yaw = 0;
    this.autoYaw += dt * 0.012;
    switch (vs.framing) {
      case 'earth': {
        target.copy(earth.pos);
        d = 6.8;
        elev = 0.62;
        // Keep the Sun off to the side so Earth reads as half-lit.
        yaw = Math.atan2(earth.pos.z, earth.pos.x) + Math.PI * 0.62;
        break;
      }
      case 'inner':
        d = 50;
        elev = 0.52;
        yaw = this.autoYaw + 0.9;
        break;
      case 'outer':
        d = 98;
        elev = 0.55;
        yaw = this.autoYaw + 0.9;
        break;
      case 'all':
        d = 165;
        elev = 0.6;
        yaw = this.autoYaw + 0.9;
        break;
      case 'finale':
        d = 52;
        elev = 0.3;
        yaw = this.autoYaw + 0.9;
        break;
    }
    const k = 1 - Math.exp(-dt * (vs.framing === 'earth' ? 3 : 0.9));
    this.camTarget.lerp(target, k);
    if (vs.framing === 'earth') this.camTarget.copy(target);
    this.camDist = Math.exp(Math.log(this.camDist) + (Math.log(d * this.userZoom) - Math.log(this.camDist)) * (1 - Math.exp(-dt * 0.8)));
    this.camElev += (elev + this.userElev - this.camElev) * (1 - Math.exp(-dt * 1.2));
    // shortest-path yaw damping
    let dy = yaw + this.userYaw - this.camYaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.camYaw += dy * (1 - Math.exp(-dt * (vs.framing === 'earth' ? 4 : 1.0)));
    const ce = Math.cos(this.camElev), se = Math.sin(this.camElev);
    this.camera.position.set(
      this.camTarget.x + Math.cos(this.camYaw) * ce * this.camDist,
      this.camTarget.y + se * this.camDist,
      this.camTarget.z + Math.sin(this.camYaw) * ce * this.camDist,
    );
    this.camera.lookAt(this.camTarget);
  }

  /** Snap the camera to the framing (no swoop), e.g. when resuming a save. */
  snapCamera(vs: ViewState) {
    for (let i = 0; i < 400; i++) this.updateCamera(0.05, vs);
  }

  // ---------------------------------------------------------------- effects

  burst(bodyId: string) {
    const p = this.anchorPos(bodyId);
    const o = this.orbiters.get(BODY_ANCHOR[bodyId] ?? '');
    this.debris.burst(p, (o?.size ?? 1) * (bodyId === 'belt' ? 2.5 : 1));
  }

  /** Launch a probe streak; `from` defaults to the shell (or Earth before there is one). */
  launchProbe(dirSeed?: number) {
    const vs = this.lastFrame;
    const dir = new THREE.Vector3();
    if (dirSeed !== undefined) {
      const r = rng(1000 + dirSeed * 7919);
      const z = r() * 1.6 - 0.8, th = r() * Math.PI * 2, q = Math.sqrt(1 - z * z);
      dir.set(q * Math.cos(th), z, q * Math.sin(th));
    } else {
      const z = Math.random() * 1.6 - 0.8, th = Math.random() * Math.PI * 2, q = Math.sqrt(1 - z * z);
      dir.set(q * Math.cos(th), z, q * Math.sin(th));
    }
    const origin = new THREE.Vector3();
    if (vs && vs.shellBuilt && vs.completion > 0.0005) origin.copy(dir).multiplyScalar(SHELL_R * 1.01);
    else origin.copy(this.orbiters.get('earth')!.pos).addScaledVector(dir, 0.7);
    this.probes.launch(origin, dir, vs?.framing === 'earth' ? 0.25 : 1);
  }

  flashShell() {
    this.shellFlash = 1;
  }

  startFinale() {
    this.finaleT = this.time;
    this.shellFlash = 1.2;
    for (let i = 0; i < 40; i++) setTimeout(() => this.launchProbe(), 300 + i * 90 + Math.random() * 300);
  }

  /** Screen position (CSS px) of a body, for DOM labels. */
  screen(bodyId: string): { x: number; y: number; r: number; visible: boolean } {
    const p = bodyId === 'earth' ? this.orbiters.get('earth')!.pos.clone() : this.anchorPos(bodyId);
    const o = bodyId === 'earth' ? this.orbiters.get('earth') : this.orbiters.get(BODY_ANCHOR[bodyId] ?? '');
    const size = bodyId === 'belt' ? 1.5 : (o?.mesh.scale.x ?? 0.5);
    const v = p.clone().project(this.camera);
    const edge = p.clone().add(new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1).multiplyScalar(size)).project(this.camera);
    const x = (v.x * 0.5 + 0.5) * this.width;
    const y = (-v.y * 0.5 + 0.5) * this.height;
    const ey = (-edge.y * 0.5 + 0.5) * this.height;
    return { x, y, r: Math.abs(ey - y), visible: v.z < 1 && v.z > -1 };
  }

  dispose() {
    this.disposeInput();
    this.composer.dispose();
    this.bloom.dispose();
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}

// ==================================================================== particle systems

class DebrisSystem {
  readonly points: THREE.Points;
  private N = 3200;
  private a: Float32Array; // start xyz, ctrl xyz, end xyz
  private t0: Float32Array;
  private life: Float32Array;
  private kind: Uint8Array; // 0 stream, 1 burst
  private pos: Float32Array;
  private alpha: Float32Array;
  private head = 0;
  private acc = 0;
  private now = 0;
  private geom: THREE.BufferGeometry;
  private mat: THREE.ShaderMaterial;

  constructor(px: number) {
    const N = this.N;
    this.a = new Float32Array(N * 9);
    this.t0 = new Float32Array(N).fill(-1e9);
    this.life = new Float32Array(N).fill(1);
    this.kind = new Uint8Array(N);
    this.pos = new Float32Array(N * 3);
    this.alpha = new Float32Array(N);
    this.geom = new THREE.BufferGeometry();
    this.geom.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geom.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uPx: { value: px } },
      vertexShader: /* glsl */ `
        attribute float aAlpha; uniform float uPx; varying float vA;
        void main(){ vA = aAlpha; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = (aAlpha > 0.0 ? clamp(40.0/ -mv.z, 1.2, 3.0) : 0.0) * uPx; }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d)*vA; gl_FragColor = vec4(mix(vec3(1.0,0.45,0.15), vec3(1.0,0.85,0.55), vA)*a*1.6, a); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geom, this.mat);
    this.points.frustumCulled = false;
  }

  private spawn(start: THREE.Vector3, ctrl: THREE.Vector3, end: THREE.Vector3, life: number, kind: number) {
    const i = this.head;
    this.head = (this.head + 1) % this.N;
    this.a.set([start.x, start.y, start.z, ctrl.x, ctrl.y, ctrl.z, end.x, end.y, end.z], i * 9);
    this.t0[i] = this.now;
    this.life[i] = life;
    this.kind[i] = kind;
  }

  emitStream(dt: number, rate: number, from: THREE.Vector3, size: number, wide: boolean) {
    this.acc += dt * rate;
    const s = new THREE.Vector3(), c = new THREE.Vector3(), e = new THREE.Vector3(), j = new THREE.Vector3();
    while (this.acc >= 1) {
      this.acc -= 1;
      j.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.6, Math.random() - 0.5).normalize().multiplyScalar(size * (wide ? 3 : 1.05));
      s.copy(from).add(j);
      // land somewhere on the shell, biased toward the body's side
      e.copy(from).normalize().multiplyScalar(0.7).add(new THREE.Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 1.2, Math.random() - 0.5)).normalize().multiplyScalar(SHELL_R);
      c.copy(s).add(e).multiplyScalar(0.5);
      c.y += (Math.random() - 0.3) * 4;
      const tang = new THREE.Vector3(-from.z, 0, from.x).normalize().multiplyScalar((Math.random() - 0.2) * 5);
      c.add(tang);
      this.spawn(s, c, e, 2.6 + Math.random() * 2.2, 0);
    }
  }

  burst(at: THREE.Vector3, size: number) {
    const s = new THREE.Vector3(), c = new THREE.Vector3(), e = new THREE.Vector3();
    for (let i = 0; i < 420; i++) {
      const d = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      s.copy(at).addScaledVector(d, size * 0.5);
      e.copy(at).addScaledVector(d, size * (2 + Math.random() * 5));
      c.copy(s).lerp(e, 0.3);
      this.spawn(s, c, e, 1.2 + Math.random() * 1.8, 1);
    }
  }

  update(now: number) {
    this.now = now;
    const a = this.a;
    for (let i = 0; i < this.N; i++) {
      const u = (now - this.t0[i]) / this.life[i];
      if (u < 0 || u >= 1) {
        this.alpha[i] = 0;
        continue;
      }
      const k = this.kind[i] === 1 ? 1 - Math.pow(1 - u, 3) : u * u * (3 - 2 * u);
      const o = i * 9;
      const m = 1 - k;
      for (let d = 0; d < 3; d++) this.pos[i * 3 + d] = m * m * a[o + d] + 2 * m * k * a[o + 3 + d] + k * k * a[o + 6 + d];
      this.alpha[i] = this.kind[i] === 1 ? 1 - u : Math.min(1, u * 6) * (1 - Math.pow(u, 4));
    }
    this.geom.attributes.position.needsUpdate = true;
    this.geom.attributes.aAlpha.needsUpdate = true;
  }

  dispose() {
    this.geom.dispose();
    this.mat.dispose();
  }
}

class DroneCloud {
  readonly points: THREE.Points;
  private N = 320;
  private orbit: Float32Array; // radius factor, inclination, node, speed
  private pos: Float32Array;
  private alpha: Float32Array;
  private center = new THREE.Vector3();
  private haveCenter = false;
  private shown = 0;
  private geom: THREE.BufferGeometry;
  private mat: THREE.ShaderMaterial;

  constructor(px: number) {
    const N = this.N;
    const r = rng(91);
    this.orbit = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) this.orbit.set([1.25 + r() * 1.6, r() * Math.PI, r() * Math.PI * 2, (0.6 + r() * 1.4) * (r() < 0.5 ? -1 : 1)], i * 4);
    this.pos = new Float32Array(N * 3);
    this.alpha = new Float32Array(N);
    this.geom = new THREE.BufferGeometry();
    this.geom.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geom.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uPx: { value: px } },
      vertexShader: /* glsl */ `
        attribute float aAlpha; uniform float uPx; varying float vA;
        void main(){ vA = aAlpha; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_PointSize = (aAlpha > 0.0 ? 2.2 : 0.0) * uPx; }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d)*vA; gl_FragColor = vec4(vec3(0.55,0.95,1.0)*a*1.8, a); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geom, this.mat);
    this.points.frustumCulled = false;
  }

  update(dt: number, t: number, anchor: THREE.Vector3 | null, size: number, drones: number) {
    const want = anchor ? Math.min(this.N, drones < 60 ? drones : 60 + Math.log10(drones / 60 + 1) * 70) : 0;
    this.shown += (want - this.shown) * Math.min(1, dt * 2);
    if (anchor) {
      if (!this.haveCenter) this.center.copy(anchor);
      this.center.lerp(anchor, 1 - Math.exp(-dt * 2.5));
      this.haveCenter = true;
    }
    const n = Math.round(this.shown);
    for (let i = 0; i < this.N; i++) {
      if (i >= n) {
        this.alpha[i] = 0;
        continue;
      }
      const [rf, inc, node, sp] = [this.orbit[i * 4], this.orbit[i * 4 + 1], this.orbit[i * 4 + 2], this.orbit[i * 4 + 3]];
      const R = rf * size;
      const a = node * 3 + t * sp * 1.4;
      let x = Math.cos(a) * R, y = 0, z = Math.sin(a) * R;
      y = -z * Math.sin(inc);
      z = z * Math.cos(inc);
      const cn = Math.cos(node), sn = Math.sin(node);
      const xx = x * cn - z * sn, zz = x * sn + z * cn;
      x = xx;
      z = zz;
      this.pos[i * 3] = this.center.x + x;
      this.pos[i * 3 + 1] = this.center.y + y;
      this.pos[i * 3 + 2] = this.center.z + z;
      this.alpha[i] = 0.55 + 0.45 * Math.sin(t * 5 + i);
    }
    this.geom.attributes.position.needsUpdate = true;
    this.geom.attributes.aAlpha.needsUpdate = true;
  }

  dispose() {
    this.geom.dispose();
    this.mat.dispose();
  }
}

class ProbeStreaks {
  readonly lines: THREE.LineSegments;
  readonly heads: THREE.Points;
  private N = 96;
  private origin: Float32Array;
  private dir: Float32Array;
  private t: Float32Array;
  private scale: Float32Array;
  private lpos: Float32Array;
  private lcol: Float32Array;
  private hpos: Float32Array;
  private halpha: Float32Array;
  private head = 0;
  private lgeom: THREE.BufferGeometry;
  private hgeom: THREE.BufferGeometry;
  private lmat: THREE.LineBasicMaterial;
  private hmat: THREE.ShaderMaterial;

  constructor(px: number) {
    const N = this.N;
    this.origin = new Float32Array(N * 3);
    this.dir = new Float32Array(N * 3);
    this.t = new Float32Array(N).fill(99);
    this.scale = new Float32Array(N).fill(1);
    this.lpos = new Float32Array(N * 6);
    this.lcol = new Float32Array(N * 6);
    this.hpos = new Float32Array(N * 3);
    this.halpha = new Float32Array(N);
    this.lgeom = new THREE.BufferGeometry();
    this.lgeom.setAttribute('position', new THREE.BufferAttribute(this.lpos, 3).setUsage(THREE.DynamicDrawUsage));
    this.lgeom.setAttribute('color', new THREE.BufferAttribute(this.lcol, 3).setUsage(THREE.DynamicDrawUsage));
    this.lmat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.lines = new THREE.LineSegments(this.lgeom, this.lmat);
    this.lines.frustumCulled = false;
    this.hgeom = new THREE.BufferGeometry();
    this.hgeom.setAttribute('position', new THREE.BufferAttribute(this.hpos, 3).setUsage(THREE.DynamicDrawUsage));
    this.hgeom.setAttribute('aAlpha', new THREE.BufferAttribute(this.halpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.hmat = new THREE.ShaderMaterial({
      uniforms: { uPx: { value: px } },
      vertexShader: /* glsl */ `
        attribute float aAlpha; uniform float uPx; varying float vA;
        void main(){ vA = aAlpha; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_PointSize = (aAlpha > 0.0 ? 5.0 : 0.0)*uPx; }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main(){ float d = length(gl_PointCoord-0.5); float a = pow(smoothstep(0.5,0.0,d),1.5)*vA; gl_FragColor = vec4(vec3(0.7,1.0,1.0)*a*2.5, a); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.heads = new THREE.Points(this.hgeom, this.hmat);
    this.heads.frustumCulled = false;
  }

  launch(origin: THREE.Vector3, dir: THREE.Vector3, scale = 1) {
    const i = this.head;
    this.head = (this.head + 1) % this.N;
    this.origin.set([origin.x, origin.y, origin.z], i * 3);
    this.dir.set([dir.x, dir.y, dir.z], i * 3);
    this.t[i] = 0;
    this.scale[i] = scale;
  }

  update(dt: number) {
    for (let i = 0; i < this.N; i++) {
      this.t[i] += dt;
      const t = this.t[i];
      const life = 3.2;
      const o = i * 3;
      if (t >= life) {
        this.halpha[i] = 0;
        this.lcol.fill(0, i * 6, i * 6 + 6);
        continue;
      }
      const sc = this.scale[i];
      const s = (1.5 * t + 9 * t * t) * sc;
      const len = Math.min(s, (2 + 10 * t) * sc);
      const fade = t < 0.1 ? t / 0.1 : 1 - Math.pow(t / life, 2);
      for (let d = 0; d < 3; d++) {
        const hp = this.origin[o + d] + this.dir[o + d] * s;
        this.hpos[o + d] = hp;
        this.lpos[i * 6 + d] = hp;
        this.lpos[i * 6 + 3 + d] = hp - this.dir[o + d] * len;
      }
      this.halpha[i] = fade;
      this.lcol.set([0.6 * fade, 1.0 * fade, 1.0 * fade, 0, 0, 0], i * 6);
    }
    this.lgeom.attributes.position.needsUpdate = true;
    this.lgeom.attributes.color.needsUpdate = true;
    this.hgeom.attributes.position.needsUpdate = true;
    this.hgeom.attributes.aAlpha.needsUpdate = true;
  }

  dispose() {
    this.lgeom.dispose();
    this.hgeom.dispose();
    this.lmat.dispose();
    this.hmat.dispose();
  }
}
