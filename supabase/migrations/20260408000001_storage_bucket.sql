-- Create storage bucket for post media
INSERT INTO storage.buckets (id, name, public) VALUES ('post-media', 'post-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "post_media_upload" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'post-media');

-- Allow public read
CREATE POLICY "post_media_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'post-media');

-- Allow owners to delete their files
CREATE POLICY "post_media_delete" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);
