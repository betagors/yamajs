import type { HttpRequest, HttpResponse } from "@yama/core";
import { todoRepository } from "@yama/db";

export async function deleteTodo(
  request: HttpRequest,
  reply: HttpResponse
) {
  const params = request.params as { id: string };
  const { id } = params;
  const deleted = await todoRepository.delete(id);

  if (!deleted) {
    reply.status(404).send({
      error: "Not found",
      message: `Todo with id "${id}" not found`
    });
    return;
  }

  reply.status(204).send();
}

