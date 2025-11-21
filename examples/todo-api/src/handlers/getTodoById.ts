import type { HttpRequest, HttpResponse } from "@yama/core";
import { todoRepository } from "@yama/db";
import type { Todo } from "@yama/types";

export async function getTodoById(
  request: HttpRequest,
  reply: HttpResponse
): Promise<Todo | void> {
  const params = request.params as { id: string };
  const { id } = params;
  const todo = await todoRepository.findById(id);

  if (!todo) {
    reply.status(404).send({
      error: "Not found",
      message: `Todo with id "${id}" not found`
    });
    return;
  }

  return todo;
}

