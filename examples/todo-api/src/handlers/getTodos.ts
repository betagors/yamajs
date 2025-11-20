import { FastifyRequest, FastifyReply } from "fastify";
import { todoStorage } from "../storage.js";

export async function getTodos(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const todos = todoStorage.getAll();
  return {
    todos
  };
}

