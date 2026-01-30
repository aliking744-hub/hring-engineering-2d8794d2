-- Add chapter tracking and phase-specific metadata to unicorn_analyses
ALTER TABLE public.unicorn_analyses 
ADD COLUMN IF NOT EXISTS chapter TEXT DEFAULT 'chapter_1',
ADD COLUMN IF NOT EXISTS chapter_1_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS chapter_1_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS chapter_2_stable BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS chapter_2_stable_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS shadow_cabinet JSONB,
ADD COLUMN IF NOT EXISTS regulatory_shield JSONB,
ADD COLUMN IF NOT EXISTS milestone_funding JSONB,
ADD COLUMN IF NOT EXISTS api_connections JSONB,
ADD COLUMN IF NOT EXISTS pivot_history JSONB,
ADD COLUMN IF NOT EXISTS health_alerts JSONB;

-- Add index for faster chapter queries
CREATE INDEX IF NOT EXISTS idx_unicorn_analyses_chapter ON public.unicorn_analyses(chapter);
CREATE INDEX IF NOT EXISTS idx_unicorn_analyses_user_chapter ON public.unicorn_analyses(user_id, chapter);