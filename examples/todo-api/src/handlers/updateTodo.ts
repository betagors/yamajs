import type { HandlerContext } from "@betagors/yama-core";
import { todoRepository } from "@yama/db";
import type { UpdateTodoInput } from "@yama/types";

export async function updateTodo(
  context: HandlerContext
) {
  const params = context.params as { id: string };
  const { id } = params;
  const updated = await todoRepository.update(id, context.body as UpdateTodoInput);

  if (!updated) {
    context.status(404);
    return {
      error: "Not found",
      message: `Todo with id "${id}" not found`
    };
  }

  return updated;
}

