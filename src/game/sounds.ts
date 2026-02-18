// ─── Web Audio Sound System ───────────────────────────────────────────────────
// All sounds are synthesized via Web Audio API - no external files required.

type WaveType = OscillatorType;

class SoundSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private _enabled = false;
  private initialized = false;

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

  // ─── Sound Effects ───────────────────────────────────────────────────────

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
    // Heavy = lower thud, light = higher boing
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
