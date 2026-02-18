import { describe, it, expect, beforeEach } from 'vitest';
import {
  createScoreState,
  tickScore,
  registerRhythmHit,
  calculateSessionBonus,
  registerDanceMove,
} from '../src/game/scoring';
import type { ScoreState } from '../src/types';

describe('Score State', () => {
  let score: ScoreState;

  beforeEach(() => {
    score = createScoreState();
  });

  it('initializes with zero values', () => {
    expect(score.crowdHype).toBe(0);
    expect(score.combo).toBe(0);
    expect(score.comboMultiplier).toBe(1);
    expect(score.totalScore).toBe(0);
    expect(score.perfectHits).toBe(0);
    expect(score.goodHits).toBe(0);
    expect(score.totalHitAttempts).toBe(0);
    expect(score.isGrounded).toBe(true);
  });

  it('does not accumulate hype via tickScore alone', () => {
    tickScore(score, 1, 'wiggle');
    expect(score.crowdHype).toBe(0);
  });

  it('does not accumulate hype when idle', () => {
    tickScore(score, 1, 'idle');
    expect(score.crowdHype).toBe(0);
  });

  it('decays combo multiplier when combo is zero', () => {
    score.comboMultiplier = 3;
    score.combo = 0;
    tickScore(score, 5, 'idle');
    expect(score.comboMultiplier).toBeLessThan(3);
    expect(score.comboMultiplier).toBeGreaterThanOrEqual(1);
  });

  it('does not decay combo multiplier when combo is active', () => {
    score.comboMultiplier = 3;
    score.combo = 5;
    tickScore(score, 5, 'wiggle');
    expect(score.comboMultiplier).toBe(3);
  });
});

describe('Rhythm Hit Registration', () => {
  let score: ScoreState;

  beforeEach(() => {
    score = createScoreState();
  });

  it('awards points for a perfect hit', () => {
    const points = registerRhythmHit(score, { rating: 'perfect', zone: 'upper-left', targetId: 1 });
    expect(points).toBe(300);
    expect(score.crowdHype).toBe(300);
    expect(score.totalScore).toBe(300);
  });

  it('awards points for a good hit', () => {
    const points = registerRhythmHit(score, { rating: 'good', zone: 'upper-right', targetId: 2 });
    expect(points).toBe(100);
    expect(score.crowdHype).toBe(100);
  });

  it('awards zero points for a miss', () => {
    const points = registerRhythmHit(score, { rating: 'miss', zone: 'lower-center', targetId: -1 });
    expect(points).toBe(0);
    expect(score.crowdHype).toBe(0);
  });

  it('increments combo on hit', () => {
    registerRhythmHit(score, { rating: 'perfect', zone: 'upper-left', targetId: 1 });
    expect(score.combo).toBe(1);
    registerRhythmHit(score, { rating: 'good', zone: 'upper-right', targetId: 2 });
    expect(score.combo).toBe(2);
  });

  it('resets combo on miss', () => {
    registerRhythmHit(score, { rating: 'perfect', zone: 'upper-left', targetId: 1 });
    registerRhythmHit(score, { rating: 'perfect', zone: 'upper-right', targetId: 2 });
    expect(score.combo).toBe(2);
    registerRhythmHit(score, { rating: 'miss', zone: 'lower-left', targetId: -1 });
    expect(score.combo).toBe(0);
  });

  it('increases combo multiplier with consecutive hits', () => {
    for (let i = 0; i < 5; i++) {
      registerRhythmHit(score, { rating: 'good', zone: 'upper-left', targetId: i });
    }
    expect(score.comboMultiplier).toBeGreaterThan(1);
  });

  it('caps combo multiplier at 5', () => {
    for (let i = 0; i < 100; i++) {
      registerRhythmHit(score, { rating: 'perfect', zone: 'upper-left', targetId: i });
    }
    expect(score.comboMultiplier).toBeLessThanOrEqual(5);
  });

  it('applies combo multiplier to points', () => {
    score.comboMultiplier = 2;
    const points = registerRhythmHit(score, { rating: 'perfect', zone: 'upper-center', targetId: 1 });
    expect(points).toBe(600);
  });

  it('tracks perfect hits separately from good hits', () => {
    registerRhythmHit(score, { rating: 'perfect', zone: 'upper-left', targetId: 1 });
    registerRhythmHit(score, { rating: 'good', zone: 'upper-right', targetId: 2 });
    registerRhythmHit(score, { rating: 'perfect', zone: 'lower-left', targetId: 3 });
    expect(score.perfectHits).toBe(2);
    expect(score.goodHits).toBe(1);
    expect(score.totalHitAttempts).toBe(3);
  });

  it('increments totalHitAttempts on miss too', () => {
    registerRhythmHit(score, { rating: 'miss', zone: 'lower-center', targetId: -1 });
    expect(score.totalHitAttempts).toBe(1);
  });

  it('tracks consecutivePerfects and resets on non-perfect', () => {
    registerRhythmHit(score, { rating: 'perfect', zone: 'upper-left', targetId: 1 });
    registerRhythmHit(score, { rating: 'perfect', zone: 'upper-right', targetId: 2 });
    expect(score.consecutivePerfects).toBe(2);
    registerRhythmHit(score, { rating: 'good', zone: 'lower-left', targetId: 3 });
    expect(score.consecutivePerfects).toBe(0);
  });
});

describe('Session Bonus', () => {
  it('returns 0 with no attempts', () => {
    const score = createScoreState();
    expect(calculateSessionBonus(score)).toBe(0);
  });

  it('returns 500 for all-perfect session', () => {
    const score = createScoreState();
    registerRhythmHit(score, { rating: 'perfect', zone: 'upper-left', targetId: 1 });
    expect(calculateSessionBonus(score)).toBe(500);
  });

  it('returns partial bonus for mixed session', () => {
    const score = createScoreState();
    registerRhythmHit(score, { rating: 'perfect', zone: 'upper-left', targetId: 1 });
    registerRhythmHit(score, { rating: 'miss', zone: 'upper-right', targetId: 2 });
    // 1 perfect out of 2 attempts = 0.5 ratio → 250 bonus
    expect(calculateSessionBonus(score)).toBe(250);
  });
});

describe('Dance Move Registration', () => {
  let score: ScoreState;

  beforeEach(() => {
    score = createScoreState();
  });

  it('tracks consecutive different moves', () => {
    registerDanceMove(score, 'wiggle');
    expect(score.consecutiveDifferentMoves).toBe(1);
    registerDanceMove(score, 'robot');
    expect(score.consecutiveDifferentMoves).toBe(2);
  });

  it('does not increment for repeated move', () => {
    registerDanceMove(score, 'wiggle');
    registerDanceMove(score, 'wiggle');
    expect(score.consecutiveDifferentMoves).toBe(1);
  });

  it('resets on idle', () => {
    registerDanceMove(score, 'wiggle');
    registerDanceMove(score, 'idle');
    expect(score.consecutiveDifferentMoves).toBe(0);
  });

  it('sets lastMoveId', () => {
    registerDanceMove(score, 'spin');
    expect(score.lastMoveId).toBe('spin');
  });

  it('does not set lastMoveId for idle', () => {
    registerDanceMove(score, 'idle');
    expect(score.lastMoveId).toBeNull();
  });
});
