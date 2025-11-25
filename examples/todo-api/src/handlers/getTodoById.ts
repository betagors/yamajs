import type { HandlerContext } from "@betagors/yama-core";
import { todoRepository } from "@yama/db";
import type { Todo } from "@yama/types";

export async function getTodoById(
  context: HandlerContext
): Promise<Todo | { error: string; message: string }> {
  const params = context.params as { id: string };
  const { id } = params;
  const todo = await todoRepository.findById(id);

  if (!todo) {
    context.status(404);
    return {
      error: "Not found",
      message: `Todo with id "${id}" not found`
    };
  }

  return todo;
}

