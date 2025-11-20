// This file is auto-generated from yama.yaml
// Do not edit manually - your changes will be overwritten

export interface Todo {
  id: string;
  title: string;
  completed?: boolean;
  createdAt?: string;
}

export interface CreateTodoInput {
  title: string;
  completed?: boolean;
}

export interface UpdateTodoInput {
  title?: string;
  completed?: boolean;
}

export interface TodoList {
  todos?: Todo[];
}
