/*
  # Create practice playlists table

  1. New Tables
    - `practice_playlists`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `name` (text, playlist name)
      - `description` (text, optional description)
      - `videos` (jsonb array, YouTube video data)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `practice_playlists` table
    - Add policies for authenticated users to manage their own playlists
*/

CREATE TABLE IF NOT EXISTS practice_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  videos jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE practice_playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own playlists"
  ON practice_playlists
  FOR ALL
  TO authenticated
  USING (user_id = uid())
  WITH CHECK (user_id = uid());

CREATE INDEX practice_playlists_user_id_idx ON practice_playlists (user_id, created_at DESC);