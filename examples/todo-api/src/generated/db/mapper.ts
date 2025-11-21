// This file is auto-generated from yama.yaml
// Do not edit manually - your changes will be overwritten

import type { Todo } from "../../../lib/generated/types";

export function mapTodoEntityToTodo(entity: any): Todo {
  return {
    id: entity.id,
    title: entity.title,
    completed: entity.completed,
    createdAt: entity.created_at ? new Date(entity.created_at).toISOString() : undefined,
  };
}



export function mapTodoToTodoEntity(schema: Todo): Partial<any> {
  return {
    title: schema.title,
    completed: schema.completed,
    created_at: schema.createdAt ? new Date(schema.createdAt) : undefined,
  };
}
