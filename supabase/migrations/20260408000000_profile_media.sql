-- Add location + P&L visibility to users
ALTER TABLE public.users ADD COLUMN location text;
ALTER TABLE public.users ADD COLUMN pnl_visible boolean DEFAULT true NOT NULL;

-- Post media (carousel support)
CREATE TABLE public.post_media (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('image', 'video', 'text')),
  url text,
  body text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX ON public.post_media(post_id, sort_order);

-- RLS
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_media_read_all" ON public.post_media FOR SELECT USING (true);
CREATE POLICY "post_media_insert_own" ON public.post_media FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND user_id = auth.uid()));
CREATE POLICY "post_media_delete_own" ON public.post_media FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND user_id = auth.uid()));
