// Database helper - uses generated code
import { getDatabase } from "@yama/db-postgres";
import { todos } from "../generated/db/schema.js";
import { mapTodoEntityToTodo, mapTodoToTodoEntity } from "../generated/db/mapper.js";
import { eq, and } from "drizzle-orm";
import type { Todo } from "../types.js";
import type { CreateTodoInput, UpdateTodoInput } from "../types.js";

const db = getDatabase();

export async function createTodo(input: CreateTodoInput): Promise<Todo> {
  const entityData = mapTodoToTodoEntity(input as any);
  const [entity] = await db.insert(todos).values(entityData).returning();
  return mapTodoEntityToTodo(entity);
}

export async function getTodoById(id: string): Promise<Todo | null> {
  const [entity] = await db.select().from(todos).where(eq(todos.id, id)).limit(1);
  if (!entity) return null;
  return mapTodoEntityToTodo(entity);
}

export async function getAllTodos(completed?: boolean, limit?: number, offset?: number): Promise<Todo[]> {
  let query = db.select().from(todos);
  
  if (completed !== undefined) {
    query = query.where(eq(todos.completed, completed)) as any;
  }
  
  if (limit !== undefined) {
    query = query.limit(limit) as any;
  }
  
  if (offset !== undefined) {
    query = query.offset(offset) as any;
  }
  
  const entities = await query;
  return entities.map(mapTodoEntityToTodo);
}

export async function updateTodo(id: string, input: UpdateTodoInput): Promise<Todo | null> {
  const entityData = mapTodoToTodoEntity(input as any);
  const [entity] = await db.update(todos)
    .set(entityData)
    .where(eq(todos.id, id))
    .returning();
  
  if (!entity) return null;
  return mapTodoEntityToTodo(entity);
}

export async function deleteTodo(id: string): Promise<boolean> {
  const result = await db.delete(todos).where(eq(todos.id, id)).returning();
  return result.length > 0;
}

