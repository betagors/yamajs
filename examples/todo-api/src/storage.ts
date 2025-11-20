// Simple in-memory storage for todos
import type { Todo } from "./types.js"; // Generated types!

class TodoStorage {
  private todos: Todo[] = [];

  getAll(): Todo[] {
    return [...this.todos];
  }

  create(todo: Omit<Todo, "id" | "createdAt">): Todo {
    const newTodo: Todo = {
      id: Date.now().toString(),
      ...todo,
      createdAt: new Date().toISOString()
    };
    this.todos.push(newTodo);
    return newTodo;
  }

  getById(id: string): Todo | undefined {
    return this.todos.find(todo => todo.id === id);
  }

  update(id: string, updates: Partial<Todo>): Todo | null {
    const index = this.todos.findIndex(todo => todo.id === id);
    if (index === -1) return null;
    
    this.todos[index] = { ...this.todos[index], ...updates };
    return this.todos[index];
  }

  delete(id: string): boolean {
    const index = this.todos.findIndex(todo => todo.id === id);
    if (index === -1) return false;
    
    this.todos.splice(index, 1);
    return true;
  }
}

export const todoStorage = new TodoStorage();

