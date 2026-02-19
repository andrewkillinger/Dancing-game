// ─── Web Audio Sound System ───────────────────────────────────────────────────
// All sounds are synthesized via Web Audio API - no external files required.

import { MusicStyle } from '@/types';

type WaveType = OscillatorType;

// ─── Drum Pattern Data ────────────────────────────────────────────────────────

interface DrumEvent {
  type: 'kick' | 'snare' | 'hihat' | 'openhat';
  offset: 0 | 0.5;  // 0 = on the beat, 0.5 = 8th-note half-beat
  gain?: number;
}

type DrumPattern = DrumEvent[][];  // indexed by beatIndex % 4

const DRUM_PATTERNS: Record<MusicStyle, DrumPattern> = {
  pop: [
    // beat 0: kick + hihat + 8th hihat
    [{ type: 'kick', offset: 0 }, { type: 'hihat', offset: 0 }, { type: 'hihat', offset: 0.5, gain: 0.07 }],
    // beat 1: snare + hihat
    [{ type: 'snare', offset: 0 }, { type: 'hihat', offset: 0 }],
    // beat 2: kick + hihat + 8th hihat
    [{ type: 'kick', offset: 0 }, { type: 'hihat', offset: 0 }, { type: 'hihat', offset: 0.5, gain: 0.07 }],
    // beat 3: snare + hihat
    [{ type: 'snare', offset: 0 }, { type: 'hihat', offset: 0 }],
  ],
  hiphop: [
    // beat 0: heavy kick + sparse hihat
    [{ type: 'kick', offset: 0, gain: 0.8 }, { type: 'hihat', offset: 0, gain: 0.08 }],
    // beat 1: openhat off-beat + half-beat kick (syncopation)
    [{ type: 'openhat', offset: 0 }, { type: 'kick', offset: 0.5, gain: 0.5 }],
    // beat 2: heavy snare
    [{ type: 'snare', offset: 0, gain: 0.5 }, { type: 'hihat', offset: 0.5, gain: 0.06 }],
    // beat 3: light hihat
    [{ type: 'hihat', offset: 0, gain: 0.08 }],
  ],
  electronic: [
    // beat 0: kick + 8th hihats
    [{ type: 'kick', offset: 0 }, { type: 'hihat', offset: 0 }, { type: 'hihat', offset: 0.5, gain: 0.1 }],
    // beat 1: kick + 8th hihats
    [{ type: 'kick', offset: 0, gain: 0.45 }, { type: 'hihat', offset: 0 }, { type: 'hihat', offset: 0.5, gain: 0.1 }],
    // beat 2: kick + snare + openhat + 8th hihats
    [{ type: 'kick', offset: 0 }, { type: 'snare', offset: 0 }, { type: 'openhat', offset: 0.5 }, { type: 'hihat', offset: 0 }],
    // beat 3: kick + 8th hihats
    [{ type: 'kick', offset: 0, gain: 0.45 }, { type: 'hihat', offset: 0 }, { type: 'hihat', offset: 0.5, gain: 0.1 }],
  ],
  latin: [
    // beat 0: kick + multiple 8th hihats
    [{ type: 'kick', offset: 0 }, { type: 'hihat', offset: 0 }, { type: 'hihat', offset: 0.5, gain: 0.09 }],
    // beat 1: kick + openhat off-beat
    [{ type: 'kick', offset: 0, gain: 0.4 }, { type: 'openhat', offset: 0.5, gain: 0.14 }],
    // beat 2: snare + hihat
    [{ type: 'snare', offset: 0 }, { type: 'hihat', offset: 0 }, { type: 'hihat', offset: 0.5, gain: 0.09 }],
    // beat 3: openhat + hihat off-beat
    [{ type: 'openhat', offset: 0, gain: 0.12 }, { type: 'hihat', offset: 0.5, gain: 0.09 }],
  ],
};

// Bass note cycles (Hz) — 4 notes cycling per bar
const BASS_CYCLES: Record<MusicStyle, [number, number, number, number]> = {
  pop:        [130.8, 146.8, 164.8, 146.8],  // C2 D2 E2 D2
  hiphop:     [65.4,  65.4,  87.3,  73.4],   // C1 C1 F1 D1
  electronic: [110,   138.6, 110,   164.8],   // A2 C#3 A2 E3
  latin:      [130.8, 155.6, 174.6, 155.6],   // C2 G2 F2 G2
};

// ─── Beat Engine (Chris Wilson lookahead scheduler) ───────────────────────────

class BeatEngine {
  private ctx: AudioContext;
  private master: GainNode;
  private bpm: number;
  private style: MusicStyle;
  private secPerBeat: number;
  private nextBeatTime = 0;
  private beatCount = 0;
  private bassIndex = 0;
  private readonly SCHEDULE_AHEAD = 0.1;  // seconds lookahead
  private readonly INTERVAL_MS = 25;       // polling rate
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private beatCallbacks: Array<(beatNum: number, beatTime: number) => void> = [];

  constructor(ctx: AudioContext, master: GainNode, bpm: number, style: MusicStyle) {
    this.ctx = ctx;
    this.master = master;
    this.bpm = bpm;
    this.style = style;
    this.secPerBeat = 60.0 / bpm;
  }

  start(startTime: number): void {
    this.nextBeatTime = startTime;
    this.beatCount = 0;
    this.intervalId = setInterval(() => this.schedule(), this.INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  onBeat(cb: (beatNum: number, beatTime: number) => void): () => void {
    this.beatCallbacks.push(cb);
    return () => {
      this.beatCallbacks = this.beatCallbacks.filter(c => c !== cb);
    };
  }

  private schedule(): void {
    while (this.nextBeatTime < this.ctx.currentTime + this.SCHEDULE_AHEAD) {
      const beatIndex = this.beatCount % 4;
      const t = this.nextBeatTime;
      const n = this.beatCount;

      // Notify listeners with the exact audio-clock beat time
      this.beatCallbacks.forEach(cb => cb(n, t));

      // Per-style drum pattern (may include 8th-note sub-events)
      const events = DRUM_PATTERNS[this.style][beatIndex];
      for (const ev of events) {
        const evTime = t + ev.offset * this.secPerBeat;
        if (ev.type === 'kick')    this.playKick(evTime, ev.gain);
        if (ev.type === 'snare')   this.playSnare(evTime, ev.gain);
        if (ev.type === 'hihat')   this.playHihat(evTime, ev.gain);
        if (ev.type === 'openhat') this.playOpenHat(evTime, ev.gain);
      }

      // Bass note on every downbeat (beat 0 of each 4-beat bar), cycling
      if (beatIndex === 0) {
        const freq = BASS_CYCLES[this.style][this.bassIndex % 4];
        this.playBass(freq, t);
        this.bassIndex++;
      }

      this.nextBeatTime += this.secPerBeat;
      this.beatCount++;
    }
  }

  private playKick(time: number, gainOverride?: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(50, time + 0.15);
    gain.gain.setValueAtTime(gainOverride ?? 0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(time);
    osc.stop(time + 0.22);
  }

  private playSnare(time: number, gainOverride?: number): void {
    const bufSize = Math.floor(this.ctx.sampleRate * 0.1);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainOverride ?? 0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(time);

    // Snare body tone
    const body = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    body.type = 'sine';
    body.frequency.setValueAtTime(200, time);
    bodyGain.gain.setValueAtTime((gainOverride ?? 0.35) * 0.7, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    body.connect(bodyGain);
    bodyGain.connect(this.master);
    body.start(time);
    body.stop(time + 0.1);
  }

  private playHihat(time: number, gainOverride?: number): void {
    const bufSize = Math.floor(this.ctx.sampleRate * 0.04);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 8000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainOverride ?? 0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(time);
  }

  private playOpenHat(time: number, gainOverride?: number): void {
    const bufSize = Math.floor(this.ctx.sampleRate * 0.15);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 5000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainOverride ?? 0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(time);
  }

  private playBass(freq: number, time: number): void {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.value = 400;

    const dur = this.secPerBeat * 0.85;
    gain.gain.setValueAtTime(0.45, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }
}

// ─── Sound System ─────────────────────────────────────────────────────────────

class SoundSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private _enabled = false;
  private initialized = false;
  private beatEngine: BeatEngine | null = null;

  /** Must be called from user gesture to unlock audio */
  init(): void {
    if (this.initialized) return;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch {
      console.warn('[Sound] Web Audio API not available');
    }
  }

  get enabled(): boolean {
    return this._enabled;
  }

  setEnabled(val: boolean): void {
    this._enabled = val;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(val ? 0.3 : 0, this.ctx.currentTime, 0.1);
    }
  }

  toggle(): boolean {
    this.setEnabled(!this._enabled);
    return this._enabled;
  }

  getAudioContext(): AudioContext | null {
    return this.ctx;
  }

  getAudioCurrentTime(): number | null {
    return this.ctx?.currentTime ?? null;
  }

  // ─── Beat Engine ─────────────────────────────────────────────────────────

  startBeat(bpm: number, style: MusicStyle): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    this.beatEngine?.stop();
    this.beatEngine = new BeatEngine(this.ctx, this.masterGain, bpm, style);
    this.beatEngine.start(this.ctx.currentTime + 0.1);
  }

  stopBeat(): void {
    this.beatEngine?.stop();
    this.beatEngine = null;
  }

  onBeat(cb: (beatNum: number, beatTime: number) => void): () => void {
    if (!this.beatEngine) return () => {};
    return this.beatEngine.onBeat(cb);
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  private getAudio(): { ctx: AudioContext; master: GainNode } | null {
    if (!this.initialized || !this.ctx || !this.masterGain || !this._enabled) return null;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return { ctx: this.ctx, master: this.masterGain };
  }

  private playTone(
    freq: number,
    duration: number,
    wave: WaveType = 'sine',
    gain = 0.5,
    detune = 0
  ): void {
    const audio = this.getAudio();
    if (!audio) return;
    const { ctx, master } = audio;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = wave;
    osc.frequency.setValueAtTime(freq, now);
    osc.detune.setValueAtTime(detune, now);
    gainNode.gain.setValueAtTime(gain, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gainNode);
    gainNode.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  private playNoise(duration: number, gain = 0.3, filterFreq = 2000): void {
    const audio = this.getAudio();
    if (!audio) return;
    const { ctx, master } = audio;
    const now = ctx.currentTime;
    const sampleRate = ctx.sampleRate;
    const bufferSize = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(gain, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(master);
    src.start(now);
  }

  // ─── Rhythm SFX ──────────────────────────────────────────────────────────

  playPerfectHit(): void {
    // Bright ascending 3-note arpeggio
    const freqs = [660, 880, 1100];
    freqs.forEach((f, i) => setTimeout(() => this.playTone(f, 0.1, 'sine', 0.4), i * 40));
  }

  playGoodHit(): void {
    this.playTone(550, 0.12, 'sine', 0.3);
  }

  playMiss(): void {
    this.playTone(200, 0.2, 'sawtooth', 0.2);
  }

  playComboBreak(): void {
    const freqs = [440, 370, 330];
    freqs.forEach((f, i) => setTimeout(() => this.playTone(f, 0.1, 'square', 0.25), i * 50));
  }

  playPowerUp(): void {
    const freqs = [523, 659, 784, 1047];
    freqs.forEach((f, i) => setTimeout(() => this.playTone(f, 0.15, 'sine', 0.35), i * 60));
  }

  playAudienceCheer(): void {
    this.playNoise(0.4, 0.15, 1200);
  }

  // ─── Existing SFX (unchanged) ─────────────────────────────────────────────

  playDanceStart(): void {
    this.playTone(440, 0.15, 'square', 0.4);
    setTimeout(() => this.playTone(880, 0.12, 'square', 0.3), 80);
  }

  playWiggle(): void {
    const freqs = [330, 440, 550, 440];
    freqs.forEach((f, i) => setTimeout(() => this.playTone(f, 0.1, 'sine', 0.3), i * 60));
  }

  playRobot(): void {
    this.playTone(220, 0.1, 'square', 0.35);
    setTimeout(() => this.playTone(110, 0.15, 'square', 0.3), 120);
  }

  playWorm(): void {
    const freqs = [200, 250, 300, 250, 200];
    freqs.forEach((f, i) => setTimeout(() => this.playTone(f, 0.08, 'sawtooth', 0.25), i * 50));
  }

  playFlail(): void {
    this.playNoise(0.15, 0.2, 3000);
  }

  playSpin(): void {
    const audio = this.getAudio();
    if (!audio) return;
    const { ctx, master } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(800, now + 0.4);
    gainNode.gain.setValueAtTime(0.35, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gainNode);
    gainNode.connect(master);
    osc.start(now);
    osc.stop(now + 0.55);
  }

  playCollision(mass: number): void {
    const baseFreq = Math.max(80, 400 - mass * 15);
    const wave: WaveType = mass > 5 ? 'sawtooth' : 'sine';
    this.playTone(baseFreq, 0.3, wave, 0.5);
    if (mass < 3) {
      setTimeout(() => this.playTone(baseFreq * 1.5, 0.2, 'sine', 0.3), 60);
    }
    this.playNoise(0.1, 0.2, mass > 5 ? 800 : 2000);
  }

  playBoing(): void {
    const audio = this.getAudio();
    if (!audio) return;
    const { ctx, master } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.3);
    gainNode.gain.setValueAtTime(0.4, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gainNode);
    gainNode.connect(master);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  playDrop(): void {
    this.playTone(500, 0.08, 'square', 0.3);
    setTimeout(() => this.playTone(350, 0.1, 'square', 0.2), 60);
  }

  playComboUp(): void {
    const freqs = [440, 550, 660, 880];
    freqs.forEach((f, i) => setTimeout(() => this.playTone(f, 0.12, 'sine', 0.35), i * 70));
  }

  playVictory(): void {
    const melody = [523, 659, 784, 1047];
    melody.forEach((f, i) => {
      setTimeout(() => {
        this.playTone(f, 0.25, 'sine', 0.4);
        this.playTone(f / 2, 0.25, 'sine', 0.2);
      }, i * 150);
    });
  }

  playHighScore(): void {
    const melody = [523, 659, 784, 659, 784, 1047];
    melody.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 0.2, 'square', 0.3), i * 100);
    });
  }

  playChallengeComplete(): void {
    setTimeout(() => this.playVictory(), 0);
  }
}

export const soundSystem = new SoundSystem();
