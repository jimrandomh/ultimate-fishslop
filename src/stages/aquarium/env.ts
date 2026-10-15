// The tank: sand, glass, water surface, light shafts, decor, bubbles and drifting motes.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const TANK = { minX: -22, maxX: 22, minY: 0, maxY: 17, minZ: -13, maxZ: 13 };

/** Height of the sand at (x, z). Shared by the mesh and by things that rest on it. */
export function sandHeight(x: number, z: number): number {
  let h =
    0.35 * Math.sin(x * 0.31 + z * 0.12) +
    0.22 * Math.sin(z * 0.47 - x * 0.19 + 1.3) +
    0.1 * Math.sin((x + z) * 0.93) +
    0.06 * Math.sin(x * 2.1 - z * 1.7);
  // Sand banks up against the back glass.
  const back = Math.max(0, (-z - 6) / 7);
  h += back * back * 2.2;
  return h + 0.4;
}

// ------------------------------------------------------------------ shared shader bits

export const causticsGLSL = /* glsl */ `
  vec2 cHash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }
  // Distance between nearest and second-nearest animated cell points: ~0 on cell borders.
  float cEdge(vec2 x, float t) {
    vec2 n = floor(x);
    vec2 f = fract(x);
    float f1 = 8.0, f2 = 8.0;
    for (int j = -1; j <= 1; j++)
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 o = cHash2(n + g);
        o = 0.5 + 0.45 * sin(t + 6.2831 * o);
        float d = length(g + o - f);
        if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
      }
    return f2 - f1;
  }
  float caustics(vec2 p, float t) {
    float a = cEdge(p, t * 0.9);
    float b = cEdge(p * 1.63 + vec2(3.1, 7.7), t * 1.21 + 2.0);
    return smoothstep(0.16, 0.0, a) * 0.9 + smoothstep(0.12, 0.0, b) * 0.55;
  }
`;

export interface CausticUniforms {
  uTime: { value: number };
}

/** Adds animated caustic light to a standard material, projected from above in world space. */
export function addCaustics(mat: THREE.MeshStandardMaterial, shared: CausticUniforms, strength = 0.6, color = new THREE.Color(0.75, 0.95, 1.0)) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.uniforms.uCausticStrength = { value: strength };
    shader.uniforms.uCausticColor = { value: color };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCausticPos;\nvarying vec3 vCausticNormal;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 cWorld = vec4(transformed, 1.0);
        vec3 cN = objectNormal;
        #ifdef USE_INSTANCING
          cWorld = instanceMatrix * cWorld;
          cN = mat3(instanceMatrix) * cN;
        #endif
        cWorld = modelMatrix * cWorld;
        vCausticPos = cWorld.xyz;
        vCausticNormal = normalize(mat3(modelMatrix) * cN);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uCausticStrength;
        uniform vec3 uCausticColor;
        varying vec3 vCausticPos;
        varying vec3 vCausticNormal;
        ${causticsGLSL}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float cUp = clamp(vCausticNormal.y * 0.8 + 0.35, 0.0, 1.0);
        float cDepth = clamp(1.0 - (17.0 - vCausticPos.y) / 30.0, 0.35, 1.0);
        totalEmissiveRadiance += uCausticColor * caustics(vCausticPos.xz * 0.21, uTime * 0.8) * uCausticStrength * cUp * cDepth * diffuseColor.rgb * 1.6;`,
      );
  };
  mat.customProgramCacheKey = () => `caustics-${strength}`;
}

// ------------------------------------------------------------------ environment

export class TankEnvironment {
  readonly group = new THREE.Group();
  readonly uniforms: CausticUniforms = { uTime: { value: 0 } };
  /** Spheres that the sub and fish should avoid: [x, y, z, r]. */
  readonly obstacles: THREE.Vector4[] = [];
  /** Where the treasure-chest bubbler sits. */
  readonly bubbler = new THREE.Vector3(9, 0, -5);
  private rays: THREE.Mesh[] = [];
  private surfaceMat!: THREE.ShaderMaterial;
  private chestLid!: THREE.Object3D;
  readonly bubbles: Bubbles;
  private motes!: THREE.Points;
  private time = 0;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    this.buildLights();
    this.buildBackdrop();
    this.buildSand();
    this.buildGlass();
    this.buildSurface();
    this.buildRays();
    this.buildRocks();
    this.buildWeeds();
    this.buildCoral();
    this.buildCastle();
    this.buildChest();
    this.buildMotes();
    this.bubbles = new Bubbles(1200);
    this.group.add(this.bubbles.points);
  }

  private buildLights() {
    const hemi = new THREE.HemisphereLight(0xbff3ff, 0x24505e, 1.05);
    this.group.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d8, 2.6);
    sun.position.set(6, 30, 8);
    sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = sun.shadow.camera as THREE.OrthographicCamera;
    s.left = -26;
    s.right = 26;
    s.top = 18;
    s.bottom = -18;
    s.near = 5;
    s.far = 50;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.04;
    sun.shadow.radius = 4;
    this.group.add(sun, sun.target);
    const fill = new THREE.DirectionalLight(0x6fd6ff, 0.5);
    fill.position.set(-10, 6, 14);
    this.group.add(fill);
  }

  private buildBackdrop() {
    // Big gradient sphere: what you see through the glass/fog in the distance.
    const geo = new THREE.SphereGeometry(120, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {},
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          float y = vDir.y;
          vec3 deep = vec3(0.01, 0.10, 0.20);
          vec3 mid = vec3(0.03, 0.30, 0.45);
          vec3 top = vec3(0.30, 0.74, 0.86);
          vec3 c = mix(deep, mid, smoothstep(-0.6, 0.1, y));
          c = mix(c, top, smoothstep(0.1, 0.8, y));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const sky = new THREE.Mesh(geo, mat);
    sky.renderOrder = -10;
    this.group.add(sky);
  }

  private buildSand() {
    const w = TANK.maxX - TANK.minX;
    const d = TANK.maxZ - TANK.minZ;
    const geo = new THREE.PlaneGeometry(w + 0.2, d + 0.2, 160, 96);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const base = new THREE.Color(0xe8d2a6);
    const dark = new THREE.Color(0xc2a274);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const grain = Math.sin(x * 13.1 + z * 7.3) * Math.sin(z * 11.7 - x * 3.1);
      pos.setY(i, sandHeight(x, z) + grain * 0.015);
      const t = 0.5 + 0.5 * Math.sin(x * 0.7 + Math.sin(z * 0.9) * 2) * Math.sin(z * 0.4);
      c.copy(base).lerp(dark, t * 0.5 + (grain * 0.5 + 0.5) * 0.15);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    addCaustics(mat, this.uniforms, 0.85);
    const sand = new THREE.Mesh(geo, mat);
    sand.receiveShadow = true;
    this.group.add(sand);

    // Pebbles scattered on the sand.
    const pebbleGeo = new THREE.IcosahedronGeometry(0.18, 0);
    const pebbleMat = new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true });
    addCaustics(pebbleMat, this.uniforms, 0.5);
    const n = 260;
    const pebbles = new THREE.InstancedMesh(pebbleGeo, pebbleMat, n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const palette = [0x8d8a85, 0xb59a7a, 0x6e7f86, 0xd9c7a8, 0x5a5f66, 0xa3644a];
    for (let i = 0; i < n; i++) {
      const x = THREE.MathUtils.randFloat(TANK.minX + 0.5, TANK.maxX - 0.5);
      const z = THREE.MathUtils.randFloat(TANK.minZ + 0.5, TANK.maxZ - 0.5);
      const s = THREE.MathUtils.randFloat(0.4, 1.4);
      q.setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3));
      m.compose(new THREE.Vector3(x, sandHeight(x, z) + 0.05, z), q, new THREE.Vector3(s, s * 0.6, s));
      pebbles.setMatrixAt(i, m);
      pebbles.setColorAt(i, new THREE.Color(palette[i % palette.length]));
    }
    pebbles.receiveShadow = true;
    this.group.add(pebbles);
  }

  private buildGlass() {
    const { minX, maxX, minY, maxY, minZ, maxZ } = TANK;
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x9fe8ff,
      transparent: true,
      opacity: 0.08,
      roughness: 0.05,
      metalness: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const H = maxY - minY + 1.5;
    const walls: [number, number, number, number, number][] = [
      // w, x, z, rotY
      [maxX - minX, 0, minZ, 0, 0],
      [maxX - minX, 0, maxZ, Math.PI, 0],
      [maxZ - minZ, minX, 0, Math.PI / 2, 0],
      [maxZ - minZ, maxX, 0, -Math.PI / 2, 0],
    ];
    for (const [w, x, z, ry] of walls) {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(w, H), glassMat);
      g.position.set(x, minY + H / 2 - 0.5, z);
      g.rotation.y = ry;
      this.group.add(g);
    }
    // Black frame + silicone seams along the edges.
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0b1418, roughness: 0.4, metalness: 0.6 });
    const t = 0.35;
    const beams: THREE.BufferGeometry[] = [];
    const add = (sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
      const b = new THREE.BoxGeometry(sx, sy, sz);
      b.translate(x, y, z);
      beams.push(b);
    };
    for (const x of [minX, maxX]) for (const z of [minZ, maxZ]) add(t, H + 1, t, x, minY + H / 2 - 0.5, z);
    for (const y of [minY - 0.4, maxY + 1.4]) {
      for (const z of [minZ, maxZ]) add(maxX - minX + t, t * 1.6, t, 0, y, z);
      for (const x of [minX, maxX]) add(t, t * 1.6, maxZ - minZ + t, x, y, 0);
    }
    this.group.add(new THREE.Mesh(mergeGeometries(beams), frameMat));
  }

  private buildSurface() {
    const geo = new THREE.PlaneGeometry(TANK.maxX - TANK.minX, TANK.maxZ - TANK.minZ, 1, 1);
    geo.rotateX(Math.PI / 2); // face down
    this.surfaceMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uTime: this.uniforms.uTime },
      vertexShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          vPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * viewMatrix * vec4(vPos, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vPos;
        ${causticsGLSL}
        void main() {
          float c = caustics(vPos.xz * 0.13, uTime * 0.6);
          vec3 base = vec3(0.55, 0.92, 0.98);
          vec3 col = base * (0.55 + 0.6 * c);
          float a = 0.55 + 0.35 * c;
          gl_FragColor = vec4(col, a);
          #include <colorspace_fragment>
        }`,
    });
    const surf = new THREE.Mesh(geo, this.surfaceMat);
    surf.position.y = TANK.maxY + 0.6;
    this.group.add(surf);
  }

  private buildRays() {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: this.uniforms.uTime, uPhase: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying float vFres;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vec3 n = normalize(mat3(modelMatrix) * normal);
          vec3 v = normalize(cameraPosition - wp.xyz);
          vFres = pow(abs(dot(n, v)), 2.0);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uPhase;
        varying vec2 vUv;
        varying float vFres;
        void main() {
          float fade = smoothstep(0.0, 0.85, vUv.y) * smoothstep(1.0, 0.92, vUv.y);
          float flicker = 0.65 + 0.35 * sin(uTime * 0.7 + uPhase) * sin(uTime * 0.31 + uPhase * 2.0);
          float a = fade * vFres * flicker * 0.085;
          gl_FragColor = vec4(vec3(0.85, 1.0, 0.95) * a, 1.0);
        }`,
    });
    for (let i = 0; i < 9; i++) {
      const r = THREE.MathUtils.randFloat(1.2, 2.6);
      const h = 22;
      const geo = new THREE.CylinderGeometry(r * 0.55, r * 1.6, h, 24, 1, true);
      geo.translate(0, -h / 2, 0);
      const m = mat.clone();
      m.uniforms.uTime = this.uniforms.uTime;
      m.uniforms.uPhase = { value: Math.random() * 10 };
      const ray = new THREE.Mesh(geo, m);
      ray.position.set(THREE.MathUtils.randFloat(-18, 18), TANK.maxY + 1.5, THREE.MathUtils.randFloat(-10, 10));
      ray.rotation.z = THREE.MathUtils.randFloat(-0.25, -0.12);
      ray.rotation.x = THREE.MathUtils.randFloat(-0.12, 0.12);
      ray.userData.base = ray.rotation.z;
      ray.userData.phase = Math.random() * 10;
      ray.renderOrder = 5;
      this.rays.push(ray);
      this.group.add(ray);
    }
  }

  private rock(x: number, z: number, r: number, squash = 0.7, color = 0x7a8288) {
    const geo = new THREE.IcosahedronGeometry(r, 3);
    const p = geo.attributes.position as THREE.BufferAttribute;
    const seed = Math.random() * 100;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
      const n =
        1 +
        0.18 * Math.sin(v.x * 2.1 + seed) * Math.cos(v.y * 1.7 + seed) +
        0.12 * Math.sin(v.z * 3.3 - seed) +
        0.06 * Math.sin(v.x * 7.0 + v.z * 5.0);
      v.multiplyScalar(n);
      v.y *= squash;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true });
    addCaustics(mat, this.uniforms, 0.7);
    const mesh = new THREE.Mesh(geo, mat);
    const y = sandHeight(x, z) + r * squash * 0.35;
    mesh.position.set(x, y, z);
    mesh.rotation.y = Math.random() * Math.PI;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.obstacles.push(new THREE.Vector4(x, y, z, r * 0.95));
    return mesh;
  }

  private buildRocks() {
    this.rock(-15, -8, 3.2, 0.75, 0x6f7a80);
    this.rock(-12.5, -9.5, 2.0, 0.8, 0x7d878c);
    this.rock(16, 7, 2.2, 0.6, 0x847a70);
    this.rock(-4, -10, 1.8, 0.7, 0x707b85);
    this.rock(4, 9.5, 1.3, 0.6, 0x8a8078);
    this.rock(-18, 8, 1.6, 0.7, 0x76808a);
    this.rock(18.5, -9, 2.6, 0.9, 0x6c757c);
  }

  private buildWeeds() {
    const strands: THREE.BufferGeometry[] = [];
    const clusters: [number, number, number][] = [
      [-17, -4, 14],
      [-8, -9, 10],
      [12, -10, 12],
      [19, 2, 9],
      [-19, 3, 8],
      [2, -11, 8],
      [7, 6, 6],
      [-10, 9, 7],
    ];
    for (const [cx, cz, n] of clusters) {
      for (let i = 0; i < n; i++) {
        const x = cx + THREE.MathUtils.randFloatSpread(3.2);
        const z = cz + THREE.MathUtils.randFloatSpread(2.4);
        const h = THREE.MathUtils.randFloat(4, 11);
        const w = THREE.MathUtils.randFloat(0.25, 0.5);
        const g = new THREE.PlaneGeometry(w, h, 1, 18);
        // Taper toward the tip and give a slight leaf ripple.
        const p = g.attributes.position as THREE.BufferAttribute;
        for (let k = 0; k < p.count; k++) {
          const t = (p.getY(k) + h / 2) / h;
          p.setX(k, p.getX(k) * (1 - t * 0.75) * (1 + 0.3 * Math.sin(t * 20)));
        }
        g.translate(0, h / 2, 0);
        g.rotateY(Math.random() * Math.PI);
        const phase = Math.random() * 6.28;
        const ph = new Float32Array(p.count).fill(phase);
        g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
        g.translate(x, sandHeight(x, z) - 0.1, z);
        strands.push(g);
      }
    }
    const geo = mergeGeometries(strands);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3f9a4a, roughness: 0.7, side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uniforms.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aPhase;\nvarying float vH;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float baseY = 0.0;
          float hgt = max(0.0, position.y - 0.0);
          float sway = pow(hgt / 10.0, 1.6);
          transformed.x += sin(uTime * 0.9 + aPhase + position.y * 0.35) * sway * 1.4;
          transformed.z += cos(uTime * 0.7 + aPhase * 1.3 + position.y * 0.3) * sway * 0.9;
          vH = hgt;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vH;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          diffuseColor.rgb = mix(vec3(0.10, 0.32, 0.16), vec3(0.45, 0.85, 0.35), clamp(vH / 10.0, 0.0, 1.0));`,
        );
    };
    const weeds = new THREE.Mesh(geo, mat);
    weeds.castShadow = true;
    this.group.add(weeds);
  }

  private buildCoral() {
    const coralMat = (color: number) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.65 });
      addCaustics(m, this.uniforms, 0.6);
      return m;
    };
    // Branching coral: recursive tapered cylinders.
    const branchy = (x: number, z: number, color: number, scale = 1) => {
      const parts: THREE.BufferGeometry[] = [];
      const grow = (start: THREE.Vector3, dir: THREE.Vector3, len: number, r: number, depth: number) => {
        const end = start.clone().addScaledVector(dir, len);
        const g = new THREE.CylinderGeometry(r * 0.72, r, len, 7, 1);
        g.translate(0, len / 2, 0);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        g.applyQuaternion(q);
        g.translate(start.x, start.y, start.z);
        parts.push(g);
        const tip = new THREE.SphereGeometry(r * 0.74, 7, 5);
        tip.translate(end.x, end.y, end.z);
        parts.push(tip);
        if (depth <= 0) return;
        const kids = Math.random() < 0.35 ? 3 : 2;
        for (let i = 0; i < kids; i++) {
          const a = (i / kids) * Math.PI * 2 + Math.random();
          const nd = dir
            .clone()
            .multiplyScalar(0.9)
            .add(new THREE.Vector3(Math.cos(a) * 0.75, THREE.MathUtils.randFloat(0.1, 0.45), Math.sin(a) * 0.75))
            .normalize();
          grow(end, nd, len * THREE.MathUtils.randFloat(0.68, 0.86), r * 0.74, depth - 1);
        }
      };
      // A few trunks from the base, each branching four times.
      for (let t = 0; t < 3; t++) {
        const a = (t / 3) * Math.PI * 2 + Math.random();
        const d0 = new THREE.Vector3(Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35).normalize();
        grow(new THREE.Vector3(Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2), d0, 0.9 * scale, 0.2 * scale, 4);
      }
      const mesh = new THREE.Mesh(mergeGeometries(parts), coralMat(color));
      mesh.position.set(x, sandHeight(x, z) - 0.1, z);
      mesh.castShadow = true;
      this.group.add(mesh);
      this.obstacles.push(new THREE.Vector4(x, sandHeight(x, z) + 1.5 * scale, z, 1.6 * scale));
    };
    branchy(-6, -6, 0xff7b54, 1.1);
    branchy(14, -3, 0xb06ef0, 0.9);
    branchy(-14, 5, 0xff5e8a, 0.8);
    branchy(5, -9, 0xffa94d, 1.0);

    // Brain coral: bumpy hemisphere.
    const brain = (x: number, z: number, r: number, color: number) => {
      const g = new THREE.SphereGeometry(r, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
        const wig = Math.sin(v.x * 9 + Math.sin(v.z * 7) * 2) * Math.sin(v.z * 9 + Math.sin(v.y * 6));
        v.multiplyScalar(1 + wig * 0.035);
        p.setXYZ(i, v.x, v.y, v.z);
      }
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, coralMat(color));
      mesh.scale.y = 0.75;
      mesh.position.set(x, sandHeight(x, z) - 0.15, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.obstacles.push(new THREE.Vector4(x, sandHeight(x, z), z, r));
    };
    brain(-1, -7, 1.6, 0xf2a7b8);
    brain(11, 9, 1.2, 0xc9e27a);
    brain(-17, 10.5, 1.0, 0xffc56e);

    // Tube sponges.
    const tubes = (x: number, z: number, color: number) => {
      const parts: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 5; i++) {
        const h = THREE.MathUtils.randFloat(1.2, 3.2);
        const r = THREE.MathUtils.randFloat(0.22, 0.36);
        const g = new THREE.CylinderGeometry(r, r * 0.8, h, 12, 1, true);
        g.translate(THREE.MathUtils.randFloatSpread(1.1), h / 2, THREE.MathUtils.randFloatSpread(1.1));
        parts.push(g);
      }
      const m = coralMat(color);
      m.side = THREE.DoubleSide;
      const mesh = new THREE.Mesh(mergeGeometries(parts), m);
      mesh.position.set(x, sandHeight(x, z) - 0.1, z);
      mesh.castShadow = true;
      this.group.add(mesh);
      this.obstacles.push(new THREE.Vector4(x, sandHeight(x, z) + 1, z, 1.1));
    };
    tubes(17, -6, 0x9b5de5);
    tubes(-9, -10.5, 0x00bbf9);
  }

  private buildCastle() {
    const x = -2;
    const z = 3.5;
    const y0 = sandHeight(x, z) - 0.2;
    const stone = new THREE.MeshStandardMaterial({ color: 0xc9b9a6, roughness: 0.85 });
    addCaustics(stone, this.uniforms, 0.7);
    const roof = new THREE.MeshStandardMaterial({ color: 0x5b7fd6, roughness: 0.6 });
    addCaustics(roof, this.uniforms, 0.5);
    const g = new THREE.Group();
    const parts: THREE.BufferGeometry[] = [];
    const roofs: THREE.BufferGeometry[] = [];
    const tower = (tx: number, tz: number, h: number, r: number) => {
      const c = new THREE.CylinderGeometry(r, r * 1.05, h, 14);
      c.translate(tx, h / 2, tz);
      parts.push(c);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const b = new THREE.BoxGeometry(r * 0.38, r * 0.4, r * 0.38);
        b.translate(tx + Math.cos(a) * r * 0.9, h + r * 0.2, tz + Math.sin(a) * r * 0.9);
        parts.push(b);
      }
      const cone = new THREE.ConeGeometry(r * 1.05, r * 2.2, 14);
      cone.translate(tx, h + r * 1.4, tz);
      roofs.push(cone);
    };
    tower(-1.6, 0, 3.2, 0.75);
    tower(1.6, 0, 3.2, 0.75);
    tower(0, -1.2, 4.6, 0.95);
    const wall = new THREE.BoxGeometry(3.2, 2.2, 1.2);
    wall.translate(0, 1.1, 0.1);
    parts.push(wall);
    for (let i = 0; i < 5; i++) {
      const b = new THREE.BoxGeometry(0.36, 0.4, 0.36);
      b.translate(-1.3 + i * 0.65, 2.4, 0.55);
      parts.push(b);
    }
    const body = new THREE.Mesh(mergeGeometries(parts), stone);
    const roofMesh = new THREE.Mesh(mergeGeometries(roofs), roof);
    // Dark arched doorway.
    const door = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 20, 0, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0x0a1418 }),
    );
    door.position.set(0, 0.8, 0.71);
    const doorRect = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), door.material);
    doorRect.position.set(0, 0.4, 0.71);
    // Little flag.
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.45), new THREE.MeshStandardMaterial({ color: 0xff5e5b, side: THREE.DoubleSide }));
    flag.position.set(0.4, 7.2, -1.2);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2), stone);
    pole.position.set(0, 6.9, -1.2);
    g.add(body, roofMesh, door, doorRect, flag, pole);
    for (const m of [body, roofMesh]) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
    g.position.set(x, y0, z);
    g.scale.setScalar(1.25);
    g.rotation.y = -0.35;
    this.group.add(g);
    this.obstacles.push(new THREE.Vector4(x, y0 + 2, z, 3.2), new THREE.Vector4(x, y0 + 5, z - 1, 1.6));
  }

  private buildChest() {
    const { x, z } = this.bubbler;
    const y0 = sandHeight(x, z) - 0.1;
    this.bubbler.y = y0 + 1.1;
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.8 });
    addCaustics(wood, this.uniforms, 0.6);
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc94a, roughness: 0.3, metalness: 0.8, emissive: 0x3a2800 });
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1.3), wood);
    base.position.y = 0.5;
    const band1 = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.15, 1.35), gold);
    band1.position.y = 0.95;
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 1, -0.65);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 2, 16, 1, false, 0, Math.PI), wood);
    lid.rotation.z = Math.PI / 2;
    lid.rotation.y = Math.PI / 2;
    lid.position.set(0, 0, 0.65);
    lidPivot.add(lid);
    // Glowing treasure inside.
    const loot = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
    loot.position.y = 0.95;
    loot.scale.set(1.6, 0.4, 1);
    g.add(base, band1, lidPivot, loot);
    g.traverse((o) => (o.castShadow = true));
    g.position.set(x, y0, z);
    g.rotation.y = -0.6;
    this.chestLid = lidPivot;
    this.group.add(g);
    this.obstacles.push(new THREE.Vector4(x, y0 + 0.6, z, 1.4));
  }

  private buildMotes() {
    const n = 700;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = THREE.MathUtils.randFloat(TANK.minX, TANK.maxX);
      pos[i * 3 + 1] = THREE.MathUtils.randFloat(TANK.minY, TANK.maxY);
      pos[i * 3 + 2] = THREE.MathUtils.randFloat(TANK.minZ, TANK.maxZ);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: this.uniforms.uTime },
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying float vA;
        void main() {
          vec3 p = position;
          float s = fract(sin(dot(p.xz, vec2(12.9898, 78.233))) * 43758.5453);
          p.x += sin(uTime * 0.2 + s * 30.0) * 0.6;
          p.y += sin(uTime * 0.15 + s * 20.0) * 0.5;
          p.z += cos(uTime * 0.18 + s * 10.0) * 0.6;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (1.2 + s * 2.2) * 40.0 / -mv.z;
          vA = 0.25 + 0.35 * s;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vA;
          gl_FragColor = vec4(vec3(0.85, 1.0, 0.95) * a, 1.0);
        }`,
    });
    this.motes = new THREE.Points(geo, mat);
    this.group.add(this.motes);
  }

  update(dt: number) {
    this.time += dt;
    this.uniforms.uTime.value = this.time;
    for (const r of this.rays) {
      r.rotation.z = r.userData.base + Math.sin(this.time * 0.25 + r.userData.phase) * 0.04;
    }
    // Chest lid breathes open and burps a column of bubbles.
    const cycle = (this.time % 9) / 9;
    const open = cycle > 0.7 ? Math.sin(((cycle - 0.7) / 0.3) * Math.PI) : 0;
    this.chestLid.rotation.x = -open * 0.9;
    if (open > 0.3 && Math.random() < 0.6) {
      this.bubbles.emit(this.bubbler, 2, 0.5, 0.18 + Math.random() * 0.12);
    } else if (Math.random() < 0.06) {
      this.bubbles.emit(this.bubbler, 1, 0.2, 0.08);
    }
    this.bubbles.update(dt);
  }
}

// ------------------------------------------------------------------ bubbles

export class Bubbles {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private size: Float32Array;
  private life: Float32Array;
  private next = 0;

  constructor(private max: number) {
    this.pos = new Float32Array(max * 3).fill(-999);
    this.vel = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.life = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute float aSize;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * 300.0 / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          float rim = smoothstep(0.32, 0.5, d) * smoothstep(0.5, 0.45, d);
          float hi = smoothstep(0.16, 0.0, length(c - vec2(-0.16, -0.16)));
          float a = rim * 0.75 + hi * 0.9 + 0.06;
          gl_FragColor = vec4(vec3(0.9, 1.0, 1.0), a);
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
  }

  emit(at: THREE.Vector3, count: number, spread = 0.3, size = 0.12) {
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.max;
      this.pos[i * 3] = at.x + (Math.random() - 0.5) * spread;
      this.pos[i * 3 + 1] = at.y + (Math.random() - 0.5) * spread;
      this.pos[i * 3 + 2] = at.z + (Math.random() - 0.5) * spread;
      this.vel[i * 3] = (Math.random() - 0.5) * 0.4;
      this.vel[i * 3 + 1] = 1.6 + Math.random() * 1.4;
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
      this.size[i] = size * (0.6 + Math.random() * 0.8);
      this.life[i] = Math.random() * 10;
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.max; i++) {
      if (this.pos[i * 3 + 1] < -500) continue;
      this.life[i] += dt;
      const wob = Math.sin(this.life[i] * 7) * 0.6;
      this.pos[i * 3] += (this.vel[i * 3] + wob) * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += (this.vel[i * 3 + 2] + Math.cos(this.life[i] * 5) * 0.4) * dt;
      if (this.pos[i * 3 + 1] > TANK.maxY + 0.5) {
        this.pos[i * 3 + 1] = -999;
        this.size[i] = 0;
      }
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
  }
}
