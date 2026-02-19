import * as PIXI from 'pixi.js';
import { TapZone, HitRating } from '@/types';
import { RhythmHitResult } from '@/game/scoring';

// ─── Constants ────────────────────────────────────────────────────────────────

const PERFECT_WINDOW = 0.05;   // ±50 ms
const GOOD_WINDOW    = 0.15;   // ±150 ms
const TRAVEL_BEATS   = 4;      // beats for target to travel from spawn to rail
const GRACE_SEC      = 0.25;   // auto-miss grace period after hitTime

// Zone colours (outer ring)
const ZONE_COLORS: Record<string, number> = {
  left:   0xFF6B6B,
  center: 0xFFE66D,
  right:  0x6BCB77,
};


// ─── RhythmTarget ─────────────────────────────────────────────────────────────

interface RhythmTarget {
  id: number;
  zone: TapZone;
  hitTime: number;      // AudioContext.currentTime when this target should be hit
  spawnY: number;       // y at spawn
  railY: number;        // y of the hit rail (destination)
  travelSec: number;    // total travel time in seconds
  state: 'active' | 'hit' | 'missed';
  sprite: PIXI.Container;
}

function zoneColumn(zone: TapZone): 'left' | 'center' | 'right' {
  if (zone.includes('left'))   return 'left';
  if (zone.includes('right'))  return 'right';
  return 'center';
}

// ─── RhythmEngine ─────────────────────────────────────────────────────────────

export class RhythmEngine {
  private layer: PIXI.Container;
  private canvasW: number;
  private canvasH: number;
  private railY: number;
  private bpm: number;
  private secPerBeat: number;
  private beatPattern: TapZone[][];

  private targets: RhythmTarget[] = [];
  private idCounter = 0;
  private running = false;

  private onHitCbs: Array<(r: RhythmHitResult) => void> = [];
  private onMissCbs: Array<(zone: TapZone) => void> = [];

  // Hit rail graphics (drawn once)
  private railGfx: PIXI.Graphics;

  constructor(layer: PIXI.Container, canvasW: number, canvasH: number, bpm: number, beatPattern: TapZone[][]) {
    this.layer = layer;
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    this.bpm = bpm;
    this.beatPattern = beatPattern;
    this.secPerBeat = 60 / bpm;
    this.railY = canvasH * 0.62;

    // Draw the hit rail once
    this.railGfx = new PIXI.Graphics();
    this.drawRail();
    this.layer.addChild(this.railGfx);
  }

  private drawRail(): void {
    this.railGfx.clear();
    // Main rail line
    this.railGfx.lineStyle(2, 0xffffff, 0.25);
    this.railGfx.moveTo(0, this.railY);
    this.railGfx.lineTo(this.canvasW, this.railY);
    // Column dividers
    this.railGfx.lineStyle(1, 0xffffff, 0.08);
    const col = this.canvasW / 3;
    for (let i = 1; i < 3; i++) {
      this.railGfx.moveTo(col * i, 0);
      this.railGfx.lineTo(col * i, this.canvasH);
    }
  }

  start(): void {
    this.running = true;
  }

  stop(): void {
    this.running = false;
    for (const t of this.targets) this.removeSprite(t);
    this.targets = [];
  }

  /** Called by dance.ts when soundSystem.onBeat fires */
  onBeatFired(beatNum: number, beatTime: number): void {
    if (!this.running) return;
    const zones = this.beatPattern[beatNum % this.beatPattern.length];
    for (const zone of zones) {
      this.spawnTarget(zone, beatTime + TRAVEL_BEATS * this.secPerBeat);
    }
  }

  /** Main update — call every frame with dt (seconds) and audioCurrentTime */
  update(dt: number, audioNow: number): void {
    const toRemove: RhythmTarget[] = [];

    for (const t of this.targets) {
      if (t.state !== 'active') {
        toRemove.push(t);
        continue;
      }

      // Auto-miss if past grace period
      if (audioNow > t.hitTime + GRACE_SEC) {
        t.state = 'missed';
        this.onMissCbs.forEach(cb => cb(t.zone));
        toRemove.push(t);
        continue;
      }

      // Animate position: travel from spawnY to railY over travelSec
      const elapsed = audioNow - (t.hitTime - t.travelSec);
      const progress = Math.max(0, Math.min(1, elapsed / t.travelSec));
      const y = t.spawnY + (this.railY - t.spawnY) * progress;
      t.sprite.y = y;

      // Scale grows from 0.7 to 1.0 as it approaches
      t.sprite.scale.set(0.7 + progress * 0.3);

      // Pulse alpha
      const pulse = 0.75 + 0.25 * Math.sin(audioNow * Math.PI * 2 * (this.bpm / 60));
      t.sprite.alpha = pulse;
    }

    // Remove finished targets
    for (const t of toRemove) {
      this.removeSprite(t);
      this.targets = this.targets.filter(x => x !== t);
    }
  }

  /**
   * Called from touch handler. Returns a RhythmHitResult if a target was hit,
   * or null if the tap was purely puppeteer (no target in range).
   */
  tryHit(tapX: number, _tapY: number, audioNow: number): RhythmHitResult | null {
    const col = this.columnFromX(tapX);
    let best: RhythmTarget | null = null;
    let bestDelta = Infinity;

    for (const t of this.targets) {
      if (t.state !== 'active') continue;
      if (zoneColumn(t.zone) !== col) continue;
      const delta = Math.abs(audioNow - t.hitTime);
      if (delta <= GOOD_WINDOW && delta < bestDelta) {
        best = t;
        bestDelta = delta;
      }
    }

    if (!best) return null;

    const rating: HitRating = bestDelta <= PERFECT_WINDOW ? 'perfect' : 'good';
    best.state = 'hit';
    this.flashHit(best, rating);

    const result: RhythmHitResult = { rating, zone: best.zone, targetId: best.id };
    this.onHitCbs.forEach(cb => cb(result));
    return result;
  }

  /** Get the tap zone for a coordinate even with no target present (puppeteer mode) */
  getTapZone(tapX: number, tapY: number): TapZone {
    const col = this.columnFromX(tapX);
    const row = tapY < this.railY ? 'upper' : 'lower';
    return `${row}-${col}` as TapZone;
  }

  onHit(cb: (r: RhythmHitResult) => void): () => void {
    this.onHitCbs.push(cb);
    return () => { this.onHitCbs = this.onHitCbs.filter(c => c !== cb); };
  }

  onMiss(cb: (zone: TapZone) => void): () => void {
    this.onMissCbs.push(cb);
    return () => { this.onMissCbs = this.onMissCbs.filter(c => c !== cb); };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private columnFromX(x: number): 'left' | 'center' | 'right' {
    const col = this.canvasW / 3;
    if (x < col)         return 'left';
    if (x < col * 2)     return 'center';
    return 'right';
  }

  private xForColumn(col: 'left' | 'center' | 'right'): number {
    const col3 = this.canvasW / 3;
    if (col === 'left')   return col3 * 0.5;
    if (col === 'right')  return col3 * 2.5;
    return col3 * 1.5;
  }

  private spawnTarget(zone: TapZone, hitTime: number): void {
    const col = zoneColumn(zone);
    const x = this.xForColumn(col);
    const spawnY = -40;
    const travelSec = TRAVEL_BEATS * this.secPerBeat;

    const sprite = this.buildSprite(col);
    sprite.x = x;
    sprite.y = spawnY;
    sprite.scale.set(0.7);
    this.layer.addChild(sprite);

    const target: RhythmTarget = {
      id: this.idCounter++,
      zone,
      hitTime,
      spawnY,
      railY: this.railY,
      travelSec,
      state: 'active',
      sprite,
    };
    this.targets.push(target);
  }

  private buildSprite(col: 'left' | 'center' | 'right'): PIXI.Container {
    const c = new PIXI.Container();
    const color = ZONE_COLORS[col];
    const outer = new PIXI.Graphics();
    const inner = new PIXI.Graphics();

    // Outer ring
    outer.lineStyle(3, color, 0.9);
    outer.drawCircle(0, 0, 28);

    // Inner fill
    inner.beginFill(color, 0.35);
    inner.drawCircle(0, 0, 20);
    inner.endFill();

    // Small zone indicator dot at center
    inner.beginFill(color, 0.8);
    inner.drawCircle(0, 0, 5);
    inner.endFill();

    c.addChild(outer, inner);
    return c;
  }

  private flashHit(target: RhythmTarget, rating: HitRating): void {
    const col = zoneColumn(target.zone);
    const color = rating === 'perfect' ? 0xFFFFFF : ZONE_COLORS[col];

    // Brief flash: scale up then fade
    const flash = new PIXI.Graphics();
    flash.beginFill(color, 0.6);
    flash.drawCircle(0, 0, rating === 'perfect' ? 48 : 36);
    flash.endFill();
    flash.x = target.sprite.x;
    flash.y = target.sprite.y;
    this.layer.addChild(flash);

    let t = 0;
    const ticker = PIXI.Ticker.shared;
    const fn = (dt: number) => {
      t += dt / 60;
      flash.alpha = Math.max(0, 1 - t / 0.25);
      flash.scale.set(1 + t * 3);
      if (t >= 0.25) {
        ticker.remove(fn);
        if (flash.parent) flash.parent.removeChild(flash);
      }
    };
    ticker.add(fn);
  }

  private removeSprite(target: RhythmTarget): void {
    if (target.sprite.parent) target.sprite.parent.removeChild(target.sprite);
  }

  destroy(): void {
    this.stop();
    if (this.railGfx.parent) this.railGfx.parent.removeChild(this.railGfx);
  }
}
