import { describe, it, expect, beforeEach } from 'vitest';
import {
  createScoreState,
  tickScore,
  registerCollision,
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
    expect(score.isGrounded).toBe(true);
  });

  it('accumulates hype when dancing', () => {
    const before = score.crowdHype;
    tickScore(score, 1, 'wiggle'); // 1 second of wiggle
    expect(score.crowdHype).toBeGreaterThan(before);
  });

  it('does not accumulate hype when idle', () => {
    tickScore(score, 1, 'idle');
    expect(score.crowdHype).toBe(0);
  });

  it('does not accumulate hype when not grounded', () => {
    score.isGrounded = false;
    tickScore(score, 1, 'robot');
    expect(score.crowdHype).toBe(0);
  });

  it('hype rate is higher for harder moves', () => {
    const wormScore = createScoreState();
    const wiggleScore = createScoreState();
    tickScore(wormScore, 1, 'worm');
    tickScore(wiggleScore, 1, 'wiggle');
    expect(wormScore.crowdHype).toBeGreaterThan(wiggleScore.crowdHype);
  });

  it('applies combo multiplier to hype', () => {
    score.comboMultiplier = 2;
    const base = createScoreState();
    tickScore(score, 1, 'wiggle');
    tickScore(base, 1, 'wiggle');
    expect(score.crowdHype).toBeGreaterThan(base.crowdHype);
    expect(Math.round(score.crowdHype)).toBeCloseTo(Math.round(base.crowdHype * 2), 0);
  });

  it('updates totalScore from crowdHype', () => {
    tickScore(score, 1, 'robot');
    expect(score.totalScore).toBe(Math.floor(score.crowdHype));
  });

  it('combo decays when idle', () => {
    score.combo = 10;
    score.comboMultiplier = 3;
    tickScore(score, 5, 'idle');
    expect(score.comboMultiplier).toBeLessThan(3);
    expect(score.combo).toBeLessThan(10);
  });
});

describe('Collision Registration', () => {
  let score: ScoreState;

  beforeEach(() => {
    score = createScoreState();
  });

  it('increments collision count', () => {
    registerCollision(score, 'beachball');
    expect(score.collisionsCount).toBe(1);
  });

  it('adds points to crowdHype', () => {
    const result = registerCollision(score, 'beachball');
    expect(result.points).toBeGreaterThan(0);
    expect(score.crowdHype).toBeGreaterThan(0);
  });

  it('increments combo on collision', () => {
    registerCollision(score, 'duck');
    expect(score.combo).toBe(1);
    registerCollision(score, 'duck');
    expect(score.combo).toBe(2);
  });

  it('increases combo multiplier', () => {
    for (let i = 0; i < 5; i++) {
      registerCollision(score, 'duck');
    }
    expect(score.comboMultiplier).toBeGreaterThan(1);
  });

  it('caps combo multiplier at 5', () => {
    for (let i = 0; i < 100; i++) {
      registerCollision(score, 'duck');
    }
    expect(score.comboMultiplier).toBeLessThanOrEqual(5);
  });

  it('heavy objects return higher wobble intensity', () => {
    const anvil = registerCollision(score, 'anvil');
    const feather = registerCollision(createScoreState(), 'feather');
    expect(anvil.wobbleIntensity).toBeGreaterThan(feather.wobbleIntensity);
  });

  it('returns emoji and direction', () => {
    const result = registerCollision(score, 'taco');
    expect(result.emoji).toBeTruthy();
    expect(['left', 'right', 'up']).toContain(result.direction);
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

  it('gives variety bonus after 3 different moves', () => {
    const before = score.crowdHype;
    registerDanceMove(score, 'wiggle');
    registerDanceMove(score, 'robot');
    registerDanceMove(score, 'worm');
    // Third different move triggers bonus
    expect(score.crowdHype).toBeGreaterThan(before);
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
