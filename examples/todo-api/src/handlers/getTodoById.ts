import { FastifyRequest, FastifyReply } from "fastify";
import { getTodoById as dbGetTodoById } from "../db.js";
import type { Todo } from "../types.js"; // Generated types!

export async function getTodoById(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<Todo | void> {
  const { id } = request.params;
  const todo = await dbGetTodoById(id);

  if (!todo) {
    reply.status(404).send({
      error: "Not found",
      message: `Todo with id "${id}" not found`
    });
    return;
  }

  return todo;
}

