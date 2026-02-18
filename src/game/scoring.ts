import {
  ScoreState,
  DanceMoveId,
  PhysicsObjectType,
  DailyChallenge,
  ChallengeCondition,
  PHYSICS_OBJECTS,
} from '@/types';

// ─── Score State Factory ──────────────────────────────────────────────────────

export function createScoreState(): ScoreState {
  return {
    crowdHype: 0,
    combo: 0,
    comboMultiplier: 1,
    totalScore: 0,
    lastMoveId: null,
    consecutiveDifferentMoves: 0,
    sessionStart: Date.now(),
    objectsDropped: 0,
    collisionsCount: 0,
    isGrounded: true,
  };
}

// ─── Score Calculations ───────────────────────────────────────────────────────

const HYPE_PER_SECOND: Record<DanceMoveId, number> = {
  idle: 0,
  wiggle: 10,
  robot: 15,
  worm: 20,
  flail: 12,
  spin: 18,
};

const COLLISION_REACTIONS: Record<string, { emoji: string; points: number; direction: 'left' | 'right' | 'up' }[]> = {
  beachball: [
    { emoji: '🏐💥', points: 50, direction: 'up' },
    { emoji: '🌊😂', points: 40, direction: 'right' },
  ],
  anvil: [
    { emoji: '💀😵', points: 150, direction: 'up' },
    { emoji: '⚡😤', points: 120, direction: 'left' },
  ],
  duck: [
    { emoji: '🦆🎵', points: 80, direction: 'right' },
    { emoji: '😂quack', points: 70, direction: 'up' },
  ],
  pillows: [
    { emoji: '💤😌', points: 40, direction: 'up' },
    { emoji: '🛌💫', points: 45, direction: 'left' },
  ],
  taco: [
    { emoji: '🌮😋', points: 90, direction: 'right' },
    { emoji: '💃🌮', points: 100, direction: 'up' },
  ],
  watermelon: [
    { emoji: '🍉💥', points: 85, direction: 'up' },
    { emoji: '😲🍉', points: 75, direction: 'left' },
  ],
  bowling: [
    { emoji: '🎳STRIKE!', points: 130, direction: 'left' },
    { emoji: '😱🎳', points: 110, direction: 'right' },
  ],
  feather: [
    { emoji: '🪶😄', points: 20, direction: 'up' },
    { emoji: '🤭hehe', points: 15, direction: 'right' },
  ],
};

export interface CollisionResult {
  points: number;
  emoji: string;
  wobbleIntensity: number;
  direction: 'left' | 'right' | 'up';
}

export function calculateCollisionResult(
  objectType: PhysicsObjectType,
  score: ScoreState
): CollisionResult {
  const reactions = COLLISION_REACTIONS[objectType] ?? [{ emoji: '💥', points: 50, direction: 'up' as const }];
  const reaction = reactions[Math.floor(Math.random() * reactions.length)];
  const def = PHYSICS_OBJECTS[objectType];

  const multiplier = score.comboMultiplier;
  const points = Math.round((reaction.points + def.comboBonus) * multiplier);
  const wobbleIntensity = def.mass * 0.15 + 0.5;

  return {
    points,
    emoji: reaction.emoji,
    wobbleIntensity: Math.min(wobbleIntensity, 2.5),
    direction: reaction.direction,
  };
}

// ─── Score Updater ────────────────────────────────────────────────────────────

export function tickScore(score: ScoreState, dt: number, currentMove: DanceMoveId): void {
  if (!score.isGrounded) return;

  // Hype accumulates while dancing
  const hypeRate = HYPE_PER_SECOND[currentMove];
  if (hypeRate > 0) {
    score.crowdHype += hypeRate * dt * score.comboMultiplier;
    score.totalScore = Math.floor(score.crowdHype);
  }

  // Combo decays if idle too long
  if (currentMove === 'idle') {
    score.comboMultiplier = Math.max(1, score.comboMultiplier - dt * 0.2);
    score.combo = Math.max(0, score.combo - 1);
  }
}

export function registerCollision(
  score: ScoreState,
  objectType: PhysicsObjectType
): CollisionResult {
  score.collisionsCount++;
  const result = calculateCollisionResult(objectType, score);

  score.crowdHype += result.points;
  score.totalScore = Math.floor(score.crowdHype);

  // Increase combo
  score.combo++;
  score.comboMultiplier = Math.min(5, 1 + score.combo * 0.25);

  return result;
}

export function registerDanceMove(score: ScoreState, move: DanceMoveId): void {
  if (move === 'idle') {
    score.consecutiveDifferentMoves = 0;
    return;
  }

  if (move !== score.lastMoveId) {
    score.consecutiveDifferentMoves++;
    // Bonus for variety
    if (score.consecutiveDifferentMoves >= 3) {
      score.crowdHype += 50;
      score.comboMultiplier = Math.min(5, score.comboMultiplier + 0.25);
    }
  }

  score.lastMoveId = move;
}

// ─── Daily Challenge Generator ────────────────────────────────────────────────

/**
 * Deterministically generates a daily challenge from the date string.
 * No randomness that changes between runs on the same day.
 */
export function generateDailyChallenge(dateStr: string): DailyChallenge {
  // Simple hash of the date
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0;
  }
  hash = Math.abs(hash);

  const objectTypes: PhysicsObjectType[] = ['duck', 'anvil', 'beachball', 'taco', 'watermelon', 'bowling', 'feather', 'pillows'];
  const danceMoves: DanceMoveId[] = ['robot', 'worm', 'wiggle', 'flail', 'spin'];

  const objectType = objectTypes[hash % objectTypes.length];
  const danceMove = danceMoves[(hash >> 4) % danceMoves.length];
  const count = 3 + (hash % 5); // 3-7 objects

  const conditions: ChallengeCondition[] = [
    {
      type: 'drop_object',
      objectType,
      count,
      whileDancing: danceMove,
    },
  ];

  // Second condition: score target
  const scoreTarget = (2 + (hash % 8)) * 500;
  conditions.push({
    type: 'score',
    targetScore: scoreTarget,
  });

  const objectDef = PHYSICS_OBJECTS[objectType];
  const moveName = danceMove.charAt(0).toUpperCase() + danceMove.slice(1);

  return {
    date: dateStr,
    description: `Drop ${count} ${objectDef.emoji} ${objectDef.label}s while doing the ${moveName}! Score ${scoreTarget}+ Hype.`,
    conditions,
    rewardPoints: 500 + count * 100,
  };
}

export function getTodayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Challenge Progress Tracker ───────────────────────────────────────────────

export interface ChallengeProgress {
  challenge: DailyChallenge;
  dropsWhileDancing: number;
  scoreReached: boolean;
  completed: boolean;
}

export function createChallengeProgress(challenge: DailyChallenge): ChallengeProgress {
  return {
    challenge,
    dropsWhileDancing: 0,
    scoreReached: false,
    completed: false,
  };
}

export function updateChallengeProgress(
  progress: ChallengeProgress,
  score: ScoreState,
  currentMove: DanceMoveId,
  droppedObject?: PhysicsObjectType
): void {
  if (progress.completed) return;

  const conds = progress.challenge.conditions;

  for (const cond of conds) {
    if (cond.type === 'drop_object' && droppedObject) {
      if (
        droppedObject === cond.objectType &&
        cond.whileDancing &&
        currentMove === cond.whileDancing
      ) {
        progress.dropsWhileDancing++;
      }
    }

    if (cond.type === 'score' && cond.targetScore) {
      if (score.totalScore >= cond.targetScore) {
        progress.scoreReached = true;
      }
    }
  }

  // Check completion
  const dropCond = conds.find(c => c.type === 'drop_object');
  const scoreCond = conds.find(c => c.type === 'score');

  const dropDone = !dropCond || progress.dropsWhileDancing >= (dropCond.count ?? 1);
  const scoreDone = !scoreCond || progress.scoreReached;

  if (dropDone && scoreDone) {
    progress.completed = true;
  }
}
