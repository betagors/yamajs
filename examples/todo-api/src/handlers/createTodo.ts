import type { CreateTodoHandlerContext, Todo } from "@yamajs/gen";

export async function createTodo(
  context: CreateTodoHandlerContext
): Promise<Todo> {
  // context.body is already typed as CreateTodoInput - no need for type assertion!
  // entities are added at runtime, so we need a type assertion here

  const { Todo } = context.entities;

  const todo = await Todo.create(context.body);
  
  return todo;
}
