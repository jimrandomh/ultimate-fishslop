// GLSL for the Earth stage. All globe lighting is done in object space (sun and camera are
// transformed into the globe's frame on the CPU each frame), so the textures never swim.

export const MAX_WAVES = 8;

const NOISE = /* glsl */ `
float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3(1, 0, 0)), f.x), mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x), mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
`;

export const globeVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vP;
void main() {
  vUv = uv;
  vN = normal;
  vP = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const globeFrag = /* glsl */ `
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform sampler2D uData;
uniform vec3 uSun;      // object space, normalized
uniform vec3 uCam;      // object space camera position
uniform float uSea;     // metres
uniform float uMelt;    // 0..1
uniform float uAlgae;   // 0..1
uniform float uLights;  // 0..1
uniform float uTime;
uniform vec2 uTexel;
uniform float uRelief;
uniform vec4 uWaves[${MAX_WAVES}];   // xyz dir, w age (s); w < 0 = off
uniform vec4 uWaveP[${MAX_WAVES}];   // x max angle, y duration, z ring intensity, w flash
uniform vec3 uWaveC[${MAX_WAVES}];   // colour

varying vec2 vUv;
varying vec3 vN;
varying vec3 vP;

${NOISE}

const float G_TOP = 243.0;
const float EVEREST = 8849.0;
const float H_POW = 1.083;
float elevOf(float x) { return EVEREST * pow(max(x, 0.0) / G_TOP, H_POW); }

void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(uCam - vP);
  vec3 L = normalize(uSun);
  float ndl = dot(N, L);

  vec4 data = texture2D(uData, vUv);
  vec3 dayCol = texture2D(uDay, vUv).rgb;
  vec3 nightTex = texture2D(uNight, vUv).rgb;

  // ---- elevation, ice and flooding (mirrors terrain.ts)
  float dither = vnoise(N * 330.0);
  float g = data.r * 255.0;
  float elev = elevOf(g + dither);
  float ice = step(0.5, data.b);
  float thr = data.a;
  float melted = ice * smoothstep(thr - 0.015, thr + 0.015, uMelt);
  elev = mix(elev, -400.0, melted);

  float ocean = smoothstep(0.42, 0.58, data.g);
  float depth = uSea - elev;
  float aa = fwidth(depth) * 0.8 + 0.5;
  float flood = smoothstep(-aa, aa, depth) * (1.0 - ocean);
  float wet = clamp(ocean + flood, 0.0, 1.0);

  // ---- relief (bump from neighbouring elevations), land only
  float gE = texture2D(uData, vUv + vec2(uTexel.x, 0.0)).r * 255.0;
  float gN = texture2D(uData, vUv + vec2(0.0, uTexel.y)).r * 255.0;
  vec3 east = normalize(vec3(N.z, 0.0, -N.x) + 1e-5);
  vec3 north = cross(N, east);
  float cosLat = max(0.15, length(N.xz));
  vec2 slope = vec2((elevOf(gE + 0.5) - elevOf(g + 0.5)) / cosLat, elevOf(gN + 0.5) - elevOf(g + 0.5)) * uRelief * (1.0 - ice);
  vec3 Nb = normalize(N - slope.x * east - slope.y * north);

  // ---- land
  float landDiffuse = mix(max(ndl, 0.0), max(dot(Nb, L), 0.0), 0.65);
  vec3 land = dayCol * (0.08 + 1.05 * landDiffuse);

  // ---- water: original ocean deepens as the sea rises; flooded land is turquoise over drowned terrain
  vec3 deepC = vec3(0.0016, 0.0062, 0.026);
  vec3 midC = vec3(0.004, 0.05, 0.12);
  vec3 shallowC = vec3(0.045, 0.42, 0.42);
  float riseDeep = smoothstep(0.0, 1800.0, uSea);
  vec3 oceanCol = mix(dayCol, deepC * 1.1, riseDeep * 0.9);

  float d = max(depth, 0.0);
  vec3 waterC = mix(shallowC, midC, 1.0 - exp(-d / 180.0));
  waterC = mix(waterC, deepC, 1.0 - exp(-d / 1100.0));
  vec3 under = mix(dayCol, vec3(0.02, 0.03, 0.035), melted);
  float clarity = exp(-d / 38.0);
  vec3 floodCol = mix(waterC, under * vec3(0.5, 0.85, 0.8) + shallowC * 0.55, clarity * 0.85);
  // Fresh coastline: a faint bright line right at the waterline.
  float shore = (1.0 - smoothstep(0.0, aa * 2.5 + 3.0, abs(depth))) * (1.0 - ocean) * step(1.0, uSea);
  floodCol += vec3(0.25, 0.55, 0.5) * shore * 0.35;

  vec3 water = mix(floodCol, oceanCol, ocean);

  // ---- algae blooms: domain-warped swirls that drift
  vec3 q = N * 3.2 + vec3(0.0, uTime * 0.004, uTime * 0.003);
  vec3 warp = vec3(vnoise(q), vnoise(q + 7.1), vnoise(q + 13.7)) - 0.5;
  vec3 bp = N * 8.0 + warp * 3.0;
  float region = vnoise(N * 2.0 + 4.3);
  float body = vnoise(bp) * 0.65 + vnoise(bp * 2.1 + 3.3) * 0.35;
  float fil = 1.0 - abs(2.0 * vnoise(bp * 3.3 + 9.1) - 1.0);
  float bv = region * 0.5 + body * 0.5;
  float bloom = smoothstep(0.62 - 0.22 * uAlgae, 0.74 - 0.18 * uAlgae, bv) * min(1.0, uAlgae * 2.5);
  bloom *= 0.55 + 0.45 * fil;
  vec3 bloomC = mix(vec3(0.004, 0.05, 0.035), vec3(0.03, 0.24, 0.17), fil * fil);
  water = mix(water, water * vec3(0.8, 1.25, 1.05), uAlgae * 0.4);
  water = mix(water, bloomC, bloom * 0.85);

  vec3 surf = mix(land, water * (0.25 + 0.85 * max(ndl, 0.0)), wet);

  // ---- specular glint on water
  vec3 Hh = normalize(L + V);
  float ndh = max(dot(N, Hh), 0.0);
  float spec = pow(ndh, 2400.0) * 0.35 + pow(ndh, 140.0) * 0.05;
  surf += wet * spec * vec3(1.0, 0.92, 0.8) * smoothstep(0.0, 0.2, ndl);

  // ---- day / night
  float day = smoothstep(-0.10, 0.20, ndl);
  float lightsMask = clamp(((max(nightTex.r, nightTex.g) - 0.8 * nightTex.b) * 255.0 - 0.6) / 6.0, 0.0, 1.0);
  vec3 cityLight = vec3(1.0, 0.66, 0.34) * pow(lightsMask, 0.85) * uLights * (1.0 - wet) * (1.0 - ice);
  vec3 moon = mix(land, water * 1.4, wet) * vec3(0.10, 0.14, 0.24) * 0.25;
  vec3 col = mix(moon + cityLight * 1.25, surf, day);
  // warm twilight band
  col += vec3(0.30, 0.13, 0.03) * exp(-pow(ndl / 0.06, 2.0)) * 0.018;

  // ---- atmosphere haze on the limb
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.2);
  col += vec3(0.16, 0.36, 0.9) * fres * (0.03 + 0.55 * smoothstep(-0.25, 0.45, ndl));

  // ---- shockwaves and impact flashes
  for (int i = 0; i < ${MAX_WAVES}; i++) {
    vec4 w = uWaves[i];
    if (w.w < 0.0) continue;
    vec4 p = uWaveP[i];
    float t = clamp(w.w / p.y, 0.0, 1.0);
    float ang = acos(clamp(dot(N, w.xyz), -1.0, 1.0));
    float r = p.x * (1.0 - pow(1.0 - t, 2.4));
    float width = 0.008 + 0.03 * t;
    float ring = exp(-pow((ang - r) / width, 2.0)) * (1.0 - t) * p.z;
    float inner = (1.0 - smoothstep(0.0, max(r, 1e-3), ang)) * (1.0 - t) * 0.25 * p.z;
    float flash = exp(-pow(ang / (p.x * (0.12 + 0.45 * t)), 2.0)) * exp(-w.w * 1.6) * p.w;
    col += uWaveC[i] * (ring + inner) + vec3(1.0, 0.96, 0.9) * flash * 3.0;
  }

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export const atmoVert = /* glsl */ `
varying vec3 vNw;
varying vec3 vPw;
void main() {
  vNw = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPw = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const atmoFrag = /* glsl */ `
uniform vec3 uSunW;
uniform vec3 uCamW;
uniform float uStrength;
uniform float uEdge;
varying vec3 vNw;
varying vec3 vPw;
void main() {
  vec3 Nw = normalize(vNw);
  vec3 V = normalize(uCamW - vPw);
  float x = max(0.0, dot(-Nw, V));
  float glow = pow(clamp(x / uEdge, 0.0, 1.0), 2.4);
  float sun = smoothstep(-0.5, 0.55, dot(Nw, uSunW));
  vec3 c = mix(vec3(0.03, 0.08, 0.26), vec3(0.28, 0.58, 1.0), sun);
  gl_FragColor = vec4(c * glow * uStrength * (0.18 + sun), 1.0);
  #include <colorspace_fragment>
}
`;

export const starVert = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aPhase;
uniform float uTime;
uniform float uPx;
varying vec3 vColor;
varying float vTw;
void main() {
  vColor = aColor;
  vTw = 0.75 + 0.25 * sin(uTime * (0.6 + aPhase * 1.7) + aPhase * 40.0);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPx;
  gl_Position = projectionMatrix * mv;
}
`;

export const starFrag = /* glsl */ `
varying vec3 vColor;
varying float vTw;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d);
  a = a * a;
  gl_FragColor = vec4(vColor * a * vTw, 1.0);
}
`;

/** Swarms: points that orbit small circles on the globe surface (drones, ships, arks). */
export const swarmVert = /* glsl */ `
attribute vec3 aAxis;
attribute float aSpeed;
attribute float aSize;
attribute float aPhase;
uniform float uTime;
uniform float uPx;
uniform float uRadius;
varying float vPhase;
vec3 rotateAxis(vec3 p, vec3 k, float a) {
  float c = cos(a), s = sin(a);
  return p * c + cross(k, p) * s + k * dot(k, p) * (1.0 - c);
}
void main() {
  vPhase = aPhase;
  vec3 p = normalize(rotateAxis(position, aAxis, aSpeed * uTime + aPhase * 6.2831)) * uRadius;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = aSize * uPx * (3.2 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

export const swarmFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
uniform float uBlink;
varying float vPhase;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float core = smoothstep(0.22, 0.0, d);
  float halo = smoothstep(0.5, 0.0, d) * 0.35;
  float blink = mix(1.0, 0.35 + 0.65 * step(0.5, fract(uTime * 0.7 + vPhase * 3.0)), uBlink);
  float a = (core + halo) * uOpacity * blink;
  gl_FragColor = vec4(uColor * a, 1.0);
  #include <colorspace_fragment>
}
`;

/** Sparks: CPU-driven glow sprites (flashes, markers, comet trails). */
export const sparkVert = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
attribute float aStyle;
uniform float uPx;
varying float vAlpha;
varying vec3 vColor;
varying float vStyle;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  vStyle = aStyle;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPx * (3.2 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

export const sparkFrag = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
varying float vStyle;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  float glow = pow(max(0.0, 1.0 - d), 2.2);
  float ring = exp(-pow((d - 0.72) / 0.09, 2.0)) * step(d, 1.0);
  float core = smoothstep(0.22, 0.0, d);
  float a = vStyle < 0.5 ? glow : (ring + core * 0.9);
  gl_FragColor = vec4(vColor * a * vAlpha, 1.0);
}
`;

/** Arcs: glowing tubes with a pulse travelling along them. */
export const arcVert = /* glsl */ `
varying float vU;
void main() {
  vU = uv.x;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const arcFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uOpacity;
uniform float uGrow;
varying float vU;
void main() {
  if (vU > uGrow) discard;
  float pulse = pow(fract(vU * 1.5 - uTime * 0.8), 6.0);
  float ends = smoothstep(0.0, 0.06, vU) * smoothstep(1.0, 0.94, vU);
  float a = (0.35 + 1.4 * pulse) * ends * uOpacity;
  gl_FragColor = vec4(uColor * a, 1.0);
}
`;
