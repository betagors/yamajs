import { FastifyRequest, FastifyReply } from "fastify";
import { todoStorage } from "../storage.js";
import type { UpdateTodoInput } from "../types.js"; // Generated types!

export async function updateTodo(
  request: FastifyRequest<{ 
    Params: { id: string };
    Body: UpdateTodoInput;
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;
  const updates = request.body;

  const updated = todoStorage.update(id, updates);

  if (!updated) {
    reply.status(404).send({
      error: "Not found",
      message: `Todo with id "${id}" not found`
    });
    return;
  }

  return updated;
}

