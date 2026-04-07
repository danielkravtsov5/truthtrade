-- Add cover_url to users
ALTER TABLE public.users ADD COLUMN cover_url text;

-- Create storage bucket for avatars/covers
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "avatars_upload" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read
CREATE POLICY "avatars_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Allow owners to update (overwrite) their files
CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow owners to delete their files
CREATE POLICY "avatars_delete" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
