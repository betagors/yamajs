-- Drop index: todos_priority_idx on todos
DROP INDEX IF EXISTS todos_priority_idx;
-- Drop column: todos.priority
ALTER TABLE todos DROP COLUMN IF EXISTS priority CASCADE;