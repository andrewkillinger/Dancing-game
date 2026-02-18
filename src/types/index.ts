// ─── Customization ───────────────────────────────────────────────────────────

export type SkinTone = 'light' | 'medium-light' | 'medium' | 'medium-dark' | 'dark';
export type FaceShape = 'round' | 'oval' | 'square';
export type HairStyle = 'none' | 'short' | 'medium' | 'long' | 'afro' | 'bun' | 'spiky';
export type OutfitTop = 'tshirt' | 'hoodie' | 'dress' | 'suit' | 'tank' | 'sweater';
export type OutfitBottom = 'jeans' | 'shorts' | 'skirt' | 'pants' | 'joggers';
export type OutfitShoes = 'sneakers' | 'boots' | 'heels' | 'sandals' | 'cleats';
export type HatStyle = 'none' | 'cap' | 'tophat' | 'beanie' | 'cowboy';
export type GlassesStyle = 'none' | 'round' | 'square' | 'heart' | 'shades';

export interface CustomizationData {
  skinTone: SkinTone;
  faceShape: FaceShape;
  hairStyle: HairStyle;
  hairColor: string; // hex
  outfitTop: OutfitTop;
  topColor: string;
  outfitBottom: OutfitBottom;
  bottomColor: string;
  shoes: OutfitShoes;
  shoeColor: string;
  hat: HatStyle;
  hatColor: string;
  glasses: GlassesStyle;
  glassesColor: string;
  name: string;
}

export const DEFAULT_CUSTOMIZATION: CustomizationData = {
  skinTone: 'medium',
  faceShape: 'round',
  hairStyle: 'medium',
  hairColor: '#3D1A00',
  outfitTop: 'tshirt',
  topColor: '#FF6B6B',
  outfitBottom: 'jeans',
  bottomColor: '#2255AA',
  shoes: 'sneakers',
  shoeColor: '#FFFFFF',
  hat: 'none',
  hatColor: '#333333',
  glasses: 'none',
  glassesColor: '#222222',
  name: 'Wobbler',
};

// ─── Dance Moves ─────────────────────────────────────────────────────────────

export type DanceMoveId = 'wiggle' | 'robot' | 'worm' | 'flail' | 'spin' | 'idle';

export interface DanceMove {
  id: DanceMoveId;
  label: string;
  emoji: string;
  basePoints: number;
  duration: number; // ms
}

export const DANCE_MOVES: Record<DanceMoveId, DanceMove> = {
  idle: { id: 'idle', label: 'Idle', emoji: '😐', basePoints: 0, duration: Infinity },
  wiggle: { id: 'wiggle', label: 'Wiggle', emoji: '🌊', basePoints: 10, duration: 3000 },
  robot: { id: 'robot', label: 'Robot', emoji: '🤖', basePoints: 15, duration: 4000 },
  worm: { id: 'worm', label: 'Worm', emoji: '🪱', basePoints: 20, duration: 3500 },
  flail: { id: 'flail', label: 'Flail', emoji: '🙆', basePoints: 12, duration: 2500 },
  spin: { id: 'spin', label: 'Spin', emoji: '💫', basePoints: 18, duration: 2000 },
};

// ─── Physics Objects ──────────────────────────────────────────────────────────

export type PhysicsObjectType =
  | 'beachball'
  | 'anvil'
  | 'duck'
  | 'pillows'
  | 'taco'
  | 'watermelon'
  | 'bowling'
  | 'feather';

export interface PhysicsObjectDef {
  type: PhysicsObjectType;
  label: string;
  emoji: string;
  radius: number;
  mass: number;
  restitution: number; // bounciness
  friction: number;
  color: string;
  comboBonus: number;
}

export const PHYSICS_OBJECTS: Record<PhysicsObjectType, PhysicsObjectDef> = {
  beachball: {
    type: 'beachball',
    label: 'Beach Ball',
    emoji: '🏖️',
    radius: 28,
    mass: 1,
    restitution: 0.9,
    friction: 0.05,
    color: '#FF6B6B',
    comboBonus: 5,
  },
  anvil: {
    type: 'anvil',
    label: 'Anvil',
    emoji: '⚒️',
    radius: 22,
    mass: 20,
    restitution: 0.05,
    friction: 0.8,
    color: '#555555',
    comboBonus: 25,
  },
  duck: {
    type: 'duck',
    label: 'Rubber Duck',
    emoji: '🦆',
    radius: 20,
    mass: 0.5,
    restitution: 0.7,
    friction: 0.1,
    color: '#FFD93D',
    comboBonus: 15,
  },
  pillows: {
    type: 'pillows',
    label: 'Pillows',
    emoji: '🛏️',
    radius: 32,
    mass: 2,
    restitution: 0.4,
    friction: 0.5,
    color: '#E8D5F5',
    comboBonus: 8,
  },
  taco: {
    type: 'taco',
    label: 'Giant Taco',
    emoji: '🌮',
    radius: 26,
    mass: 3,
    restitution: 0.3,
    friction: 0.6,
    color: '#F4A261',
    comboBonus: 20,
  },
  watermelon: {
    type: 'watermelon',
    label: 'Watermelon',
    emoji: '🍉',
    radius: 30,
    mass: 4,
    restitution: 0.2,
    friction: 0.4,
    color: '#6BCB77',
    comboBonus: 18,
  },
  bowling: {
    type: 'bowling',
    label: 'Bowling Ball',
    emoji: '🎳',
    radius: 24,
    mass: 15,
    restitution: 0.1,
    friction: 0.7,
    color: '#333366',
    comboBonus: 22,
  },
  feather: {
    type: 'feather',
    label: 'Feather',
    emoji: '🪶',
    radius: 10,
    mass: 0.1,
    restitution: 0.3,
    friction: 0.9,
    color: '#FFCFEF',
    comboBonus: 3,
  },
};

// ─── Scoring ──────────────────────────────────────────────────────────────────

export interface ScoreState {
  crowdHype: number;
  combo: number;
  comboMultiplier: number;
  totalScore: number;
  lastMoveId: DanceMoveId | null;
  consecutiveDifferentMoves: number;
  sessionStart: number;
  objectsDropped: number;
  collisionsCount: number;
  isGrounded: boolean; // character standing, not "fallen"
}

export interface ScoreEntry {
  id?: string;
  userId?: string;
  score: number;
  mode: string;
  displayName?: string;
  createdAt?: string;
  metadata?: {
    objectsDropped: number;
    collisions: number;
    comboPeak: number;
    duration: number;
  };
}

// ─── Daily Challenge ──────────────────────────────────────────────────────────

export interface DailyChallenge {
  date: string; // YYYY-MM-DD
  description: string;
  conditions: ChallengeCondition[];
  rewardPoints: number;
}

export interface ChallengeCondition {
  type: 'drop_object' | 'dance_move' | 'combo' | 'score';
  objectType?: PhysicsObjectType;
  moveId?: DanceMoveId;
  count?: number;
  targetScore?: number;
  whileDancing?: DanceMoveId;
}

// ─── Player Profile ───────────────────────────────────────────────────────────

export interface PlayerProfile {
  id: string;
  displayName: string;
  customization: CustomizationData;
  lastSeen: string;
  isGuest: boolean;
}

// ─── Game State ───────────────────────────────────────────────────────────────

export type GameScreen = 'home' | 'customize' | 'dance' | 'leaderboard' | 'locker';

export interface GameState {
  screen: GameScreen;
  profile: PlayerProfile;
  currentScore: ScoreState;
  activeMove: DanceMoveId;
  isPlaying: boolean;
  audioEnabled: boolean;
  reducedMotion: boolean;
  fps: number;
  quality: 'high' | 'medium' | 'low';
}

// ─── Outfit / Locker ──────────────────────────────────────────────────────────

export interface SavedOutfit {
  id?: string;
  name: string;
  customization: CustomizationData;
  createdAt?: string;
}

// ─── Events ──────────────────────────────────────────────────────────────────

export type GameEventType =
  | 'collision'
  | 'dance_start'
  | 'dance_end'
  | 'score_update'
  | 'screen_change'
  | 'customization_change'
  | 'object_drop'
  | 'object_despawn'
  | 'challenge_complete'
  | 'high_score';

export interface GameEvent<T = unknown> {
  type: GameEventType;
  data: T;
  timestamp: number;
}

// ─── Joints ──────────────────────────────────────────────────────────────────

export interface Joint {
  angle: number;       // current angle (radians)
  velocity: number;    // angular velocity
  target: number;      // target/rest angle
  stiffness: number;   // spring stiffness
  damping: number;     // damping factor
}

export function createJoint(target = 0, stiffness = 0.15, damping = 0.6): Joint {
  return { angle: target, velocity: 0, target, stiffness, damping };
}

export function updateJoint(joint: Joint, dt: number): void {
  const force = (joint.target - joint.angle) * joint.stiffness;
  joint.velocity += force;
  joint.velocity *= joint.damping;
  joint.angle += joint.velocity * dt * 60;
}
