-- Insights: user-authored text posts (not tied to trades)
CREATE TABLE public.insights (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_insights_user_created ON public.insights(user_id, created_at DESC);
CREATE INDEX idx_insights_created ON public.insights(created_at DESC);

-- Insight likes
CREATE TABLE public.insight_likes (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  insight_id uuid NOT NULL REFERENCES public.insights(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, insight_id)
);

CREATE INDEX idx_insight_likes_insight ON public.insight_likes(insight_id);

-- Insight comments
CREATE TABLE public.insight_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  insight_id uuid NOT NULL REFERENCES public.insights(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_insight_comments_insight ON public.insight_comments(insight_id, created_at);

-- RLS
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insight_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insight_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insights_read_all" ON public.insights FOR SELECT USING (true);
CREATE POLICY "insights_insert_own" ON public.insights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "insights_update_own" ON public.insights FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "insights_delete_own" ON public.insights FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "insight_likes_read_all" ON public.insight_likes FOR SELECT USING (true);
CREATE POLICY "insight_likes_own" ON public.insight_likes FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "insight_comments_read_all" ON public.insight_comments FOR SELECT USING (true);
CREATE POLICY "insight_comments_insert_auth" ON public.insight_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "insight_comments_delete_own" ON public.insight_comments FOR DELETE USING (auth.uid() = user_id);

-- Auto-update insights.updated_at
CREATE TRIGGER insights_updated_at
  BEFORE UPDATE ON public.insights
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Add insight_id to notifications
ALTER TABLE public.notifications
  ADD COLUMN insight_id uuid REFERENCES public.insights(id) ON DELETE CASCADE;

-- Expand notification type check to include insight types
ALTER TABLE public.notifications
  DROP CONSTRAINT notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('like', 'comment', 'follow', 'new_trade', 'insight_like', 'insight_comment'));

-- Unique index for insight like notifications
CREATE UNIQUE INDEX idx_notifications_unique_insight_like
  ON public.notifications(actor_id, user_id, type, insight_id) WHERE type = 'insight_like';
