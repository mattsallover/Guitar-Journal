/*
  # Add CAGED Sessions Table

  1. New Tables
    - `caged_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `session_date` (date)
      - `shapes` (text array)
      - `accuracy` (smallint, 1-5 scale)
      - `time_seconds` (smallint, completion time)
      - `score` (smallint, calculated 0-100)
      - `notes` (text, optional)
      - `recording` (text, storage path for audio/video)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `caged_sessions` table
    - Add policy for users to manage their own sessions
*/

CREATE TABLE public.caged_sessions (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_date  date         NOT NULL,
  shapes        text[]       NOT NULL,
  accuracy      smallint     NOT NULL CHECK (accuracy BETWEEN 1 AND 5),
  time_seconds  smallint     NOT NULL CHECK (time_seconds >= 0),
  score         smallint     NOT NULL CHECK (score BETWEEN 0 AND 100),
  notes         text         DEFAULT '',
  recording     text         DEFAULT '',
  created_at    timestamptz  NOT NULL DEFAULT now()
);

-- Enable RLS and create policy
ALTER TABLE public.caged_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own CAGED sessions"
  ON public.caged_sessions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create index for better query performance
CREATE INDEX caged_sessions_user_id_date_idx ON public.caged_sessions (user_id, session_date DESC);