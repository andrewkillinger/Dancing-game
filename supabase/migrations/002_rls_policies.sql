-- Wobble Dance – Row Level Security Policies
-- Run AFTER 001_initial_schema.sql

-- ─── Enable RLS ───────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_completions ENABLE ROW LEVEL SECURITY;

-- ─── Profiles ─────────────────────────────────────────────────────────────────

-- Users can read their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can insert their own profile (on sign-up)
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ─── Scores ───────────────────────────────────────────────────────────────────

-- Anyone authenticated can read scores (for leaderboard)
-- We expose only safe fields via the leaderboard query (joined with display_name)
CREATE POLICY "scores_select_all"
  ON public.scores FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Users can insert their own scores
CREATE POLICY "scores_insert_own"
  ON public.scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own scores (not normally used but kept for flexibility)
CREATE POLICY "scores_update_own"
  ON public.scores FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own scores
CREATE POLICY "scores_delete_own"
  ON public.scores FOR DELETE
  USING (auth.uid() = user_id);

-- ─── Outfits ──────────────────────────────────────────────────────────────────

-- Users can only see their own outfits
CREATE POLICY "outfits_select_own"
  ON public.outfits FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own outfits
CREATE POLICY "outfits_insert_own"
  ON public.outfits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own outfits
CREATE POLICY "outfits_update_own"
  ON public.outfits FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own outfits
CREATE POLICY "outfits_delete_own"
  ON public.outfits FOR DELETE
  USING (auth.uid() = user_id);

-- ─── Challenge Completions ────────────────────────────────────────────────────

-- Users can see their own completions
CREATE POLICY "challenge_completions_select_own"
  ON public.challenge_completions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own completions
CREATE POLICY "challenge_completions_insert_own"
  ON public.challenge_completions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own completions (for upsert)
CREATE POLICY "challenge_completions_update_own"
  ON public.challenge_completions FOR UPDATE
  USING (auth.uid() = user_id);

-- ─── Anonymous auth helper function ──────────────────────────────────────────

-- Helper to ensure anonymous users can still operate
-- (Supabase anonymous sign-in sets auth.role() = 'authenticated' automatically)

-- Grant usage on schema for anon and authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.scores TO authenticated;
GRANT ALL ON public.outfits TO authenticated;
GRANT ALL ON public.challenge_completions TO authenticated;
GRANT SELECT ON public.scores TO anon;
