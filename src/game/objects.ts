import * as PIXI from 'pixi.js';
import Matter from 'matter-js';
import { PhysicsObjectType, PhysicsObjectDef, PHYSICS_OBJECTS } from '@/types';
import { eventBus } from './engine';

// ─── Physics + Visual Object ──────────────────────────────────────────────────

export interface DroppedObject {
  id: string;
  type: PhysicsObjectType;
  def: PhysicsObjectDef;
  body: Matter.Body;
  sprite: PIXI.Container;
  alive: boolean;
  age: number; // seconds on screen
  hasHitCharacter: boolean;
}

let _idCounter = 0;

// ─── Object Factory ───────────────────────────────────────────────────────────

function createSprite(def: PhysicsObjectDef): PIXI.Container {
  const container = new PIXI.Container();

  const g = new PIXI.Graphics();
  const r = def.radius;

  switch (def.type) {
    case 'beachball': {
      g.beginFill(0xff2244);
      g.drawCircle(0, 0, r);
      g.endFill();
      // Stripes
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI;
        g.lineStyle(3, 0xffffff, 0.5);
        g.moveTo(-r * Math.cos(a), -r * Math.sin(a));
        g.lineTo(r * Math.cos(a), r * Math.sin(a));
      }
      g.lineStyle(0);
      break;
    }

    case 'anvil': {
      g.beginFill(0x555566);
      g.drawRect(-r * 0.6, -r * 0.7, r * 1.2, r * 0.9);
      g.beginFill(0x444455);
      g.drawRect(-r, -r * 0.3, r * 2, r * 0.6);
      g.endFill();
      // Horn
      g.beginFill(0x555566);
      g.drawPolygon([0, -r * 0.7, r * 0.8, -r * 0.7, r * 0.3, -r * 1.1]);
      g.endFill();
      // Shadow
      g.beginFill(0x222233, 0.4);
      g.drawEllipse(0, r * 0.35, r * 1.1, r * 0.25);
      g.endFill();
      break;
    }

    case 'duck': {
      // Body
      g.beginFill(0xffd93d);
      g.drawEllipse(0, r * 0.15, r * 0.85, r * 0.7);
      g.endFill();
      // Head
      g.beginFill(0xffd93d);
      g.drawCircle(-r * 0.3, -r * 0.35, r * 0.45);
      g.endFill();
      // Bill
      g.beginFill(0xff9900);
      g.drawEllipse(-r * 0.72, -r * 0.33, r * 0.28, r * 0.14);
      g.endFill();
      // Eye
      g.beginFill(0x111111);
      g.drawCircle(-r * 0.42, -r * 0.44, r * 0.08);
      g.endFill();
      // Wing
      g.beginFill(0xffbb00);
      g.drawEllipse(r * 0.1, 0, r * 0.5, r * 0.3);
      g.endFill();
      break;
    }

    case 'pillows': {
      // Stack of two pillows
      g.beginFill(0xe8d5f5);
      g.drawRoundedRect(-r, r * 0.05, r * 2, r * 0.85, 14);
      g.endFill();
      g.beginFill(0xd4b8f0);
      g.drawRoundedRect(-r * 0.9, -r * 0.95, r * 1.8, r * 0.9, 14);
      g.endFill();
      // Pillow crease lines
      for (const py of [0.3, -0.55]) {
        g.lineStyle(1.5, 0xb89ed4, 0.6);
        g.moveTo(-r * 0.7, r * py);
        g.lineTo(r * 0.7, r * py);
      }
      g.lineStyle(0);
      break;
    }

    case 'taco': {
      // Shell
      g.beginFill(0xf4a261);
      g.arc(0, r * 0.2, r * 1.05, Math.PI * 1.15, Math.PI * 1.85);
      g.closePath();
      g.endFill();
      // Filling
      g.beginFill(0x6bcb77);
      g.drawEllipse(0, -r * 0.2, r * 0.8, r * 0.3);
      g.endFill();
      g.beginFill(0xe63946);
      g.drawEllipse(-r * 0.2, -r * 0.05, r * 0.4, r * 0.2);
      g.endFill();
      g.beginFill(0xffe66d);
      g.drawEllipse(r * 0.25, -r * 0.1, r * 0.35, r * 0.18);
      g.endFill();
      break;
    }

    case 'watermelon': {
      // Green rind
      g.beginFill(0x338a3e);
      g.drawCircle(0, 0, r);
      g.endFill();
      // Light stripe
      g.beginFill(0x5aaf47, 0.6);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.drawEllipse(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, 4, r * 0.6);
      }
      g.endFill();
      // Cut face showing red flesh
      g.beginFill(0xff4d6d);
      g.drawCircle(0, 0, r * 0.7);
      g.endFill();
      // Seeds
      g.beginFill(0x222222);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.drawEllipse(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35, 3, 6);
      }
      g.endFill();
      break;
    }

    case 'bowling': {
      g.beginFill(0x223366);
      g.drawCircle(0, 0, r);
      g.endFill();
      // Finger holes
      g.beginFill(0x111133);
      g.drawCircle(-6, -6, 4);
      g.drawCircle(4, -8, 4);
      g.drawCircle(-2, 5, 4);
      g.endFill();
      // Shine
      g.beginFill(0xffffff, 0.3);
      g.drawCircle(-7, -7, 6);
      g.endFill();
      break;
    }

    case 'feather': {
      g.beginFill(0xffcfef);
      g.moveTo(0, -r);
      g.bezierCurveTo(r * 0.5, -r * 0.3, r * 0.5, r * 0.3, 0, r);
      g.bezierCurveTo(-r * 0.5, r * 0.3, -r * 0.5, -r * 0.3, 0, -r);
      g.endFill();
      // Quill
      g.lineStyle(1, 0xd48abf);
      g.moveTo(0, -r);
      g.lineTo(0, r);
      g.lineStyle(0);
      break;
    }
  }

  // Emoji label (small, above object)
  const label = new PIXI.Text(def.emoji, {
    fontSize: Math.round(r * 1.3),
    fontFamily: 'Segoe UI Emoji, Apple Color Emoji, sans-serif',
  });
  label.anchor.set(0.5);
  label.alpha = 0.85;

  container.addChild(label);
  container.addChild(g);
  // Put emoji on top
  label.zIndex = 10;
  g.zIndex = 5;

  return container;
}

// ─── Object Manager ───────────────────────────────────────────────────────────

export const MAX_OBJECTS = 12;
export const DESPAWN_SECONDS = 8;

export class ObjectManager {
  private objects: DroppedObject[] = [];
  private world: Matter.World;
  private stage: PIXI.Container;
  private characterX = 0;
  private characterY = 0;

  constructor(world: Matter.World, stage: PIXI.Container) {
    this.world = world;
    this.stage = stage;
  }

  setCharacterPosition(x: number, y: number): void {
    this.characterX = x;
    this.characterY = y;
  }

  drop(type: PhysicsObjectType, screenWidth: number, _screenHeight: number): DroppedObject | null {
    if (this.objects.length >= MAX_OBJECTS) return null;

    const def = PHYSICS_OBJECTS[type];
    const id = `obj_${_idCounter++}`;

    // Random X within middle zone, Y at top
    const minX = screenWidth * 0.2;
    const maxX = screenWidth * 0.8;
    const x = minX + Math.random() * (maxX - minX);
    const y = -def.radius * 2;

    const body = Matter.Bodies.circle(x, y, def.radius, {
      mass: def.mass,
      restitution: def.restitution,
      friction: def.friction,
      label: `obj_${type}_${id}`,
      frictionAir: 0.02,
    });

    // Random initial spin
    Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.3);
    // Slight horizontal push toward character
    const vx = (this.characterX - x) * 0.005;
    Matter.Body.setVelocity(body, { x: vx, y: 1 });

    Matter.World.add(this.world, body);

    const sprite = createSprite(def);
    sprite.position.set(x, y);
    this.stage.addChild(sprite);

    const obj: DroppedObject = {
      id,
      type,
      def,
      body,
      sprite,
      alive: true,
      age: 0,
      hasHitCharacter: false,
    };

    this.objects.push(obj);
    eventBus.emit('object_drop', { type, id });
    return obj;
  }

  update(dt: number, canvasHeight: number): void {
    for (const obj of this.objects) {
      if (!obj.alive) continue;

      obj.age += dt;

      // Sync visual to physics
      obj.sprite.position.set(obj.body.position.x, obj.body.position.y);
      obj.sprite.rotation = obj.body.angle;

      // Despawn if off screen or too old
      if (obj.body.position.y > canvasHeight + 100 || obj.age > DESPAWN_SECONDS) {
        this.despawn(obj);
      }
    }

    // Remove dead objects
    const alive = this.objects.filter(o => o.alive);
    this.objects = alive;
  }

  despawn(obj: DroppedObject): void {
    obj.alive = false;
    Matter.World.remove(this.world, obj.body);
    if (obj.sprite.parent) {
      obj.sprite.parent.removeChild(obj.sprite);
    }
    eventBus.emit('object_despawn', { id: obj.id, type: obj.type });
  }

  clearAll(): void {
    for (const obj of this.objects) {
      obj.alive = false;
      Matter.World.remove(this.world, obj.body);
      if (obj.sprite.parent) {
        obj.sprite.parent.removeChild(obj.sprite);
      }
    }
    this.objects = [];
  }

  get activeObjects(): DroppedObject[] {
    return this.objects.filter(o => o.alive);
  }

  get count(): number {
    return this.objects.filter(o => o.alive).length;
  }
}
