import type { HttpRequest, HttpResponse } from "@betagors/yama-core";
import { todoRepository } from "@yama/db";
import type { UpdateTodoInput } from "@yama/types";

export async function updateTodo(
  request: HttpRequest,
  reply: HttpResponse
) {
  const params = request.params as { id: string };
  const { id } = params;
  const updated = await todoRepository.update(id, request.body as UpdateTodoInput);

  if (!updated) {
    reply.status(404).send({
      error: "Not found",
      message: `Todo with id "${id}" not found`
    });
    return;
  }

  return updated;
}

