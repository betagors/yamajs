import type { HandlerContext } from "@betagors/yama-core";
import { todoRepository } from "@yama/db";
import type { TodoList } from "@yama/types";

export async function getTodos(
  context: HandlerContext
): Promise<TodoList> {
  const query = context.query as {
    completed?: boolean;
    limit?: number;
    offset?: number;
  };
  const { completed, limit, offset = 0 } = query;
  
  const todos = await todoRepository.findAll({
    completed,
    limit,
    offset
  });
  
  return {
    todos
  };
}

