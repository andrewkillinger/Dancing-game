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
      expect(['hit_streak', 'dance_move', 'combo', 'score']).toContain(cond.type);
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

  it('always includes a hit_streak condition', () => {
    const dates = ['2024-01-01', '2024-06-15', '2024-12-31'];
    for (const date of dates) {
      const challenge = generateDailyChallenge(date);
      const hasStreak = challenge.conditions.some(c => c.type === 'hit_streak');
      expect(hasStreak).toBe(true);
    }
  });

  it('streak count is between 5 and 12', () => {
    const dates = Array.from({ length: 20 }, (_, i) => `2024-01-${String(i + 1).padStart(2, '0')}`);
    for (const date of dates) {
      const challenge = generateDailyChallenge(date);
      const streakCond = challenge.conditions.find(c => c.type === 'hit_streak');
      if (streakCond?.count !== undefined) {
        expect(streakCond.count).toBeGreaterThanOrEqual(5);
        expect(streakCond.count).toBeLessThanOrEqual(12);
      }
    }
  });

  it('getTodayDateStr returns YYYY-MM-DD format', () => {
    const dateStr = getTodayDateStr();
    expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('reward points scale with difficulty', () => {
    // Reward = 500 + streakCount * 100, streakCount = 5..12
    // So reward should be 1000..1700
    const dates = Array.from({ length: 10 }, (_, i) => `2024-0${(i % 9) + 1}-01`);
    for (const date of dates) {
      const challenge = generateDailyChallenge(date);
      expect(challenge.rewardPoints).toBeGreaterThanOrEqual(1000);
      expect(challenge.rewardPoints).toBeLessThanOrEqual(1700);
    }
  });
});

describe('Challenge Progress Tracking', () => {
  it('starts with zero progress', () => {
    const challenge = generateDailyChallenge('2024-05-10');
    const progress = createChallengeProgress(challenge);
    expect(progress.completed).toBe(false);
    expect(progress.bestStreak).toBe(0);
    expect(progress.consecutivePerfects).toBe(0);
    expect(progress.scoreReached).toBe(false);
  });

  it('tracks perfect streak', () => {
    const challenge = generateDailyChallenge('2024-05-10');
    const progress = createChallengeProgress(challenge);
    const score = createScoreState();

    updateChallengeProgress(progress, score, 'perfect');
    updateChallengeProgress(progress, score, 'perfect');
    updateChallengeProgress(progress, score, 'perfect');
    expect(progress.consecutivePerfects).toBe(3);
    expect(progress.bestStreak).toBe(3);
  });

  it('resets streak on miss', () => {
    const challenge = generateDailyChallenge('2024-05-10');
    const progress = createChallengeProgress(challenge);
    const score = createScoreState();

    updateChallengeProgress(progress, score, 'perfect');
    updateChallengeProgress(progress, score, 'perfect');
    expect(progress.bestStreak).toBe(2);

    updateChallengeProgress(progress, score, 'miss');
    expect(progress.consecutivePerfects).toBe(0);
    expect(progress.bestStreak).toBe(2); // best streak preserved
  });

  it('resets streak on good hit', () => {
    const challenge = generateDailyChallenge('2024-05-10');
    const progress = createChallengeProgress(challenge);
    const score = createScoreState();

    updateChallengeProgress(progress, score, 'perfect');
    updateChallengeProgress(progress, score, 'good');
    expect(progress.consecutivePerfects).toBe(0);
    expect(progress.bestStreak).toBe(1);
  });

  it('marks score reached when target hit', () => {
    const challenge = generateDailyChallenge('2024-05-10');
    const progress = createChallengeProgress(challenge);
    const score = createScoreState();

    const scoreCond = challenge.conditions.find(c => c.type === 'score');
    if (!scoreCond?.targetScore) return;

    score.totalScore = scoreCond.targetScore;
    updateChallengeProgress(progress, score, 'perfect');
    expect(progress.scoreReached).toBe(true);
  });

  it('does not complete until all conditions met', () => {
    const challenge = generateDailyChallenge('2024-05-10');
    const progress = createChallengeProgress(challenge);
    const score = createScoreState();

    const streakCond = challenge.conditions.find(c => c.type === 'hit_streak');
    if (!streakCond?.count) return;

    // Build streak but don't meet score condition
    for (let i = 0; i < (streakCond.count ?? 1); i++) {
      updateChallengeProgress(progress, score, 'perfect');
    }

    const scoreCond = challenge.conditions.find(c => c.type === 'score');
    if (scoreCond) {
      expect(progress.completed).toBe(false);
    }
  });

  it('marks completed when all conditions met', () => {
    const challenge = generateDailyChallenge('2024-05-10');
    const progress = createChallengeProgress(challenge);
    const score = createScoreState();

    const streakCond = challenge.conditions.find(c => c.type === 'hit_streak');
    const scoreCond = challenge.conditions.find(c => c.type === 'score');

    if (!streakCond?.count || !scoreCond?.targetScore) return;

    // Meet score condition
    score.totalScore = scoreCond.targetScore;

    // Meet streak condition
    for (let i = 0; i < streakCond.count; i++) {
      updateChallengeProgress(progress, score, 'perfect');
    }

    expect(progress.completed).toBe(true);
  });

  it('does not update after completion', () => {
    const challenge = generateDailyChallenge('2024-05-10');
    const progress = createChallengeProgress(challenge);
    const score = createScoreState();

    progress.completed = true;
    const prevStreak = progress.bestStreak;

    updateChallengeProgress(progress, score, 'perfect');
    expect(progress.bestStreak).toBe(prevStreak);
  });
});
