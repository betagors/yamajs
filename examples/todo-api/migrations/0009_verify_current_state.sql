-- Modify column: todos.title
ALTER TABLE todos ALTER COLUMN title TYPE VARCHAR(500);
-- Drop column: todos.description
ALTER TABLE todos DROP COLUMN IF EXISTS description;
-- Drop table: todos_before_0003_delete_description_column
DROP TABLE IF EXISTS todos_before_0003_delete_description_column;