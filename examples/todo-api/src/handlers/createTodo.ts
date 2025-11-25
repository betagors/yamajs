import type { HandlerContext } from "@betagors/yama-core";
import { todoRepository } from "@yama/db";
import type { CreateTodoInput } from "@yama/types";

export async function createTodo(
  context: HandlerContext
) {
  // Validation is now automatic! Just use the data
  const todo = await todoRepository.create(context.body as CreateTodoInput);

  // Framework automatically sets 201 for POST, but we can be explicit
  context.status(201);
  return todo;
}

