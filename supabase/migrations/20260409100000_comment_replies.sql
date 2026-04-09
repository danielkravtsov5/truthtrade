-- Add parent_comment_id for threaded replies
ALTER TABLE public.comments
  ADD COLUMN parent_comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;

CREATE INDEX idx_comments_parent ON public.comments(parent_comment_id);
