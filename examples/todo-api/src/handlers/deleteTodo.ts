import type { HandlerContext } from "@betagors/yama-core";
import { todoRepository } from "@yama/db";

export async function deleteTodo(
  context: HandlerContext
) {
  const params = context.params as { id: string };
  const { id } = params;
  const deleted = await todoRepository.delete(id);

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

