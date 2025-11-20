import { FastifyRequest, FastifyReply } from "fastify";
import { todoStorage } from "../storage.js";

interface CreateTodoInput {
  title: string;
  completed?: boolean;
}

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

