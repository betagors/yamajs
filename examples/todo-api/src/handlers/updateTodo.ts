import { FastifyRequest, FastifyReply } from "fastify";
import { updateTodo as dbUpdateTodo } from "../db.js";
import type { UpdateTodoInput } from "../types.js"; // Generated types!

export async function updateTodo(
  request: FastifyRequest<{ 
    Params: { id: string };
    Body: UpdateTodoInput;
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;
  const updated = await dbUpdateTodo(id, request.body);

  if (!updated) {
    reply.status(404).send({
      error: "Not found",
      message: `Todo with id "${id}" not found`
    });
    return;
  }

  return updated;
}

