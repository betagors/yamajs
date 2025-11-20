import { FastifyRequest, FastifyReply } from "fastify";
import { todoStorage } from "../storage.js";
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
  
  let todos = todoStorage.getAll();
  
  // Filter by completed status
  if (completed !== undefined) {
    todos = todos.filter(todo => todo.completed === completed);
  }
  
  // Apply pagination
  if (limit) {
    todos = todos.slice(offset, offset + limit);
  }
  
  return {
    todos
  };
}

