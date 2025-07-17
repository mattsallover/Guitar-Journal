/*
  # Setup Storage for Practice Session Recordings

  1. Storage Bucket Setup
    - Creates the `recordings` storage bucket (if it doesn't exist)
    - Enables public access for file URLs
    - Sets file size limits and allowed file types

  2. Security Policies
    - Allow authenticated users to upload files to their own folder
    - Allow authenticated users to view their own files
    - Allow authenticated users to delete their own files

  Note: The bucket creation may need to be done manually through the Supabase dashboard
  if this SQL approach doesn't work in your environment.
*/

-- Insert the bucket configuration (this creates the bucket)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recordings',
  'recordings', 
  true,
  52428800, -- 50MB limit
  ARRAY['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm', 'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on the storage.objects table for our bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to upload files to their own user folder
CREATE POLICY "Users can upload recordings to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Allow authenticated users to view their own recordings
CREATE POLICY "Users can view own recordings"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Allow authenticated users to delete their own recordings
CREATE POLICY "Users can delete own recordings"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Allow authenticated users to update their own recordings metadata
CREATE POLICY "Users can update own recordings"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);