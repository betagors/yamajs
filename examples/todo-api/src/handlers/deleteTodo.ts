import type { DeleteTodoHandlerContext } from "@yamajs/gen";

export async function deleteTodo(
  context: DeleteTodoHandlerContext
): Promise<{ error: string; message: string } | undefined> {
  // context.params.id is already typed as string
  const { id } = context.params;
  const deleted = await context.entities.Todo.delete(id);

  if (!deleted) {
    context.status(404);
    return {
      error: "Not found",
      message: `Todo with id "${id}" not found`
    };
  }

  // Framework automatically sets 204 for DELETE, but we can be explicit
  context.status(204);
  return undefined;
}

