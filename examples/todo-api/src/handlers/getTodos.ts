import { FastifyRequest, FastifyReply } from "fastify";
import { todoStorage } from "../storage.js";
import type { TodoList } from "../types.js"; // Generated types!

export async function getTodos(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<TodoList> {
  const todos = todoStorage.getAll();
  return {
    todos
  };
}

