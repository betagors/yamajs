import { FastifyRequest, FastifyReply } from "fastify";
import { getAllTodos } from "../db.js";
import type { TodoList } from "../types.js"; // Generated types!

interface GetTodosQuery {
  completed?: boolean;
  limit?: number;
  offset?: number;
}

export async function getTodos(
  request: FastifyRequest<{ Querystring: GetTodosQuery }>,
  reply: FastifyReply
): Promise<TodoList> {
  const { completed, limit, offset = 0 } = request.query;
  
  const todos = await getAllTodos(completed, limit, offset);
  
  return {
    todos
  };
}

