import type { UpdateTodoHandlerContext, Todo } from "@yamajs/gen";

export async function updateTodo(
  context: UpdateTodoHandlerContext
): Promise<Todo | { error: string; message: string }> {
  // context.params.id is already typed as string
  const { id } = context.params;
  // context.body is already typed as UpdateTodoInput
  const updated = await context.entities.Todo.update(id, context.body);

  if (!updated) {
    context.status(404);
    return {
      error: "Not found",
      message: `Todo with id "${id}" not found`
    };
  }

  return updated;
}

