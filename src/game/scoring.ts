import {
  ScoreState,
  DanceMoveId,
  HitRating,
  TapZone,
  DailyChallenge,
  ChallengeCondition,
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
    perfectHits: 0,
    goodHits: 0,
    totalHitAttempts: 0,
    consecutivePerfects: 0,
    isGrounded: true,
  };
}

// ─── Rhythm Scoring ───────────────────────────────────────────────────────────

export interface RhythmHitResult {
  rating: HitRating;
  zone: TapZone;
  targetId: number;
}

/**
 * Register a rhythm hit (or miss) and update score state.
 * Returns the points awarded.
 */
export function registerRhythmHit(
  score: ScoreState,
  hit: RhythmHitResult
): number {
  score.totalHitAttempts++;

  if (hit.rating === 'miss') {
    score.combo = 0;
    score.consecutivePerfects = 0;
    score.comboMultiplier = Math.max(1.0, score.comboMultiplier - 0.5);
    score.totalScore = Math.floor(score.crowdHype);
    return 0;
  }

  const base = hit.rating === 'perfect' ? 300 : 100;
  const points = Math.round(base * score.comboMultiplier);

  score.crowdHype += points;
  score.totalScore = Math.floor(score.crowdHype);
  score.combo++;
  score.comboMultiplier = Math.min(5.0, 1.0 + score.combo * 0.25);

  if (hit.rating === 'perfect') {
    score.perfectHits++;
    score.consecutivePerfects++;
  } else {
    score.goodHits++;
    score.consecutivePerfects = 0;
  }

  return points;
}

/**
 * Accuracy bonus awarded at end of session.
 */
export function calculateSessionBonus(score: ScoreState): number {
  if (score.totalHitAttempts === 0) return 0;
  const ratio = score.perfectHits / score.totalHitAttempts;
  return Math.round(ratio * 500);
}

// ─── Score Tick (combo decay only) ────────────────────────────────────────────

export function tickScore(score: ScoreState, dt: number, _currentMove: DanceMoveId): void {
  // Gently decay combo multiplier when no hits are landing
  if (score.combo === 0) {
    score.comboMultiplier = Math.max(1.0, score.comboMultiplier - dt * 0.1);
  }
}

// ─── Daily Challenge Generator ────────────────────────────────────────────────

export function generateDailyChallenge(dateStr: string): DailyChallenge {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0;
  }
  hash = Math.abs(hash);

  const streakCount = 5 + (hash % 8); // 5-12 consecutive perfects

  const conditions: ChallengeCondition[] = [
    {
      type: 'hit_streak',
      count: streakCount,
    },
  ];

  const scoreTarget = (2 + (hash % 8)) * 500;
  conditions.push({
    type: 'score',
    targetScore: scoreTarget,
  });

  return {
    date: dateStr,
    description: `Land ${streakCount} perfect hits in a row! Score ${scoreTarget}+ Hype.`,
    conditions,
    rewardPoints: 500 + streakCount * 100,
  };
}

export function getTodayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Challenge Progress Tracker ───────────────────────────────────────────────

export interface ChallengeProgress {
  challenge: DailyChallenge;
  consecutivePerfects: number;
  bestStreak: number;
  scoreReached: boolean;
  completed: boolean;
}

export function createChallengeProgress(challenge: DailyChallenge): ChallengeProgress {
  return {
    challenge,
    consecutivePerfects: 0,
    bestStreak: 0,
    scoreReached: false,
    completed: false,
  };
}

export function updateChallengeProgress(
  progress: ChallengeProgress,
  score: ScoreState,
  rating?: HitRating
): void {
  if (progress.completed) return;

  const conds = progress.challenge.conditions;

  // Track perfect streak
  if (rating === 'perfect') {
    progress.consecutivePerfects++;
    if (progress.consecutivePerfects > progress.bestStreak) {
      progress.bestStreak = progress.consecutivePerfects;
    }
  } else if (rating === 'miss' || rating === 'good') {
    progress.consecutivePerfects = 0;
  }

  // Check score condition
  for (const cond of conds) {
    if (cond.type === 'score' && cond.targetScore && score.totalScore >= cond.targetScore) {
      progress.scoreReached = true;
    }
  }

  // Check completion
  const streakCond = conds.find(c => c.type === 'hit_streak');
  const scoreCond = conds.find(c => c.type === 'score');

  const streakDone = !streakCond || progress.bestStreak >= (streakCond.count ?? 1);
  const scoreDone = !scoreCond || progress.scoreReached;

  if (streakDone && scoreDone) {
    progress.completed = true;
  }
}

// ─── Legacy / Compat ──────────────────────────────────────────────────────────

export function registerDanceMove(score: ScoreState, move: DanceMoveId): void {
  if (move === 'idle') {
    score.consecutiveDifferentMoves = 0;
    score.lastMoveId = null;
    return;
  }
  if (move !== score.lastMoveId) {
    score.consecutiveDifferentMoves++;
  }
  score.lastMoveId = move;
}
