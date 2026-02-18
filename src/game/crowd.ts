import * as PIXI from 'pixi.js';
import { HitRating, StageEffectType } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CrowdMember {
  side: 'left' | 'right';
  index: number;           // 0–3 within side
  baseX: number;
  baseY: number;
  energyLevel: number;     // 0–1
  bouncePhase: number;     // for idle sway
  bounceTimer: number;     // time into bounce animation
  isBouncing: boolean;
  sprite: PIXI.Container;
  emoji: PIXI.Text;
}

interface StageEffect {
  type: StageEffectType;
  sprite: PIXI.Container;
  age: number;
  duration: number;
  active: boolean;
}

const CROWD_EMOJIS = ['🙌','🎉','🕺','💃','👏','🤩','😍','🔥','✨','🙋'];

// ─── CrowdManager ─────────────────────────────────────────────────────────────

export class CrowdManager {
  private layer: PIXI.Container;
  private canvasW: number;
  private canvasH: number;
  private members: CrowdMember[] = [];
  private effects: StageEffect[] = [];

  energyLevel = 0;           // 0–1, exposed for HUD meters

  constructor(layer: PIXI.Container, canvasW: number, canvasH: number) {
    this.layer = layer;
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    this.spawnCrowd();
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  onRhythmHit(rating: HitRating, comboMultiplier: number): void {
    const boost = rating === 'perfect' ? 0.12 : 0.06;
    this.energyLevel = Math.min(1, this.energyLevel + boost * (comboMultiplier / 5));

    // Trigger bounce on nearby members
    for (const m of this.members) {
      if (Math.random() < (rating === 'perfect' ? 0.7 : 0.35)) {
        this.triggerBounce(m, rating === 'perfect' ? 1.0 : 0.5);
      }
    }
  }

  onComboBreak(): void {
    this.energyLevel = Math.max(0, this.energyLevel - 0.25);
    // Crowd reacts with slump
    for (const m of this.members) {
      m.emoji.scale.set(0.8);
    }
  }

  triggerEffect(type: StageEffectType): void {
    // Don't duplicate same effect if already active
    if (this.effects.some(e => e.type === type && e.active)) return;

    switch (type) {
      case 'spotlight':   this.spawnSpotlight(); break;
      case 'discoBall':   this.spawnDiscoBall(); break;
      case 'hypeTrain':   this.spawnHypeTrain(); break;
      case 'confetti':    this.spawnConfetti(); break;
    }
  }

  update(dt: number): void {
    this.updateCrowd(dt);
    this.updateEffects(dt);
    // Energy decays slowly
    this.energyLevel = Math.max(0, this.energyLevel - dt * 0.03);
  }

  destroy(): void {
    for (const m of this.members) {
      if (m.sprite.parent) m.sprite.parent.removeChild(m.sprite);
    }
    for (const e of this.effects) {
      if (e.sprite.parent) e.sprite.parent.removeChild(e.sprite);
    }
    this.members = [];
    this.effects = [];
  }

  // ─── Crowd setup ────────────────────────────────────────────────────────────

  private spawnCrowd(): void {
    const stageBottom = this.canvasH * 0.78;
    const colW = this.canvasW * 0.18;

    for (const side of ['left', 'right'] as const) {
      for (let i = 0; i < 4; i++) {
        const xBase = side === 'left'
          ? colW * 0.3 + i * 14
          : this.canvasW - colW * 0.3 - i * 14;
        const yBase = stageBottom + i * 12;

        const member = this.buildMember(side, i, xBase, yBase);
        this.members.push(member);
        this.layer.addChild(member.sprite);
      }
    }
  }

  private buildMember(
    side: 'left' | 'right',
    index: number,
    x: number,
    y: number
  ): CrowdMember {
    const sprite = new PIXI.Container();

    // Simple stick figure: head + body suggestion
    const gfx = new PIXI.Graphics();
    const scale = 0.65 + index * 0.05;

    // Head (small circle)
    gfx.beginFill(0xFFCCAA, 0.9);
    gfx.drawCircle(0, -18 * scale, 7 * scale);
    gfx.endFill();

    // Body (rectangle)
    gfx.beginFill(0x6C3FF5, 0.7);
    gfx.drawRoundedRect(-5 * scale, -11 * scale, 10 * scale, 14 * scale, 3);
    gfx.endFill();

    // Arms up (two lines)
    gfx.lineStyle(2 * scale, 0xFFCCAA, 0.8);
    gfx.moveTo(-5 * scale, -8 * scale);
    gfx.lineTo(-12 * scale, -20 * scale);
    gfx.moveTo(5 * scale, -8 * scale);
    gfx.lineTo(12 * scale, -20 * scale);
    gfx.lineStyle(0);

    sprite.addChild(gfx);

    // Emoji label floating above
    const emoji = new PIXI.Text(CROWD_EMOJIS[(index + (side === 'right' ? 4 : 0)) % CROWD_EMOJIS.length], {
      fontSize: 16,
      fontFamily: 'Segoe UI Emoji, Apple Color Emoji, sans-serif',
    });
    emoji.anchor.set(0.5);
    emoji.y = -38 * scale;
    emoji.alpha = 0;
    sprite.addChild(emoji);

    sprite.x = x;
    sprite.y = y;

    return {
      side,
      index,
      baseX: x,
      baseY: y,
      energyLevel: 0,
      bouncePhase: index * 0.4,
      bounceTimer: 0,
      isBouncing: false,
      sprite,
      emoji,
    };
  }

  private updateCrowd(dt: number): void {
    for (const m of this.members) {
      // Idle sway
      m.bouncePhase += dt * (1.2 + this.energyLevel * 2);
      const sway = Math.sin(m.bouncePhase) * (2 + this.energyLevel * 8);
      m.sprite.x = m.baseX + sway;

      // Bounce animation
      if (m.isBouncing) {
        m.bounceTimer += dt;
        const p = m.bounceTimer / 0.3;
        if (p >= 1) {
          m.isBouncing = false;
          m.sprite.y = m.baseY;
          m.sprite.scale.set(1);
          m.emoji.alpha = 0;
        } else {
          const lift = Math.sin(p * Math.PI) * 18 * m.energyLevel;
          m.sprite.y = m.baseY - lift;
          const sc = 1 + Math.sin(p * Math.PI) * 0.3 * m.energyLevel;
          m.sprite.scale.set(sc);
          m.emoji.alpha = Math.sin(p * Math.PI);
        }
      } else {
        // Restore emoji scale toward 1.0
        m.emoji.scale.x += (1 - m.emoji.scale.x) * dt * 5;
        m.emoji.scale.y = m.emoji.scale.x;
      }

      // Energy bleeds toward global level
      m.energyLevel += (this.energyLevel - m.energyLevel) * dt * 2;
    }
  }

  private triggerBounce(m: CrowdMember, intensity: number): void {
    m.isBouncing = true;
    m.bounceTimer = 0;
    m.energyLevel = Math.min(1, m.energyLevel + intensity * 0.3);
  }

  // ─── Stage effects ──────────────────────────────────────────────────────────

  private spawnSpotlight(): void {
    const container = new PIXI.Container();
    const colors = [0xFF6B6B, 0xFFE66D, 0x6BCB77, 0x4D96FF];
    let colorIdx = 0;

    // Two cone lights from top corners
    for (let s = -1; s <= 1; s += 2) {
      const cone = new PIXI.Graphics();
      const cx = this.canvasW / 2 + s * this.canvasW * 0.4;
      cone.beginFill(colors[colorIdx % colors.length], 0.08);
      cone.drawPolygon([
        cx, 0,
        cx - s * 80, this.canvasH * 0.7,
        cx + s * 20, this.canvasH * 0.7,
      ]);
      cone.endFill();
      container.addChild(cone);
      colorIdx++;
    }

    this.layer.addChildAt(container, 0); // behind everything

    const effect: StageEffect = {
      type: 'spotlight',
      sprite: container,
      age: 0,
      duration: 4,
      active: true,
    };
    this.effects.push(effect);
  }

  private spawnDiscoBall(): void {
    const container = new PIXI.Container();
    container.x = this.canvasW / 2;
    container.y = 30;

    // Ball
    const ball = new PIXI.Graphics();
    ball.beginFill(0xCCCCCC, 0.9);
    ball.drawCircle(0, 0, 18);
    ball.endFill();
    // Facets
    ball.lineStyle(1, 0x888888, 0.5);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ball.moveTo(0, 0);
      ball.lineTo(Math.cos(a) * 18, Math.sin(a) * 18);
    }
    container.addChild(ball);

    // Sparkle rays (updated each frame via the effect age)
    const rays = new PIXI.Graphics();
    container.addChild(rays);

    this.layer.addChild(container);

    const effect: StageEffect = {
      type: 'discoBall',
      sprite: container,
      age: 0,
      duration: 5,
      active: true,
    };
    this.effects.push(effect);
  }

  private spawnHypeTrain(): void {
    const label = new PIXI.Text('🚂💨', {
      fontSize: 36,
      fontFamily: 'Segoe UI Emoji, Apple Color Emoji, sans-serif',
    });
    label.anchor.set(0, 0.5);
    label.x = this.canvasW + 10;
    label.y = this.canvasH * 0.82;

    this.layer.addChild(label);

    const effect: StageEffect = {
      type: 'hypeTrain',
      sprite: label,
      age: 0,
      duration: 2.5,
      active: true,
    };
    this.effects.push(effect);
  }

  private spawnConfetti(): void {
    const container = new PIXI.Container();
    const confettiColors = [0xFF6B6B, 0xFFE66D, 0x6BCB77, 0x4D96FF, 0xFF9FF3, 0xFFA502];
    const pieces: Array<{ gfx: PIXI.Graphics; vx: number; vy: number; spin: number }> = [];

    for (let i = 0; i < 24; i++) {
      const g = new PIXI.Graphics();
      g.beginFill(confettiColors[i % confettiColors.length], 0.9);
      g.drawRect(-4, -3, 8, 6);
      g.endFill();
      g.x = Math.random() * this.canvasW;
      g.y = -10;
      container.addChild(g);
      pieces.push({
        gfx: g,
        vx: (Math.random() - 0.5) * 60,
        vy: 80 + Math.random() * 80,
        spin: (Math.random() - 0.5) * 4,
      });
    }

    this.layer.addChild(container);

    const effect: StageEffect & { pieces: typeof pieces } = {
      type: 'confetti',
      sprite: container,
      age: 0,
      duration: 3,
      active: true,
      pieces,
    };
    // Cast needed because the interface doesn't know about `pieces`
    this.effects.push(effect as StageEffect);
  }

  private updateEffects(dt: number): void {
    const toRemove: StageEffect[] = [];

    for (const e of this.effects) {
      if (!e.active) continue;
      e.age += dt;

      if (e.age >= e.duration) {
        e.active = false;
        toRemove.push(e);
        continue;
      }

      const progress = e.age / e.duration;
      const fadeOut = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;

      switch (e.type) {
        case 'spotlight':
          e.sprite.alpha = fadeOut * 1;
          break;

        case 'discoBall': {
          e.sprite.rotation += dt * 1.5;
          e.sprite.alpha = fadeOut;
          // Animate sparkle rays in second child
          const rays = e.sprite.children[1] as PIXI.Graphics;
          rays.clear();
          const numRays = 12;
          for (let i = 0; i < numRays; i++) {
            const a = (i / numRays) * Math.PI * 2 + e.age * 3;
            const len = 40 + Math.random() * 30;
            rays.lineStyle(1.5, 0xFFFFFF, 0.5 * fadeOut);
            rays.moveTo(0, 0);
            rays.lineTo(Math.cos(a) * len, Math.sin(a) * len);
          }
          break;
        }

        case 'hypeTrain': {
          // Slide from right to left
          const label = e.sprite;
          label.x = this.canvasW + 10 - (this.canvasW + 120) * (e.age / e.duration);
          label.alpha = fadeOut;
          break;
        }

        case 'confetti': {
          const eff = e as StageEffect & { pieces: Array<{ gfx: PIXI.Graphics; vx: number; vy: number; spin: number }> };
          for (const p of eff.pieces) {
            p.gfx.x += p.vx * dt;
            p.gfx.y += p.vy * dt;
            p.gfx.rotation += p.spin * dt;
          }
          e.sprite.alpha = fadeOut;
          break;
        }
      }
    }

    // Remove and clean up finished effects
    for (const e of toRemove) {
      if (e.sprite.parent) e.sprite.parent.removeChild(e.sprite);
      this.effects = this.effects.filter(x => x !== e);
    }
  }
}
