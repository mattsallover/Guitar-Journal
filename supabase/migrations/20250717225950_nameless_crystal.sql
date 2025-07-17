/*
  # Initial Database Schema for Guitar Practice Journal

  1. New Tables
    - `users`
      - `id` (uuid, primary key) - matches Supabase auth.users.id
      - `name` (text) - user display name
      - `email` (text) - user email
      - `created_at` (timestamp)
    
    - `practice_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `date` (date)
      - `duration` (integer) - in minutes
      - `mood` (text)
      - `techniques` (text array)
      - `songs` (text array)
      - `notes` (text)
      - `tags` (text array)
      - `recordings` (jsonb array)
      - `link` (text)
      - `created_at` (timestamp)

    - `repertoire`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `title` (text)
      - `artist` (text)
      - `difficulty` (text)
      - `mastery` (integer) - 0-100
      - `date_added` (timestamp)
      - `last_practiced` (timestamp)
      - `notes` (text)
      - `created_at` (timestamp)

    - `goals`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `title` (text)
      - `description` (text)
      - `target_date` (date)
      - `status` (text)
      - `progress` (integer) - 0-100
      - `category` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  name text,
  email text,
  created_at timestamptz DEFAULT now()
);

-- Create practice_sessions table
CREATE TABLE IF NOT EXISTS practice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  duration integer NOT NULL,
  mood text NOT NULL,
  techniques text[] DEFAULT '{}',
  songs text[] DEFAULT '{}',
  notes text DEFAULT '',
  tags text[] DEFAULT '{}',
  recordings jsonb DEFAULT '[]',
  link text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create repertoire table
CREATE TABLE IF NOT EXISTS repertoire (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  artist text NOT NULL,
  difficulty text NOT NULL,
  mastery integer DEFAULT 0 CHECK (mastery >= 0 AND mastery <= 100),
  date_added timestamptz DEFAULT now(),
  last_practiced timestamptz,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create goals table
CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  target_date date NOT NULL,
  status text NOT NULL DEFAULT 'Active',
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  category text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE repertoire ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can view own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create policies for practice_sessions table
CREATE POLICY "Users can view own practice sessions"
  ON practice_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own practice sessions"
  ON practice_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own practice sessions"
  ON practice_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own practice sessions"
  ON practice_sessions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for repertoire table
CREATE POLICY "Users can view own repertoire"
  ON repertoire
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own repertoire"
  ON repertoire
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own repertoire"
  ON repertoire
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own repertoire"
  ON repertoire
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for goals table
CREATE POLICY "Users can view own goals"
  ON goals
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own goals"
  ON goals
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
  ON goals
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
  ON goals
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS practice_sessions_user_id_date_idx ON practice_sessions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS repertoire_user_id_title_idx ON repertoire(user_id, title);
CREATE INDEX IF NOT EXISTS goals_user_id_status_idx ON goals(user_id, status);