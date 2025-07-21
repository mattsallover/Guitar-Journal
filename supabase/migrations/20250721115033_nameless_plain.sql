/*
  # AI Coach Conversations Storage

  1. New Tables
    - `coach_conversations`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `message` (text, user's message)
      - `response` (text, AI's response)  
      - `created_at` (timestamp)
      - `session_context` (jsonb, summarized practice data when conversation started)

  2. Security
    - Enable RLS on `coach_conversations` table
    - Add policy for users to manage own conversations

  3. Performance
    - Index on user_id and created_at for efficient retrieval
    - Automatic cleanup of conversations older than 30 days
*/

CREATE TABLE IF NOT EXISTS coach_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message text NOT NULL,
  response text NOT NULL,
  created_at timestamptz DEFAULT now(),
  session_context jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE coach_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own conversations"
  ON coach_conversations
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS coach_conversations_user_id_date_idx 
  ON coach_conversations(user_id, created_at DESC);

-- Function to cleanup old conversations (runs daily)
CREATE OR REPLACE FUNCTION cleanup_old_conversations()
RETURNS void AS $$
BEGIN
  DELETE FROM coach_conversations 
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;