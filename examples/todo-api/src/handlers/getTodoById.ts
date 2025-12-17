import type { GetTodoByIdHandlerContext, Todo } from "@yamajs/gen";

export async function getTodoById(
  context: GetTodoByIdHandlerContext
): Promise<Todo | { error: string; message: string }> {
  // context.params.id is already typed as string
  const { id } = context.params;
  const todo = await context.entities.Todo.findById(id);

  if (!todo) {
    context.status(404);
    return {
      error: "Not found",
      message: `Todo with id "${id}" not found`
    };
  }

  return todo;
}

