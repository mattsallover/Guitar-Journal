/*
  # Add onboarding status to users table

  1. New Column
    - `has_onboarded` (boolean, default false)
      - Tracks whether user has completed the onboarding process
      - Defaults to false for new users
      - Used to determine when to show onboarding modal and populate sample data

  2. Security
    - No additional RLS policies needed as this inherits existing user policies
*/

-- Add has_onboarded column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'has_onboarded'
  ) THEN
    ALTER TABLE public.users 
    ADD COLUMN has_onboarded BOOLEAN DEFAULT FALSE;
  END IF;
END $$;