import { getSupabaseClient } from './client';
import {
  ScoreEntry,
  SavedOutfit,
  CustomizationData,
  DailyChallenge,
} from '@/types';
import type { ChallengeProgress } from '@/game/scoring';

// ─── Local Storage Fallbacks ──────────────────────────────────────────────────

const LOCAL_SCORES_KEY = 'wobble_dance_scores';
const LOCAL_OUTFITS_KEY = 'wobble_dance_outfits';
const LOCAL_CHALLENGES_KEY = 'wobble_dance_challenges';

function localScores(): ScoreEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_SCORES_KEY) ?? '[]');
  } catch { return []; }
}

function saveLocalScores(scores: ScoreEntry[]): void {
  localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(scores.slice(0, 50)));
}

function localOutfits(): SavedOutfit[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_OUTFITS_KEY) ?? '[]');
  } catch { return []; }
}

function saveLocalOutfits(outfits: SavedOutfit[]): void {
  localStorage.setItem(LOCAL_OUTFITS_KEY, JSON.stringify(outfits));
}

// ─── Data Service ─────────────────────────────────────────────────────────────

export class DataService {
  // ─── Scores ────────────────────────────────────────────────────────────────

  async submitScore(userId: string, score: ScoreEntry): Promise<void> {
    const supabase = getSupabaseClient();

    if (!supabase) {
      // Guest: save locally
      const scores = localScores();
      scores.unshift({ ...score, userId });
      saveLocalScores(scores);
      return;
    }

    try {
      await supabase.from('scores').insert({
        user_id: userId,
        score: score.score,
        mode: score.mode,
        metadata_json: score.metadata ?? null,
      });
    } catch (err) {
      console.warn('[Data] Score submit failed, saving locally:', err);
      const scores = localScores();
      scores.unshift(score);
      saveLocalScores(scores);
    }
  }

  async getLeaderboard(limit = 20): Promise<ScoreEntry[]> {
    const supabase = getSupabaseClient();

    if (!supabase) {
      return localScores()
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(s => ({ ...s, displayName: 'You' }));
    }

    try {
      const { data, error } = await supabase
        .from('scores')
        .select('id, score, mode, created_at, profiles(display_name)')
        .order('score', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        score: row.score as number,
        mode: row.mode as string,
        createdAt: row.created_at as string,
        displayName: (row.profiles as { display_name?: string } | null)?.display_name ?? 'Wobbler',
      }));
    } catch (err) {
      console.warn('[Data] Leaderboard fetch failed:', err);
      return [];
    }
  }

  async getUserBestScore(userId: string): Promise<number> {
    const supabase = getSupabaseClient();

    if (!supabase) {
      const scores = localScores();
      return scores.reduce((best, s) => Math.max(best, s.score), 0);
    }

    try {
      const { data } = await supabase
        .from('scores')
        .select('score')
        .eq('user_id', userId)
        .order('score', { ascending: false })
        .limit(1)
        .single();

      return data?.score ?? 0;
    } catch {
      return 0;
    }
  }

  // ─── Outfits ───────────────────────────────────────────────────────────────

  async saveOutfit(userId: string, outfit: SavedOutfit): Promise<SavedOutfit | null> {
    const supabase = getSupabaseClient();

    if (!supabase) {
      const outfits = localOutfits();
      const saved: SavedOutfit = { ...outfit, id: `local_${Date.now()}`, createdAt: new Date().toISOString() };
      outfits.unshift(saved);
      saveLocalOutfits(outfits);
      return saved;
    }

    try {
      const { data, error } = await supabase
        .from('outfits')
        .insert({
          user_id: userId,
          name: outfit.name,
          customization_json: outfit.customization,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: (data as Record<string, unknown>).id as string,
        name: (data as Record<string, unknown>).name as string,
        customization: (data as Record<string, unknown>).customization_json as CustomizationData,
        createdAt: (data as Record<string, unknown>).created_at as string,
      };
    } catch (err) {
      console.warn('[Data] Outfit save failed:', err);
      return null;
    }
  }

  async getOutfits(userId: string): Promise<SavedOutfit[]> {
    const supabase = getSupabaseClient();

    if (!supabase) {
      return localOutfits();
    }

    try {
      const { data, error } = await supabase
        .from('outfits')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        name: row.name as string,
        customization: row.customization_json as CustomizationData,
        createdAt: row.created_at as string,
      }));
    } catch (err) {
      console.warn('[Data] Outfits fetch failed:', err);
      return localOutfits();
    }
  }

  async deleteOutfit(userId: string, outfitId: string): Promise<void> {
    const supabase = getSupabaseClient();

    if (!supabase || outfitId.startsWith('local_')) {
      const outfits = localOutfits().filter(o => o.id !== outfitId);
      saveLocalOutfits(outfits);
      return;
    }

    try {
      await supabase
        .from('outfits')
        .delete()
        .eq('id', outfitId)
        .eq('user_id', userId);
    } catch (err) {
      console.warn('[Data] Outfit delete failed:', err);
    }
  }

  // ─── Daily Challenges ──────────────────────────────────────────────────────

  async saveChallengeCompletion(
    userId: string,
    date: string,
    progress: ChallengeProgress,
    challenge: DailyChallenge
  ): Promise<void> {
    const supabase = getSupabaseClient();

    const result = {
      date,
      completed: progress.completed,
      dropsWhileDancing: progress.dropsWhileDancing,
      rewardPoints: challenge.rewardPoints,
    };

    if (!supabase) {
      localStorage.setItem(`${LOCAL_CHALLENGES_KEY}_${date}`, JSON.stringify(result));
      return;
    }

    try {
      await supabase.from('challenge_completions').upsert({
        user_id: userId,
        date,
        result_json: result,
      }, { onConflict: 'user_id,date' });
    } catch (err) {
      console.warn('[Data] Challenge save failed:', err);
      localStorage.setItem(`${LOCAL_CHALLENGES_KEY}_${date}`, JSON.stringify(result));
    }
  }

  async getChallengeCompletion(userId: string, date: string): Promise<boolean> {
    const supabase = getSupabaseClient();

    if (!supabase) {
      const local = localStorage.getItem(`${LOCAL_CHALLENGES_KEY}_${date}`);
      if (!local) return false;
      try {
        return JSON.parse(local).completed === true;
      } catch { return false; }
    }

    try {
      const { data } = await supabase
        .from('challenge_completions')
        .select('result_json')
        .eq('user_id', userId)
        .eq('date', date)
        .single();

      return (data?.result_json as { completed?: boolean } | null)?.completed === true;
    } catch {
      return false;
    }
  }

  // ─── Profile ───────────────────────────────────────────────────────────────

  async updateDisplayName(userId: string, name: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      await supabase
        .from('profiles')
        .update({ display_name: name })
        .eq('id', userId);
    } catch (err) {
      console.warn('[Data] Name update failed:', err);
    }
  }
}

export const dataService = new DataService();
