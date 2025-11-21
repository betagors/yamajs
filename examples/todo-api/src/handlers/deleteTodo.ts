import { FastifyRequest, FastifyReply } from "fastify";
import { deleteTodo as dbDeleteTodo } from "../db.js";

export async function deleteTodo(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = request.params;
  const deleted = await dbDeleteTodo(id);

  if (!deleted) {
    reply.status(404).send({
      error: "Not found",
      message: `Todo with id "${id}" not found`
    });
    return;
  }

  reply.status(204).send();
}

