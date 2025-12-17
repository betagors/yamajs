import type { GetTodosHandlerContext, TodoList } from "@yamajs/gen";

export async function getTodos(
  context: GetTodosHandlerContext
): Promise<TodoList> {
  // context.query is already typed with completed, limit, offset
  const { completed, limit, offset = 0 } = context.query;
  
  const todos = await context.entities.Todo.findAll({
    completed,
    limit,
    offset
  });
  
  return {
    todos
  };
}

