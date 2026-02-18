import * as PIXI from 'pixi.js';
import Matter from 'matter-js';
import { GameState, GameEventType, GameEvent } from '@/types';

// ─── Event Bus ────────────────────────────────────────────────────────────────

type EventListener<T = unknown> = (event: GameEvent<T>) => void;

class EventBus {
  private listeners = new Map<GameEventType, Set<EventListener>>();

  on<T>(type: GameEventType, listener: EventListener<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    const set = this.listeners.get(type);
    if (set) set.add(listener as EventListener);
    return () => this.listeners.get(type)?.delete(listener as EventListener);
  }

  emit<T>(type: GameEventType, data: T): void {
    const event: GameEvent<T> = { type, data, timestamp: performance.now() };
    this.listeners.get(type)?.forEach(fn => fn(event as GameEvent));
  }
}

export const eventBus = new EventBus();

// ─── Object Pool ──────────────────────────────────────────────────────────────

export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;

  constructor(factory: () => T, reset: (obj: T) => void, initialSize = 10) {
    this.factory = factory;
    this.reset = reset;
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  acquire(): T {
    const item = this.pool.pop();
    return item !== undefined ? item : this.factory();
  }

  release(obj: T): void {
    this.reset(obj);
    this.pool.push(obj);
  }

  get size(): number {
    return this.pool.length;
  }
}

// ─── Performance Monitor ──────────────────────────────────────────────────────

class PerfMonitor {
  private frameTimes: number[] = [];
  private lastTime = performance.now();
  private maxFrames = 30;
  public fps = 60;

  update(): void {
    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;
    this.frameTimes.push(delta);
    if (this.frameTimes.length > this.maxFrames) {
      this.frameTimes.shift();
    }
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.fps = Math.round(1000 / avg);
  }

  getQuality(): 'high' | 'medium' | 'low' {
    if (this.fps >= 50) return 'high';
    if (this.fps >= 30) return 'medium';
    return 'low';
  }
}

// ─── Game Engine ──────────────────────────────────────────────────────────────

export class GameEngine {
  public app!: PIXI.Application;
  public physicsEngine!: Matter.Engine;
  public physicsRunner!: Matter.Runner;
  public world!: Matter.World;
  public perfMonitor = new PerfMonitor();
  private _state!: GameState;
  private updateCallbacks: Array<(dt: number) => void> = [];
  private animFrameId = 0;
  private lastPhysicsTime = 0;
  private readonly PHYSICS_STEP = 1000 / 60; // fixed 16.67ms
  private boundHandleResize!: () => void;

  async init(container: HTMLElement, state: GameState): Promise<void> {
    this._state = state;

    // Determine canvas size
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;

    // PixiJS app
    this.app = new PIXI.Application({
      width: w,
      height: h,
      backgroundColor: 0x1a0533,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
      powerPreference: 'high-performance',
    });

    container.appendChild(this.app.view as HTMLCanvasElement);
    (this.app.view as HTMLCanvasElement).style.cssText =
      'width:100%;height:100%;display:block;touch-action:none;';

    // Matter.js
    this.physicsEngine = Matter.Engine.create({
      gravity: { x: 0, y: 1.5, scale: 0.001 },
    });
    this.world = this.physicsEngine.world;

    // Ground body (off-screen collision floor)
    const ground = Matter.Bodies.rectangle(w / 2, h + 30, w * 3, 60, {
      isStatic: true,
      label: 'ground',
      friction: 0.8,
      restitution: 0.3,
    });
    Matter.World.add(this.world, [ground]);

    // Handle resize
    this.boundHandleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.boundHandleResize);

    this.lastPhysicsTime = performance.now();
  }

  get state(): GameState {
    return this._state;
  }

  onUpdate(callback: (dt: number) => void): () => void {
    this.updateCallbacks.push(callback);
    return () => {
      this.updateCallbacks = this.updateCallbacks.filter(c => c !== callback);
    };
  }

  start(): void {
    const loop = (time: number) => {
      this.animFrameId = requestAnimationFrame(loop);
      this.perfMonitor.update();

      // Fixed timestep physics accumulator
      const elapsed = time - this.lastPhysicsTime;
      // clamp to avoid spiral of death
      const clampedElapsed = Math.min(elapsed, 100);
      const dt = clampedElapsed / 1000;
      this.lastPhysicsTime = time;

      Matter.Engine.update(this.physicsEngine, clampedElapsed);

      this.updateCallbacks.forEach(cb => cb(dt));
      this._state.fps = this.perfMonitor.fps;
      this._state.quality = this.perfMonitor.getQuality();
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.animFrameId);
  }

  private handleResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.app.renderer.resize(w, h);

    // Move ground
    const bodies = Matter.Composite.allBodies(this.world);
    const ground = bodies.find(b => b.label === 'ground');
    if (ground) {
      Matter.Body.setPosition(ground, { x: w / 2, y: h + 30 });
    }
  }

  destroy(): void {
    this.stop();
    window.removeEventListener('resize', this.boundHandleResize);
    Matter.Engine.clear(this.physicsEngine);
    this.app.destroy(true);
  }

  get width(): number {
    return this.app.renderer.width / (this.app.renderer.resolution || 1);
  }

  get height(): number {
    return this.app.renderer.height / (this.app.renderer.resolution || 1);
  }
}

export const engine = new GameEngine();
