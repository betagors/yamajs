import type { HttpRequest, HttpResponse } from "@betagors/yama-core";
import { todoRepository } from "@yama/db";
import type { CreateTodoInput } from "@yama/types";

export async function createTodo(
  request: HttpRequest,
  reply: HttpResponse
) {
  // Validation is now automatic! Just use the data
  const todo = await todoRepository.create(request.body as CreateTodoInput);

  reply.status(201);
  return todo;
}

