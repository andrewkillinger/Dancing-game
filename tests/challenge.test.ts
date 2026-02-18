import { describe, it, expect } from 'vitest';
import {
  generateDailyChallenge,
  getTodayDateStr,
  createChallengeProgress,
  updateChallengeProgress,
} from '../src/game/scoring';
import { createScoreState } from '../src/game/scoring';

describe('Daily Challenge Generation', () => {
  it('generates a challenge for a given date', () => {
    const challenge = generateDailyChallenge('2024-01-15');
    expect(challenge).toBeDefined();
    expect(challenge.date).toBe('2024-01-15');
    expect(challenge.description).toBeTruthy();
    expect(challenge.conditions.length).toBeGreaterThan(0);
    expect(challenge.rewardPoints).toBeGreaterThan(0);
  });

  it('is deterministic for the same date', () => {
    const c1 = generateDailyChallenge('2024-06-20');
    const c2 = generateDailyChallenge('2024-06-20');
    expect(c1.description).toBe(c2.description);
    expect(c1.conditions).toEqual(c2.conditions);
    expect(c1.rewardPoints).toBe(c2.rewardPoints);
  });

  it('differs between dates', () => {
    const c1 = generateDailyChallenge('2024-01-01');
    const c2 = generateDailyChallenge('2024-01-02');
    // At least description OR conditions should differ (very likely given hash)
    const sameDesc = c1.description === c2.description;
    const sameConds = JSON.stringify(c1.conditions) === JSON.stringify(c2.conditions);
    expect(sameDesc && sameConds).toBe(false);
  });

  it('has valid condition types', () => {
    const challenge = generateDailyChallenge('2024-03-15');
    for (const cond of challenge.conditions) {
      expect(['drop_object', 'dance_move', 'combo', 'score']).toContain(cond.type);
    }
  });

  it('always includes a score condition', () => {
    const dates = ['2024-01-01', '2024-06-15', '2024-12-31'];
    for (const date of dates) {
      const challenge = generateDailyChallenge(date);
      const hasScore = challenge.conditions.some(c => c.type === 'score');
      expect(hasScore).toBe(true);
    }
  });

  it('drop count is between 3 and 7', () => {
    const dates = Array.from({ length: 20 }, (_, i) => `2024-01-${String(i + 1).padStart(2, '0')}`);
    for (const date of dates) {
      const challenge = generateDailyChallenge(date);
      const dropCond = challenge.conditions.find(c => c.type === 'drop_object');
      if (dropCond?.count !== undefined) {
        expect(dropCond.count).toBeGreaterThanOrEqual(3);
        expect(dropCond.count).toBeLessThanOrEqual(7);
      }
    }
  });

  it('getTodayDateStr returns YYYY-MM-DD format', () => {
    const dateStr = getTodayDateStr();
    expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('reward points scale with difficulty', () => {
    // Reward = 500 + count * 100, count = 3..7
    // So reward should be 800..1200
    const dates = Array.from({ length: 10 }, (_, i) => `2024-0${(i % 9) + 1}-01`);
    for (const date of dates) {
      const challenge = generateDailyChallenge(date);
      expect(challenge.rewardPoints).toBeGreaterThanOrEqual(800);
      expect(challenge.rewardPoints).toBeLessThanOrEqual(1200);
    }
  });
});

describe('Challenge Progress Tracking', () => {
  it('starts with zero progress', () => {
    const challenge = generateDailyChallenge('2024-05-10');
    const progress = createChallengeProgress(challenge);
    expect(progress.completed).toBe(false);
    expect(progress.dropsWhileDancing).toBe(0);
    expect(progress.scoreReached).toBe(false);
  });

  it('tracks drops while dancing correct move', () => {
    const challenge = generateDailyChallenge('2024-05-10');
    const progress = createChallengeProgress(challenge);
    const score = createScoreState();

    const dropCond = challenge.conditions.find(c => c.type === 'drop_object');
    if (!dropCond || !dropCond.objectType || !dropCond.whileDancing) return;

    // Drop the right object while doing the right dance
    updateChallengeProgress(progress, score, dropCond.whileDancing, dropCond.objectType);
    expect(progress.dropsWhileDancing).toBe(1);
  });

  it('does not count drops with wrong move', () => {
    const challenge = generateDailyChallenge('2024-05-10');
    const progress = createChallengeProgress(challenge);
    const score = createScoreState();

    const dropCond = challenge.conditions.find(c => c.type === 'drop_object');
    if (!dropCond || !dropCond.objectType) return;

    // Drop while idle (wrong move)
    updateChallengeProgress(progress, score, 'idle', dropCond.objectType);
    expect(progress.dropsWhileDancing).toBe(0);
  });

  it('does not count wrong object type', () => {
    const challenge = generateDailyChallenge('2024-05-10');
    const progress = createChallengeProgress(challenge);
    const score = createScoreState();

    const dropCond = challenge.conditions.find(c => c.type === 'drop_object');
    if (!dropCond || !dropCond.whileDancing) return;

    // Drop wrong object type while doing correct dance
    const wrongType = dropCond.objectType === 'duck' ? 'anvil' : 'duck';
    updateChallengeProgress(progress, score, dropCond.whileDancing, wrongType);
    expect(progress.dropsWhileDancing).toBe(0);
  });

  it('marks score reached when target hit', () => {
    const challenge = generateDailyChallenge('2024-05-10');
    const progress = createChallengeProgress(challenge);
    const score = createScoreState();

    const scoreCond = challenge.conditions.find(c => c.type === 'score');
    if (!scoreCond?.targetScore) return;

    score.totalScore = scoreCond.targetScore;
    updateChallengeProgress(progress, score, 'wiggle');
    expect(progress.scoreReached).toBe(true);
  });

  it('does not complete until all conditions met', () => {
    const challenge = generateDailyChallenge('2024-05-10');
    const progress = createChallengeProgress(challenge);
    const score = createScoreState();

    const dropCond = challenge.conditions.find(c => c.type === 'drop_object');
    if (!dropCond?.objectType || !dropCond.whileDancing) return;

    // Only drop condition, not score
    for (let i = 0; i < (dropCond.count ?? 1); i++) {
      updateChallengeProgress(progress, score, dropCond.whileDancing, dropCond.objectType);
    }

    // Score not reached yet - should not be complete
    const scoreCond = challenge.conditions.find(c => c.type === 'score');
    if (scoreCond) {
      expect(progress.completed).toBe(false);
    }
  });

  it('marks completed when all conditions met', () => {
    const challenge = generateDailyChallenge('2024-05-10');
    const progress = createChallengeProgress(challenge);
    const score = createScoreState();

    const dropCond = challenge.conditions.find(c => c.type === 'drop_object');
    const scoreCond = challenge.conditions.find(c => c.type === 'score');

    if (!dropCond?.objectType || !dropCond.whileDancing || !scoreCond?.targetScore) return;

    // Meet score condition
    score.totalScore = scoreCond.targetScore;

    // Meet drop condition
    for (let i = 0; i < (dropCond.count ?? 1); i++) {
      updateChallengeProgress(progress, score, dropCond.whileDancing, dropCond.objectType);
    }

    expect(progress.completed).toBe(true);
  });

  it('does not update after completion', () => {
    const challenge = generateDailyChallenge('2024-05-10');
    const progress = createChallengeProgress(challenge);
    const score = createScoreState();

    progress.completed = true;
    const prevDrops = progress.dropsWhileDancing;

    const dropCond = challenge.conditions.find(c => c.type === 'drop_object');
    if (dropCond?.objectType && dropCond.whileDancing) {
      updateChallengeProgress(progress, score, dropCond.whileDancing, dropCond.objectType);
    }

    expect(progress.dropsWhileDancing).toBe(prevDrops);
  });
});
