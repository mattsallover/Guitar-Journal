/*
  # Fix RLS policies for users table

  1. Security Updates
    - Drop existing RLS policies that use incorrect uid() function
    - Create new policies using correct auth.uid() function
    - Allow authenticated users to insert their own profile
    - Allow authenticated users to read and update their own profile

  This fixes the "new row violates row-level security policy" error
  by ensuring the RLS policies use the correct Supabase auth functions.
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;

-- Create new policies with correct auth.uid() function
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