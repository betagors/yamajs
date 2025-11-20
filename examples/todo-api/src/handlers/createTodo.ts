import { FastifyRequest, FastifyReply } from "fastify";
import { todoStorage } from "../storage.js";
import type { CreateTodoInput } from "../types.js"; // Generated types!

export async function createTodo(
  request: FastifyRequest<{ Body: CreateTodoInput }>,
  reply: FastifyReply
) {
  // Validation is now automatic! Just use the data
  const { title, completed = false } = request.body;

  const todo = todoStorage.create({
    title,
    completed
  });

  reply.status(201);
  return todo;
}

