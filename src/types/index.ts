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

// ─── Rhythm / Tap Zones ───────────────────────────────────────────────────────

export type TapZone =
  | 'upper-left'    // left arm
  | 'upper-center'  // head / torso
  | 'upper-right'   // right arm
  | 'lower-left'    // left leg
  | 'lower-center'  // both legs
  | 'lower-right';  // right leg

export type HitRating = 'perfect' | 'good' | 'miss';

export type StageEffectType = 'spotlight' | 'discoBall' | 'hypeTrain' | 'confetti';

// ─── Scoring ──────────────────────────────────────────────────────────────────

export interface ScoreState {
  crowdHype: number;
  combo: number;
  comboMultiplier: number;
  totalScore: number;
  lastMoveId: DanceMoveId | null;
  consecutiveDifferentMoves: number;
  sessionStart: number;
  // Rhythm stats
  perfectHits: number;
  goodHits: number;
  totalHitAttempts: number;
  consecutivePerfects: number;
  isGrounded: boolean;
}

export interface ScoreEntry {
  id?: string;
  userId?: string;
  score: number;
  mode: string;
  displayName?: string;
  createdAt?: string;
  metadata?: {
    perfectHits: number;
    goodHits: number;
    totalHits: number;
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
  type: 'hit_streak' | 'dance_move' | 'combo' | 'score';
  moveId?: DanceMoveId;
  count?: number;
  targetScore?: number;
}

// ─── Player Profile ───────────────────────────────────────────────────────────

export interface PlayerProfile {
  id: string;
  displayName: string;
  customization: CustomizationData;
  lastSeen: string;
  isGuest: boolean;
}

// ─── Music / Songs ────────────────────────────────────────────────────────────

export type MusicStyle = 'pop' | 'hiphop' | 'electronic' | 'latin';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface SongDefinition {
  id: string;
  name: string;
  emoji: string;
  bpm: number;
  style: MusicStyle;
  difficulty: DifficultyLevel;
  barCount: number;         // number of bars in the round
  durationSec: number;      // approximate display duration
  beatPattern: TapZone[][]; // per-beat zone list; length = beats per bar
}

export const SONGS: SongDefinition[] = [
  {
    id: 'wobble-pop',
    name: 'Wobble Pop',
    emoji: '🎵',
    bpm: 120,
    style: 'pop',
    difficulty: 'medium',
    barCount: 12,
    durationSec: 48,
    beatPattern: [
      ['upper-left'],                         // beat 0
      ['upper-right'],                        // beat 1
      ['lower-left'],                         // beat 2
      ['lower-right'],                        // beat 3
      ['upper-center'],                       // beat 4
      ['upper-left', 'upper-right'],          // beat 5 — double
      ['lower-center'],                       // beat 6
      [],                                     // beat 7 — rest
    ],
  },
  {
    id: 'easy-groove',
    name: 'Easy Groove',
    emoji: '🎸',
    bpm: 88,
    style: 'hiphop',
    difficulty: 'easy',
    barCount: 8,
    durationSec: 44,
    beatPattern: [
      ['upper-left'],   // beat 0
      [],               // beat 1 — rest
      ['upper-right'],  // beat 2
      [],               // beat 3 — rest
    ],
  },
  {
    id: 'electric-surge',
    name: 'Electric Surge',
    emoji: '⚡',
    bpm: 145,
    style: 'electronic',
    difficulty: 'hard',
    barCount: 14,
    durationSec: 46,
    beatPattern: [
      ['upper-left', 'lower-right'],          // beat 0
      ['upper-right'],                        // beat 1
      ['lower-left', 'upper-center'],         // beat 2
      ['lower-right'],                        // beat 3
      ['upper-left', 'upper-right'],          // beat 4 — double
      ['lower-center'],                       // beat 5
      ['upper-center', 'lower-left'],         // beat 6
      ['upper-right', 'lower-right'],         // beat 7
    ],
  },
  {
    id: 'salsa-night',
    name: 'Salsa Night',
    emoji: '🌶️',
    bpm: 108,
    style: 'latin',
    difficulty: 'medium',
    barCount: 10,
    durationSec: 44,
    beatPattern: [
      ['upper-center'],                       // beat 0
      ['lower-left'],                         // beat 1
      ['upper-right'],                        // beat 2
      ['lower-center'],                       // beat 3
      ['upper-left'],                         // beat 4
      ['lower-right'],                        // beat 5
      ['upper-center', 'lower-left'],         // beat 6 — double
      [],                                     // beat 7 — rest
    ],
  },
];

export const DEFAULT_SONG = SONGS[0];

// ─── Game State ───────────────────────────────────────────────────────────────

export type GameScreen = 'home' | 'customize' | 'dance' | 'leaderboard' | 'locker' | 'song-select';

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
  selectedSong: SongDefinition;
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
  | 'rhythm_hit'
  | 'rhythm_miss'
  | 'beat'
  | 'dance_start'
  | 'dance_end'
  | 'score_update'
  | 'screen_change'
  | 'customization_change'
  | 'challenge_complete'
  | 'high_score'
  | 'stage_effect';

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
