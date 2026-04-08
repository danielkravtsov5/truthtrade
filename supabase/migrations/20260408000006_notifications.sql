-- Notifications table for likes, comments, follows, and new trade alerts
CREATE TABLE public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'new_trade')),
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read, created_at DESC);
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE UNIQUE INDEX idx_notifications_unique_like ON public.notifications(actor_id, user_id, type, post_id) WHERE type = 'like';
CREATE UNIQUE INDEX idx_notifications_unique_follow ON public.notifications(actor_id, user_id, type) WHERE type = 'follow';

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_own" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "update_own" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "insert_auth" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = actor_id);
