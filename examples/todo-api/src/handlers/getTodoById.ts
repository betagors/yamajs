import { FastifyRequest, FastifyReply } from "fastify";
import { todoStorage } from "../storage.js";

export async function getTodoById(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = request.params;
  const todo = todoStorage.getById(id);

  if (!todo) {
    reply.status(404).send({
      error: "Not found",
      message: `Todo with id "${id}" not found`
    });
    return;
  }

  return todo;
}

