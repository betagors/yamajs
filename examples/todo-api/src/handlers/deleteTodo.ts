import { FastifyRequest, FastifyReply } from "fastify";
import { todoStorage } from "../storage.js";

export async function deleteTodo(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = request.params;
  const deleted = todoStorage.delete(id);

  if (!deleted) {
    reply.status(404).send({
      error: "Not found",
      message: `Todo with id "${id}" not found`
    });
    return;
  }

  reply.status(204).send();
}

