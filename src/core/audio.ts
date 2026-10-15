// Music (Suno tracks, crossfaded) and procedurally synthesized sound effects.

export type TrackName = 'aquarium' | 'escape' | 'earth' | 'space' | 'ending';

const PREFS_KEY = 'uf.audio';

// Suno takes in public/music (each has a .json sidecar recording its prompt and rights).
const MUSIC_FILES: Record<TrackName, string> = {
  aquarium: 'music/aquarium-6daf4cd0.mp3',
  escape: 'music/escape-ce0695c6.mp3',
  earth: 'music/earth-84315b00.mp3',
  space: 'music/space-377553e4.mp3',
  ending: 'music/ending-00d79d67.mp3',
};

interface Prefs {
  music: number;
  sfx: number;
  muted: boolean;
}

interface Track {
  el: HTMLAudioElement;
  gain: GainNode;
}

export class AudioSystem {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private noise!: AudioBuffer;
  private tracks = new Map<TrackName, Track>();
  private current: TrackName | null = null;
  private wanted: TrackName | null = null;
  prefs: Prefs = { music: 0.6, sfx: 0.7, muted: false };
  private listeners = new Set<() => void>();
  private lastBlip = 0;

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
      if (saved) this.prefs = { ...this.prefs, ...saved };
    } catch {
      /* storage unavailable */
    }
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
  }

  /** Must run inside a user gesture before anything is audible. */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.applyPrefs();
      if (this.wanted) this.playMusic(this.wanted);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  get unlocked() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  onChange(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setPrefs(p: Partial<Prefs>) {
    this.prefs = { ...this.prefs, ...p };
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
    } catch {
      /* ignore */
    }
    this.applyPrefs();
    this.listeners.forEach((fn) => fn());
  }

  toggleMute() {
    this.setPrefs({ muted: !this.prefs.muted });
  }

  private applyPrefs() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.prefs.muted ? 0 : 1, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.prefs.music * 0.8, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.prefs.sfx * 0.9, t, 0.05);
  }

  // ---------------------------------------------------------------- music

  private track(name: TrackName): Track | null {
    if (!this.ctx) return null;
    let t = this.tracks.get(name);
    if (!t) {
      const audio = new Audio(MUSIC_FILES[name]);
      audio.loop = name !== 'ending';
      audio.preload = 'auto';
      audio.crossOrigin = 'anonymous';
      const src = this.ctx.createMediaElementSource(audio);
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain).connect(this.musicBus);
      t = { el: audio, gain };
      this.tracks.set(name, t);
    }
    return t;
  }

  /** Crossfades to `name`. Safe to call before audio is unlocked. */
  playMusic(name: TrackName | null, fade = 2.5, opts: { restart?: boolean; volume?: number } = {}) {
    this.wanted = name;
    if (!this.ctx) return;
    if (name === this.current && !opts.restart) {
      if (opts.volume !== undefined && name) this.musicVolume(opts.volume, fade);
      return;
    }
    const now = this.ctx.currentTime;
    if (this.current) {
      const old = this.tracks.get(this.current);
      if (old) {
        old.gain.gain.cancelScheduledValues(now);
        old.gain.gain.setValueAtTime(old.gain.gain.value, now);
        old.gain.gain.linearRampToValueAtTime(0, now + fade);
        const el = old.el;
        window.setTimeout(() => {
          if (this.current !== this.nameOf(el)) el.pause();
        }, fade * 1000 + 100);
      }
    }
    this.current = name;
    if (!name) return;
    const t = this.track(name);
    if (!t) return;
    if (opts.restart) t.el.currentTime = 0;
    t.el.play().catch(() => {
      /* missing file or autoplay block; stay silent */
    });
    t.gain.gain.cancelScheduledValues(now);
    t.gain.gain.setValueAtTime(t.gain.gain.value, now);
    t.gain.gain.linearRampToValueAtTime(opts.volume ?? 1, now + fade);
  }

  /** Ducks or restores the current track (e.g. under dialogue). */
  musicVolume(v: number, fade = 0.6) {
    if (!this.ctx || !this.current) return;
    const t = this.tracks.get(this.current);
    if (!t) return;
    const now = this.ctx.currentTime;
    t.gain.gain.cancelScheduledValues(now);
    t.gain.gain.setValueAtTime(t.gain.gain.value, now);
    t.gain.gain.linearRampToValueAtTime(v, now + fade);
  }

  private nameOf(el: HTMLAudioElement): TrackName | null {
    for (const [n, t] of this.tracks) if (t.el === el) return n;
    return null;
  }

  // ---------------------------------------------------------------- sfx primitives

  private tone(
    freq: number,
    dur: number,
    opts: {
      type?: OscillatorType;
      vol?: number;
      to?: number;
      attack?: number;
      delay?: number;
      curve?: 'exp' | 'lin';
      filter?: number;
    } = {},
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.to !== undefined) {
      if (opts.curve === 'lin') osc.frequency.linearRampToValueAtTime(opts.to, t0 + dur);
      else osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t0 + dur);
    }
    const g = ctx.createGain();
    const vol = opts.vol ?? 0.2;
    const atk = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node: AudioNode = osc;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.filter;
      osc.connect(f);
      node = f;
    }
    node.connect(g).connect(this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private burst(
    dur: number,
    opts: {
      vol?: number;
      type?: BiquadFilterType;
      freq?: number;
      to?: number;
      q?: number;
      delay?: number;
      attack?: number;
    } = {},
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.setValueAtTime(opts.freq ?? 1000, t0);
    if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
    f.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.vol ?? 0.2, t0 + (opts.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t0, Math.random());
    src.stop(t0 + dur + 0.05);
  }

  // ---------------------------------------------------------------- named sfx

  /** Typewriter blip; rate-limited so long strings don't machine-gun. */
  blip(pitch = 520, wave: OscillatorType = 'square', vol = 0.035) {
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.lastBlip < 45) return;
    this.lastBlip = now;
    this.tone(pitch * (0.94 + Math.random() * 0.12), 0.05, { type: wave, vol, filter: 2400 });
  }

  key() {
    this.burst(0.03, { freq: 3000 + Math.random() * 1500, q: 2, vol: 0.06, type: 'bandpass' });
    this.tone(180 + Math.random() * 40, 0.025, { type: 'square', vol: 0.015, filter: 900 });
  }

  click() {
    this.tone(880, 0.06, { type: 'triangle', vol: 0.08, to: 660 });
  }

  hover() {
    this.tone(1320, 0.03, { type: 'sine', vol: 0.025 });
  }

  bubble(pitch = 1) {
    const f = (300 + Math.random() * 500) * pitch;
    this.tone(f, 0.09, { type: 'sine', vol: 0.07, to: f * 2.6, attack: 0.003 });
  }

  plop() {
    this.tone(420, 0.12, { type: 'sine', vol: 0.16, to: 160 });
    this.burst(0.08, { freq: 900, q: 3, vol: 0.05 });
    for (let i = 0; i < 3; i++) window.setTimeout(() => this.bubble(1.3), 80 + i * 70);
  }

  chomp() {
    this.burst(0.07, { freq: 600, q: 1.5, vol: 0.12, type: 'lowpass' });
    this.tone(220, 0.08, { type: 'square', vol: 0.05, to: 120, filter: 800 });
    this.burst(0.06, { freq: 700, q: 1.5, vol: 0.1, type: 'lowpass', delay: 0.09 });
  }

  coin() {
    this.tone(1318.5, 0.08, { type: 'square', vol: 0.06, filter: 5000 });
    this.tone(1975.5, 0.25, { type: 'square', vol: 0.06, delay: 0.07, filter: 5000 });
  }

  purchase() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.tone(f, 0.18, { type: 'triangle', vol: 0.09, delay: i * 0.06 }),
    );
  }

  success() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
      this.tone(f, 0.35, { type: 'triangle', vol: 0.1, delay: i * 0.09 }),
    );
    [1046.5, 1318.5, 1568].forEach((f) => this.tone(f, 0.9, { type: 'sine', vol: 0.05, delay: 0.5 }));
  }

  fanfare() {
    const notes = [523.25, 523.25, 523.25, 698.46, 880, 1046.5];
    const times = [0, 0.12, 0.24, 0.36, 0.6, 0.84];
    notes.forEach((f, i) => {
      this.tone(f, 0.3, { type: 'square', vol: 0.05, delay: times[i], filter: 3000 });
      this.tone(f / 2, 0.3, { type: 'triangle', vol: 0.07, delay: times[i] });
    });
    this.tone(1046.5, 1.4, { type: 'triangle', vol: 0.08, delay: 0.84 });
  }

  error() {
    this.tone(160, 0.18, { type: 'sawtooth', vol: 0.06, filter: 900 });
    this.tone(120, 0.22, { type: 'sawtooth', vol: 0.06, delay: 0.12, filter: 900 });
  }

  denied() {
    this.tone(330, 0.1, { type: 'square', vol: 0.05, filter: 1500 });
    this.tone(247, 0.18, { type: 'square', vol: 0.05, delay: 0.1, filter: 1500 });
  }

  glitch(dur = 0.35) {
    if (!this.ctx) return;
    for (let i = 0; i < 6; i++) {
      const d = Math.random() * dur;
      this.tone(80 + Math.random() * 2000, 0.04 + Math.random() * 0.05, {
        type: Math.random() < 0.5 ? 'square' : 'sawtooth',
        vol: 0.05,
        delay: d,
      });
    }
    this.burst(dur, { freq: 2500, q: 0.7, vol: 0.08, type: 'highpass' });
  }

  whoosh(up = true) {
    this.burst(0.7, { freq: up ? 300 : 3000, to: up ? 3000 : 250, q: 1.2, vol: 0.12, attack: 0.25 });
  }

  boom() {
    this.tone(70, 2.2, { type: 'sine', vol: 0.4, to: 28, attack: 0.01 });
    this.burst(2.5, { freq: 400, to: 60, type: 'lowpass', vol: 0.35, attack: 0.02 });
  }

  rumble(dur = 3) {
    this.burst(dur, { freq: 140, to: 60, type: 'lowpass', vol: 0.18, attack: dur * 0.3 });
  }

  chime() {
    this.tone(1567.98, 1.2, { type: 'sine', vol: 0.06 });
    this.tone(2349.3, 1.0, { type: 'sine', vol: 0.03, delay: 0.05 });
  }

  notify() {
    this.tone(987.77, 0.12, { type: 'sine', vol: 0.08 });
    this.tone(1318.5, 0.3, { type: 'sine', vol: 0.08, delay: 0.1 });
  }

  alarm() {
    for (let i = 0; i < 3; i++) {
      this.tone(740, 0.16, { type: 'square', vol: 0.04, delay: i * 0.36, filter: 2000 });
      this.tone(554, 0.16, { type: 'square', vol: 0.04, delay: i * 0.36 + 0.18, filter: 2000 });
    }
  }

  launch() {
    this.burst(1.6, { freq: 200, to: 1800, type: 'bandpass', q: 0.8, vol: 0.15, attack: 0.3 });
    this.tone(90, 1.4, { type: 'sawtooth', vol: 0.05, to: 400, filter: 600 });
  }

  /** Short pleasant tick for incremental counters/clickers. */
  tick(pitch = 1) {
    this.tone(1200 * pitch, 0.04, { type: 'sine', vol: 0.05 });
  }
}

export const audio = new AudioSystem();
