import * as PIXI from 'pixi.js';
import {
  CustomizationData,
  DanceMoveId,
  Joint,
  createJoint,
  updateJoint,
  SkinTone,
  TapZone,
  HitRating,
} from '@/types';

// ─── Skin tone palette ────────────────────────────────────────────────────────

const SKIN_TONES: Record<SkinTone, number> = {
  light: 0xfde8d0,
  'medium-light': 0xf4c89a,
  medium: 0xd4935a,
  'medium-dark': 0xa05a2c,
  dark: 0x5c3317,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

// ─── Joint Rig ────────────────────────────────────────────────────────────────

interface CharacterJoints {
  // Arms
  leftShoulder: Joint;
  leftElbow: Joint;
  rightShoulder: Joint;
  rightElbow: Joint;
  // Legs
  leftHip: Joint;
  leftKnee: Joint;
  rightHip: Joint;
  rightKnee: Joint;
  // Body
  torsoTilt: Joint;
  headBob: Joint;
}

function defaultJoints(): CharacterJoints {
  return {
    leftShoulder: createJoint(-0.3, 0.12, 0.65),
    leftElbow: createJoint(0.4, 0.1, 0.7),
    rightShoulder: createJoint(0.3, 0.12, 0.65),
    rightElbow: createJoint(-0.4, 0.1, 0.7),
    leftHip: createJoint(-0.15, 0.1, 0.7),
    leftKnee: createJoint(0.2, 0.08, 0.75),
    rightHip: createJoint(0.15, 0.1, 0.7),
    rightKnee: createJoint(-0.2, 0.08, 0.75),
    torsoTilt: createJoint(0, 0.08, 0.7),
    headBob: createJoint(0, 0.05, 0.8),
  };
}

// ─── Zone → Joint mapping ─────────────────────────────────────────────────────

const ZONE_TO_JOINTS: Record<TapZone, Array<keyof CharacterJoints>> = {
  'upper-left':   ['leftShoulder', 'leftElbow'],
  'upper-center': ['torsoTilt', 'headBob'],
  'upper-right':  ['rightShoulder', 'rightElbow'],
  'lower-left':   ['leftHip', 'leftKnee'],
  'lower-center': ['leftHip', 'rightHip'],
  'lower-right':  ['rightHip', 'rightKnee'],
};

// ─── Dance Animation Definitions ──────────────────────────────────────────────

type JointKey = keyof CharacterJoints;

interface DanceFrame {
  joints: Partial<Record<JointKey, number>>;
  duration: number;
}

type DanceAnimation = DanceFrame[];

// IDLE_ANIM: handled inline via default switch branch
const _IDLE_ANIM: DanceAnimation = [{ joints: {}, duration: 1000 }];
void _IDLE_ANIM;

function getWiggleAnim(t: number): Partial<Record<JointKey, number>> {
  const s = Math.sin(t * 4);
  const c = Math.cos(t * 3);
  return {
    torsoTilt: s * 0.25,
    leftShoulder: -0.3 + s * 0.4,
    rightShoulder: 0.3 - s * 0.4,
    leftHip: -0.15 + c * 0.2,
    rightHip: 0.15 - c * 0.2,
    headBob: s * 0.1,
  };
}

function getRobotAnim(t: number): Partial<Record<JointKey, number>> {
  const step = Math.floor(t * 3) % 2 === 0 ? 1 : -1;
  return {
    torsoTilt: 0,
    leftShoulder: step * -0.5,
    rightShoulder: step * 0.5,
    leftElbow: Math.PI / 3,
    rightElbow: -Math.PI / 3,
    leftHip: step * -0.4,
    rightHip: step * 0.4,
    headBob: 0,
  };
}

function getWormAnim(t: number): Partial<Record<JointKey, number>> {
  const s = Math.sin(t * 5);
  return {
    torsoTilt: s * 0.5,
    leftShoulder: -0.8 + s * 0.4,
    rightShoulder: 0.8 - s * 0.4,
    leftElbow: 0.6,
    rightElbow: -0.6,
    leftHip: -0.6 + s * 0.3,
    rightHip: 0.6 - s * 0.3,
    leftKnee: 0.8,
    rightKnee: -0.8,
    headBob: s * 0.3,
  };
}

function getFlailAnim(t: number): Partial<Record<JointKey, number>> {
  return {
    torsoTilt: Math.sin(t * 7 + 1) * 0.3,
    leftShoulder: Math.sin(t * 6) * 1.2,
    leftElbow: Math.cos(t * 5) * 0.8,
    rightShoulder: Math.cos(t * 7) * 1.2,
    rightElbow: Math.sin(t * 6) * 0.8,
    leftHip: Math.sin(t * 5) * 0.4,
    rightHip: Math.cos(t * 5) * 0.4,
    headBob: Math.sin(t * 8) * 0.2,
  };
}

function getSpinAnim(t: number): Partial<Record<JointKey, number>> {
  const s = Math.sin(t * 8);
  return {
    torsoTilt: s * 0.15,
    leftShoulder: -Math.PI / 2,
    rightShoulder: Math.PI / 2,
    leftElbow: 0,
    rightElbow: 0,
    leftHip: -0.4,
    rightHip: 0.4,
    headBob: s * 0.05,
  };
}

// ─── Character ────────────────────────────────────────────────────────────────

export class Character {
  public container: PIXI.Container;
  private joints: CharacterJoints;
  private customization: CustomizationData;
  private graphics: {
    head: PIXI.Graphics;
    hairBack: PIXI.Graphics;
    hair: PIXI.Graphics;
    hat: PIXI.Graphics;
    glasses: PIXI.Graphics;
    leftUpperArm: PIXI.Graphics;
    leftLowerArm: PIXI.Graphics;
    rightUpperArm: PIXI.Graphics;
    rightLowerArm: PIXI.Graphics;
    torso: PIXI.Graphics;
    neck: PIXI.Graphics;
    leftUpperLeg: PIXI.Graphics;
    leftLowerLeg: PIXI.Graphics;
    rightUpperLeg: PIXI.Graphics;
    rightLowerLeg: PIXI.Graphics;
    leftShoe: PIXI.Graphics;
    rightShoe: PIXI.Graphics;
    // Joint connector dots
    leftShoulderDot: PIXI.Graphics;
    rightShoulderDot: PIXI.Graphics;
    leftElbowDot: PIXI.Graphics;
    rightElbowDot: PIXI.Graphics;
    leftHipDot: PIXI.Graphics;
    rightHipDot: PIXI.Graphics;
    leftKneeDot: PIXI.Graphics;
    rightKneeDot: PIXI.Graphics;
    reactionBubble: PIXI.Container;
    reactionText: PIXI.Text;
  };

  private currentMove: DanceMoveId = 'idle';
  private moveTime = 0;
  private reactionTimer = 0;
  private wobbleIntensity = 0;
  private isSpinning = false;
  private spinAngle = 0;

  // Proportions (px, character is ~200px tall at design size)
  private readonly HEAD_R = 26;
  private readonly TORSO_H = 60;
  private readonly TORSO_W = 36;
  private readonly ARM_LEN = 40;
  private readonly FOREARM_LEN = 35;
  private readonly LEG_LEN = 48;
  private readonly SHIN_LEN = 44;
  private readonly LIMB_W = 12;

  constructor(customization: CustomizationData) {
    this.customization = { ...customization };
    this.joints = defaultJoints();
    this.container = new PIXI.Container();

    this.graphics = this.createGraphics();
    this.buildCharacter();
    this.applyCustomization();
  }

  private createGraphics() {
    const g = (alpha = 1): PIXI.Graphics => {
      const gr = new PIXI.Graphics();
      gr.alpha = alpha;
      return gr;
    };

    const bubbleContainer = new PIXI.Container();
    const bubbleBg = new PIXI.Graphics();
    bubbleContainer.addChild(bubbleBg);
    const reactionText = new PIXI.Text('', {
      fontSize: 28,
      fontFamily: 'Segoe UI Emoji',
    });
    reactionText.anchor.set(0.5);
    bubbleContainer.addChild(reactionText);
    bubbleContainer.alpha = 0;

    return {
      head: g(),
      hairBack: g(),
      hair: g(),
      hat: g(),
      glasses: g(),
      leftUpperArm: g(),
      leftLowerArm: g(),
      rightUpperArm: g(),
      rightLowerArm: g(),
      torso: g(),
      neck: g(),
      leftUpperLeg: g(),
      leftLowerLeg: g(),
      rightUpperLeg: g(),
      rightLowerLeg: g(),
      leftShoe: g(),
      rightShoe: g(),
      leftShoulderDot: g(),
      rightShoulderDot: g(),
      leftElbowDot: g(),
      rightElbowDot: g(),
      leftHipDot: g(),
      rightHipDot: g(),
      leftKneeDot: g(),
      rightKneeDot: g(),
      reactionBubble: bubbleContainer,
      reactionText,
    };
  }

  private buildCharacter(): void {
    // Order matters for layering (back to front)
    const { container: c } = this;

    // Back arms (behind torso)
    c.addChild(this.graphics.leftUpperArm);
    c.addChild(this.graphics.leftLowerArm);

    // Legs (behind torso)
    c.addChild(this.graphics.rightUpperLeg);
    c.addChild(this.graphics.rightLowerLeg);
    c.addChild(this.graphics.rightShoe);
    c.addChild(this.graphics.leftUpperLeg);
    c.addChild(this.graphics.leftLowerLeg);
    c.addChild(this.graphics.leftShoe);

    // Hair back
    c.addChild(this.graphics.hairBack);

    // Torso
    c.addChild(this.graphics.torso);

    // Neck (between torso and head)
    c.addChild(this.graphics.neck);

    // Front arms
    c.addChild(this.graphics.rightUpperArm);
    c.addChild(this.graphics.rightLowerArm);

    // Joint connector dots (on top of all limbs)
    c.addChild(this.graphics.leftShoulderDot);
    c.addChild(this.graphics.rightShoulderDot);
    c.addChild(this.graphics.leftElbowDot);
    c.addChild(this.graphics.rightElbowDot);
    c.addChild(this.graphics.leftHipDot);
    c.addChild(this.graphics.rightHipDot);
    c.addChild(this.graphics.leftKneeDot);
    c.addChild(this.graphics.rightKneeDot);

    // Head, hair, accessories
    c.addChild(this.graphics.head);
    c.addChild(this.graphics.hair);
    c.addChild(this.graphics.hat);
    c.addChild(this.graphics.glasses);

    // Reaction bubble (always on top)
    c.addChild(this.graphics.reactionBubble);
  }

  applyCustomization(cust?: Partial<CustomizationData>): void {
    if (cust) {
      this.customization = { ...this.customization, ...cust };
    }
    this.redrawAll();
  }

  private redrawAll(): void {
    const c = this.customization;
    const skinColor = SKIN_TONES[c.skinTone];
    const hairColor = hexToNum(c.hairColor);
    const topColor = hexToNum(c.topColor);
    const bottomColor = hexToNum(c.bottomColor);
    const shoeColor = hexToNum(c.shoeColor);
    const hatColor = hexToNum(c.hatColor);
    const glassesColor = hexToNum(c.glassesColor);

    const R = this.HEAD_R;
    const TW = this.TORSO_W;
    const TH = this.TORSO_H;
    const LW = this.LIMB_W;

    // ── Head ──────────────────────────────────────────────────────────────────
    const h = this.graphics.head;
    h.clear();
    h.beginFill(skinColor);
    if (c.faceShape === 'round') {
      h.drawCircle(0, 0, R);
    } else if (c.faceShape === 'oval') {
      h.drawEllipse(0, 0, R * 0.8, R);
    } else {
      h.drawRoundedRect(-R * 0.85, -R, R * 1.7, R * 2, 6);
    }
    h.endFill();

    // Eyes
    h.beginFill(0xffffff);
    h.drawCircle(-9, -4, 7);
    h.drawCircle(9, -4, 7);
    h.endFill();
    h.beginFill(0x222222);
    h.drawCircle(-9, -4, 4);
    h.drawCircle(9, -4, 4);
    h.endFill();
    // Eye shine
    h.beginFill(0xffffff);
    h.drawCircle(-7, -6, 2);
    h.drawCircle(11, -6, 2);
    h.endFill();

    // Eyebrows (two short diagonal lines above eyes)
    h.lineStyle(2.5, 0x333333, 0.6);
    h.moveTo(-15, -13);
    h.lineTo(-4, -15);
    h.moveTo(4, -15);
    h.lineTo(15, -13);
    h.lineStyle(0);

    // Nose (small skin-toned ellipse at center of face)
    h.beginFill(skinColor, 0.75);
    h.drawEllipse(0, 3, 3, 5);
    h.endFill();
    // Nostril hint
    h.beginFill(0x333333, 0.2);
    h.drawCircle(-2.5, 5, 1.8);
    h.drawCircle(2.5, 5, 1.8);
    h.endFill();

    // Mouth (smile)
    h.lineStyle(2.5, 0x333333);
    h.arc(0, 8, 9, 0.3, Math.PI - 0.3);
    h.lineStyle(0);

    // ── Hair ──────────────────────────────────────────────────────────────────
    this.drawHair(hairColor, skinColor, R);

    // ── Hat ───────────────────────────────────────────────────────────────────
    this.drawHat(hatColor, c.hat, R);

    // ── Glasses ───────────────────────────────────────────────────────────────
    this.drawGlasses(glassesColor, c.glasses, R);

    // ── Neck ──────────────────────────────────────────────────────────────────
    const neck = this.graphics.neck;
    neck.clear();
    neck.beginFill(skinColor);
    neck.drawRoundedRect(-5, 0, 10, 14, 3);
    neck.endFill();

    // ── Torso (tapered trapezoid) ──────────────────────────────────────────────
    const torso = this.graphics.torso;
    torso.clear();
    torso.beginFill(topColor);
    const topW = TW * 1.15;
    const botW = TW * 0.82;
    torso.drawPolygon([
      -topW / 2, 0,
       topW / 2, 0,
       botW / 2, TH,
      -botW / 2, TH,
    ]);
    torso.endFill();

    // Collar detail
    torso.beginFill(skinColor, 0.6);
    torso.drawEllipse(0, 4, 8, 6);
    torso.endFill();

    // ── Arms ──────────────────────────────────────────────────────────────────
    for (const side of ['left', 'right'] as const) {
      const ua = this.graphics[`${side}UpperArm`];
      const la = this.graphics[`${side}LowerArm`];
      ua.clear();
      la.clear();

      // Upper arm (sleeve color)
      ua.beginFill(topColor);
      ua.drawRoundedRect(-LW / 2, 0, LW, this.ARM_LEN, LW / 2);
      ua.endFill();

      // Lower arm (skin)
      la.beginFill(skinColor);
      la.drawRoundedRect(-LW / 2, 0, LW, this.FOREARM_LEN, LW / 2);
      la.endFill();
    }

    // ── Legs ──────────────────────────────────────────────────────────────────
    for (const side of ['left', 'right'] as const) {
      const ul = this.graphics[`${side}UpperLeg`];
      const ll = this.graphics[`${side}LowerLeg`];
      const sh = this.graphics[`${side}Shoe`];
      ul.clear();
      ll.clear();
      sh.clear();

      ul.beginFill(bottomColor);
      ul.drawRoundedRect(-LW / 2, 0, LW, this.LEG_LEN, LW / 2);
      ul.endFill();

      ll.beginFill(bottomColor);
      ll.drawRoundedRect(-LW / 2, 0, LW, this.SHIN_LEN, LW / 2);
      ll.endFill();

      // Shoe
      sh.beginFill(shoeColor);
      const sx = side === 'left' ? -3 : 3;
      sh.drawEllipse(sx, 0, LW, 7);
      sh.endFill();
    }

    // ── Joint connector dots ──────────────────────────────────────────────────
    for (const dot of [this.graphics.leftShoulderDot, this.graphics.rightShoulderDot]) {
      dot.clear();
      dot.beginFill(topColor);
      dot.drawCircle(0, 0, 7);
      dot.endFill();
    }
    for (const dot of [this.graphics.leftElbowDot, this.graphics.rightElbowDot]) {
      dot.clear();
      dot.beginFill(topColor, 0.85);
      dot.drawCircle(0, 0, 5);
      dot.endFill();
    }
    for (const dot of [this.graphics.leftHipDot, this.graphics.rightHipDot]) {
      dot.clear();
      dot.beginFill(bottomColor);
      dot.drawCircle(0, 0, 7);
      dot.endFill();
    }
    for (const dot of [this.graphics.leftKneeDot, this.graphics.rightKneeDot]) {
      dot.clear();
      dot.beginFill(bottomColor, 0.85);
      dot.drawCircle(0, 0, 5);
      dot.endFill();
    }
  }

  private drawHair(color: number, _skinColor: number, R: number): void {
    const h = this.graphics.hair;
    const hb = this.graphics.hairBack;
    h.clear();
    hb.clear();
    const style = this.customization.hairStyle;

    if (style === 'none') return;

    h.beginFill(color);
    hb.beginFill(color);

    switch (style) {
      case 'short':
        h.drawEllipse(0, -R * 0.85, R * 0.9, R * 0.45);
        break;
      case 'medium':
        h.drawEllipse(0, -R * 0.7, R * 1.05, R * 0.6);
        // Side pieces
        h.drawRoundedRect(-R * 1.05, -R * 0.4, R * 0.35, R * 0.9, 6);
        h.drawRoundedRect(R * 0.7, -R * 0.4, R * 0.35, R * 0.9, 6);
        break;
      case 'long':
        h.drawEllipse(0, -R * 0.7, R * 1.05, R * 0.6);
        hb.drawRoundedRect(-R * 1.05, -R * 0.8, R * 2.1, R * 2.2, 8);
        break;
      case 'afro':
        h.drawCircle(0, -R * 0.3, R * 1.25);
        break;
      case 'bun': {
        h.drawEllipse(0, -R * 0.7, R * 1.05, R * 0.6);
        // Bun on top
        h.drawCircle(0, -R * 1.2, R * 0.45);
        break;
      }
      case 'spiky': {
        // Spiky hair via triangles
        const points = 7;
        for (let i = 0; i < points; i++) {
          const a = ((i / points) * Math.PI) + Math.PI;
          const px = Math.cos(a) * R * 1.0;
          const py = Math.sin(a) * R * 1.0;
          const tipX = Math.cos(a) * R * 1.65;
          const tipY = Math.sin(a) * R * 1.65;
          const la = a - 0.15;
          const ra = a + 0.15;
          h.moveTo(Math.cos(la) * R * 0.95, Math.sin(la) * R * 0.95);
          h.lineTo(tipX, tipY);
          h.lineTo(Math.cos(ra) * R * 0.95, Math.sin(ra) * R * 0.95);
          h.lineTo(px, py);
          h.closePath();
        }
        break;
      }
    }
    h.endFill();
    hb.endFill();
  }

  private drawHat(color: number, style: string, R: number): void {
    const g = this.graphics.hat;
    g.clear();
    if (style === 'none') return;

    g.beginFill(color);
    switch (style) {
      case 'cap':
        // Brim
        g.drawEllipse(8, -R * 1.1, R * 1.4, R * 0.35);
        // Crown
        g.drawRoundedRect(-R * 0.9, -R * 1.7, R * 1.8, R * 0.65, 4);
        break;
      case 'tophat':
        g.drawRoundedRect(-R * 0.75, -R * 2.1, R * 1.5, R * 1.0, 3);
        g.drawRect(-R * 1.1, -R * 1.15, R * 2.2, R * 0.28);
        break;
      case 'beanie':
        g.drawEllipse(0, -R * 0.9, R * 1.05, R * 0.7);
        g.drawRoundedRect(-R * 0.95, -R * 1.5, R * 1.9, R * 0.7, 6);
        break;
      case 'cowboy':
        g.drawEllipse(0, -R * 1.1, R * 1.7, R * 0.35);
        g.drawEllipse(0, -R * 1.5, R * 0.9, R * 0.65);
        g.drawRoundedRect(-R * 0.85, -R * 1.95, R * 1.7, R * 0.5, 4);
        break;
    }
    g.endFill();
  }

  private drawGlasses(color: number, style: string, _R: number): void {
    const g = this.graphics.glasses;
    g.clear();
    if (style === 'none') return;

    g.lineStyle(2.5, color);

    switch (style) {
      case 'round':
        g.drawCircle(-9, -4, 7);
        g.drawCircle(9, -4, 7);
        g.moveTo(-2, -4);
        g.lineTo(2, -4);
        break;
      case 'square':
        g.drawRect(-17, -11, 14, 14);
        g.drawRect(3, -11, 14, 14);
        g.moveTo(-3, -4);
        g.lineTo(3, -4);
        break;
      case 'heart':
        g.lineStyle(0);
        g.beginFill(color, 0.7);
        // simple heart approximation
        for (const sx of [-1, 1]) {
          g.drawCircle(sx * 12 - 3.5, -5, 5);
        }
        g.drawPolygon([-17, -3, 0, 8, 17, -3]);
        g.endFill();
        break;
      case 'shades':
        g.lineStyle(0);
        g.beginFill(color, 0.8);
        g.drawEllipse(-9, -4, 9, 6);
        g.drawEllipse(9, -4, 9, 6);
        g.endFill();
        break;
    }

    g.lineStyle(0);
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  update(dt: number): void {
    this.moveTime += dt;
    this.reactionTimer = Math.max(0, this.reactionTimer - dt);
    this.wobbleIntensity = Math.max(0, this.wobbleIntensity - dt * 2);

    // Apply dance animation targets
    this.applyMoveTargets();

    // Add wobble noise
    if (this.wobbleIntensity > 0.01) {
      const w = this.wobbleIntensity;
      this.joints.torsoTilt.velocity += (Math.random() - 0.5) * w * 0.5;
      this.joints.leftShoulder.velocity += (Math.random() - 0.5) * w * 0.4;
      this.joints.rightShoulder.velocity += (Math.random() - 0.5) * w * 0.4;
    }

    // Spring physics on all joints
    for (const key of Object.keys(this.joints) as Array<keyof CharacterJoints>) {
      updateJoint(this.joints[key], dt);
    }

    // Spin state
    if (this.currentMove === 'spin') {
      this.spinAngle += dt * 5;
    } else {
      this.spinAngle = 0;
    }

    // Reaction bubble fade
    const bubble = this.graphics.reactionBubble;
    if (this.reactionTimer > 0) {
      bubble.alpha = Math.min(1, this.reactionTimer * 3);
    } else {
      bubble.alpha = Math.max(0, bubble.alpha - dt * 3);
    }

    // Redraw skeleton positions
    this.updatePose();
  }

  private applyMoveTargets(): void {
    const t = this.moveTime;
    let targets: Partial<Record<keyof CharacterJoints, number>>;

    switch (this.currentMove) {
      case 'wiggle':
        targets = getWiggleAnim(t);
        break;
      case 'robot':
        targets = getRobotAnim(t);
        break;
      case 'worm':
        targets = getWormAnim(t);
        break;
      case 'flail':
        targets = getFlailAnim(t);
        break;
      case 'spin':
        targets = getSpinAnim(t);
        break;
      default:
        // Gentle idle sway
        targets = {
          torsoTilt: Math.sin(t * 1.2) * 0.04,
          leftShoulder: -0.3 + Math.sin(t * 1.1) * 0.05,
          rightShoulder: 0.3 + Math.sin(t * 0.9) * 0.05,
          headBob: Math.sin(t * 1.5) * 0.04,
        };
    }

    for (const [key, val] of Object.entries(targets)) {
      const joint = this.joints[key as keyof CharacterJoints];
      if (joint) {
        joint.target = val as number;
      }
    }
  }

  private updatePose(): void {
    const j = this.joints;
    const R = this.HEAD_R;
    const TW = this.TORSO_W;
    const TH = this.TORSO_H;
    const AL = this.ARM_LEN;
    const FL = this.FOREARM_LEN;
    const LL = this.LEG_LEN;
    const SL = this.SHIN_LEN;

    const torsoTilt = j.torsoTilt.angle;

    // Torso
    const torso = this.graphics.torso;
    torso.position.set(0, -TH / 2);
    torso.rotation = torsoTilt;

    // Neck (sits between torso top and head)
    const neckX = Math.sin(torsoTilt) * 8;
    const neckY = -TH / 2 - 14;
    const neck = this.graphics.neck;
    neck.position.set(neckX, neckY);
    neck.rotation = torsoTilt;

    // Head center
    const headY = -TH / 2 - R - 2;
    const head = this.graphics.head;
    head.position.set(Math.sin(torsoTilt) * TH / 2, headY + j.headBob.angle * 10);
    head.rotation = j.headBob.angle * 0.5;

    // Hair and accessories follow head
    for (const g of [this.graphics.hair, this.graphics.hairBack, this.graphics.hat, this.graphics.glasses]) {
      g.position.copyFrom(head.position);
      g.rotation = head.rotation;
    }

    // Reaction bubble
    this.graphics.reactionBubble.position.set(head.x + 30, head.y - 40);

    // Shoulder anchor
    const shoulderX = 0;
    const shoulderY = -TH * 0.82;
    const shoulderOffsetX = Math.sin(torsoTilt) * 10;

    // Shoulder joint dots
    this.graphics.leftShoulderDot.position.set(
      shoulderX - TW / 2 + shoulderOffsetX,
      shoulderY + torsoTilt * 15
    );
    this.graphics.rightShoulderDot.position.set(
      shoulderX + TW / 2 + shoulderOffsetX,
      shoulderY + torsoTilt * 15
    );

    // Left arm
    const leftElbow = this.positionLimb(
      this.graphics.leftUpperArm,
      this.graphics.leftLowerArm,
      shoulderX - TW / 2,
      shoulderY + torsoTilt * 15,
      j.leftShoulder.angle + torsoTilt,
      j.leftElbow.angle,
      AL,
      FL
    );
    this.graphics.leftElbowDot.position.set(leftElbow.midX, leftElbow.midY);

    // Right arm
    const rightElbow = this.positionLimb(
      this.graphics.rightUpperArm,
      this.graphics.rightLowerArm,
      shoulderX + TW / 2,
      shoulderY + torsoTilt * 15,
      j.rightShoulder.angle + torsoTilt,
      j.rightElbow.angle,
      AL,
      FL
    );
    this.graphics.rightElbowDot.position.set(rightElbow.midX, rightElbow.midY);

    // Hip anchor
    const hipY = TH / 2;
    const hipOffset = TW * 0.28;

    // Hip joint dots
    this.graphics.leftHipDot.position.set(-hipOffset, hipY);
    this.graphics.rightHipDot.position.set(hipOffset, hipY);

    // Left leg
    const leftKnee = this.positionLimb(
      this.graphics.leftUpperLeg,
      this.graphics.leftLowerLeg,
      -hipOffset,
      hipY,
      j.leftHip.angle,
      j.leftKnee.angle,
      LL,
      SL,
      this.graphics.leftShoe
    );
    this.graphics.leftKneeDot.position.set(leftKnee.midX, leftKnee.midY);

    // Right leg
    const rightKnee = this.positionLimb(
      this.graphics.rightUpperLeg,
      this.graphics.rightLowerLeg,
      hipOffset,
      hipY,
      j.rightHip.angle,
      j.rightKnee.angle,
      LL,
      SL,
      this.graphics.rightShoe
    );
    this.graphics.rightKneeDot.position.set(rightKnee.midX, rightKnee.midY);

    // Full body spin (for spin move)
    if (this.currentMove === 'spin') {
      this.container.rotation = this.spinAngle;
    } else {
      this.container.rotation *= 0.85; // spring back
    }
  }

  private positionLimb(
    upper: PIXI.Graphics,
    lower: PIXI.Graphics,
    ox: number,
    oy: number,
    upperAngle: number,
    lowerAngle: number,
    upperLen: number,
    lowerLen: number,
    foot?: PIXI.Graphics
  ): { midX: number; midY: number } {
    upper.position.set(ox, oy);
    upper.rotation = upperAngle;

    const midX = ox + Math.sin(upperAngle) * upperLen;
    const midY = oy + Math.cos(upperAngle) * upperLen;

    lower.position.set(midX, midY);
    lower.rotation = upperAngle + lowerAngle;

    if (foot) {
      const footAngle = lower.rotation;
      const footX = midX + Math.sin(footAngle) * lowerLen;
      const footY = midY + Math.cos(footAngle) * lowerLen;
      foot.position.set(footX, footY);
      foot.rotation = 0;
    }

    return { midX, midY };
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  setDanceMove(move: DanceMoveId): void {
    if (this.currentMove !== move) {
      this.currentMove = move;
      this.moveTime = 0;
    }
  }

  /** Impulse specific joints based on which tap zone was hit */
  reactToZone(zone: TapZone, rating: HitRating): void {
    if (rating === 'miss') {
      // Small torso stumble
      this.joints.torsoTilt.velocity += (Math.random() - 0.5) * 0.4;
      this.joints.headBob.velocity += 0.2;
      return;
    }

    const jointKeys = ZONE_TO_JOINTS[zone];
    const intensity = rating === 'perfect' ? 1.4 : 0.8;

    for (const key of jointKeys) {
      const sign = Math.random() > 0.5 ? 1 : -1;
      this.joints[key].velocity += sign * intensity;
    }

    if (rating === 'perfect') {
      this.showReaction('✨');
    }
  }

  /** Impulse from a collision - wobble the character */
  wobble(intensity: number, direction: 'left' | 'right' | 'up' = 'up'): void {
    this.wobbleIntensity = Math.min(3, this.wobbleIntensity + intensity);
    const sign = direction === 'left' ? -1 : 1;

    this.joints.torsoTilt.velocity += sign * intensity * 0.8;
    this.joints.headBob.velocity += intensity * 0.5;
    if (direction === 'left') {
      this.joints.leftShoulder.velocity -= intensity * 0.6;
      this.joints.rightShoulder.velocity += intensity * 0.3;
    } else if (direction === 'right') {
      this.joints.rightShoulder.velocity -= intensity * 0.6;
      this.joints.leftShoulder.velocity += intensity * 0.3;
    } else {
      this.joints.leftShoulder.velocity += intensity * 0.5;
      this.joints.rightShoulder.velocity -= intensity * 0.5;
    }
  }

  showReaction(emoji: string): void {
    this.graphics.reactionText.text = emoji;
    this.reactionTimer = 1.5;
    this.graphics.reactionBubble.alpha = 1;
  }

  get currentMoveId(): DanceMoveId {
    return this.currentMove;
  }
}
