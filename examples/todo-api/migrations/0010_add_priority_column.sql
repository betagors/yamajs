-- Add column: todos.priority
ALTER TABLE todos ADD COLUMN priority INTEGER;
-- Add index: todos_priority_idx on todos
CREATE INDEX IF NOT EXISTS todos_priority_idx ON todos (priority);