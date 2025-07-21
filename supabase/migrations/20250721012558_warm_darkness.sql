/*
  # Add Note Finder Practice Tracking

  1. New Tables
    - `note_finder_practice`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `session_date` (date)
      - `note_name` (text, constrained to valid notes)
      - `string_num` (smallint, 1-6 where 1=high E, 6=low E)
      - `fret_num` (smallint, 0-24)
      - `correct` (boolean)
      - `time_seconds` (smallint)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `note_finder_practice` table
    - Add policy for authenticated users to manage their own data
*/

CREATE TABLE IF NOT EXISTS public.note_finder_practice (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_date date        NOT NULL,
  note_name    text        NOT NULL CHECK (note_name IN (
    'A','A#','B','C','C#','D','D#','E','F','F#','G','G#'
  )),
  string_num   smallint    NOT NULL CHECK (string_num BETWEEN 1 AND 6),
  fret_num     smallint    NOT NULL CHECK (fret_num BETWEEN 0 AND 24),
  correct      boolean     NOT NULL,
  time_seconds smallint    NOT NULL CHECK (time_seconds >= 0),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.note_finder_practice ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own note finder data"
  ON public.note_finder_practice
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add index for performance
CREATE INDEX IF NOT EXISTS note_finder_practice_user_id_date_idx 
  ON public.note_finder_practice (user_id, session_date DESC);