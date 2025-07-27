/*
  # Fix RLS policies for users table

  1. Changes
    - Update RLS policies to use auth.uid() instead of uid()
    - Fix the INSERT policy to allow users to insert their own profile
    - Fix the SELECT and UPDATE policies to use correct auth function

  2. Security
    - Maintains security by ensuring users can only manage their own data
    - Uses proper Supabase auth.uid() function for current user identification
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;

-- Create updated policies with correct auth.uid() function
CREATE POLICY "Users can insert own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can view own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);