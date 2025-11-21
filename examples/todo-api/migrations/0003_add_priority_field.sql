-- Add table: todos
CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  description TEXT,
  priority INTEGER DEFAULT 0
);
-- Add index: todos_completed_idx on todos
CREATE INDEX IF NOT EXISTS todos_completed_idx ON todos (completed);