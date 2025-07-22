/*
  # Add media support to repertoire

  1. Changes
    - Add `media` column to `repertoire` table to store audio/video files
    - Column will store JSONB array of media objects (similar to practice_sessions.recordings)

  2. Security
    - Existing RLS policies will apply to the new column
*/

ALTER TABLE repertoire ADD COLUMN IF NOT EXISTS media jsonb DEFAULT '[]'::jsonb;