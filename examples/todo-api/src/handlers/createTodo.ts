import { FastifyRequest, FastifyReply } from "fastify";
import { createTodo as dbCreateTodo } from "../db.js";
import type { CreateTodoInput } from "../types.js"; // Generated types!

export async function createTodo(
  request: FastifyRequest<{ Body: CreateTodoInput }>,
  reply: FastifyReply
) {
  // Validation is now automatic! Just use the data
  const todo = await dbCreateTodo(request.body);

  reply.status(201);
  return todo;
}

