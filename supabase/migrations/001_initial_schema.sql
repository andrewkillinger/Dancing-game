-- Wobble Dance – Initial Schema
-- Run this in your Supabase SQL editor or via supabase db push

-- ─── Profiles ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  display_name TEXT NOT NULL DEFAULT 'Wobbler',
  customization_json JSONB DEFAULT '{}'::JSONB,
  last_seen   TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'Player profiles with customization data';

-- ─── Scores ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.scores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  score       INTEGER NOT NULL CHECK (score >= 0),
  mode        TEXT NOT NULL DEFAULT 'classic',
  metadata_json JSONB DEFAULT '{}'::JSONB
);

COMMENT ON TABLE public.scores IS 'Player high scores by game mode';
CREATE INDEX IF NOT EXISTS scores_score_idx ON public.scores(score DESC);
CREATE INDEX IF NOT EXISTS scores_user_idx ON public.scores(user_id);

-- ─── Outfits ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.outfits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name        TEXT NOT NULL DEFAULT 'My Outfit',
  customization_json JSONB NOT NULL DEFAULT '{}'::JSONB
);

COMMENT ON TABLE public.outfits IS 'Saved outfit presets in player lockers';
CREATE INDEX IF NOT EXISTS outfits_user_idx ON public.outfits(user_id);

-- ─── Challenge Completions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.challenge_completions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  result_json JSONB DEFAULT '{}'::JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

COMMENT ON TABLE public.challenge_completions IS 'Daily challenge completion records';
CREATE INDEX IF NOT EXISTS challenge_user_date_idx ON public.challenge_completions(user_id, date);
