// This file is auto-generated from yama.yaml
// Do not edit manually - your changes will be overwritten

import type { TodoList, CreateTodoInput, Todo, UpdateTodoInput } from "./types";

export class YamaClient {
  private baseUrl: string;
  private jwtToken: string | null = null;
  private apiKey: string | null = null;

  constructor(baseUrl: string = "http://localhost:3000") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /**
   * Set the base URL for API requests
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /**
   * Set JWT token for authentication
   */
  setToken(token: string): void {
    this.jwtToken = token;
  }

  /**
   * Clear JWT token
   */
  clearToken(): void {
    this.jwtToken = null;
  }

  /**
   * Set API key for authentication
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Clear API key
   */
  clearApiKey(): void {
    this.apiKey = null;
  }

  /**
   * Get all todos
   */
  async getTodos(
    query: {
  completed?: boolean;
  limit?: number;
  offset?: number;
},
    options?: Omit<RequestInit, 'method' | 'body'>
  ): Promise<TodoList> {    let url = `${this.baseUrl}/todos`;
    const queryParams = new URLSearchParams();
    if (query) {
      if (query.completed !== undefined) {
        queryParams.append("completed", String(query.completed));
      }
      if (query.limit !== undefined) {
        queryParams.append("limit", String(query.limit));
      }
      if (query.offset !== undefined) {
        queryParams.append("offset", String(query.offset));
      }
    }
    const queryString = queryParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(this.jwtToken ? { "Authorization": `Bearer ${this.jwtToken}` } : {}),
        ...(this.apiKey ? { "X-API-Key": this.apiKey } : {}),
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json() as TodoList;
  }

  /**
   * Create a new todo
   */
  async createTodo(
    body: CreateTodoInput,
    options?: Omit<RequestInit, 'method' | 'body'>
  ): Promise<Todo> {    let url = `${this.baseUrl}/todos`;
    const bodyStr = JSON.stringify(body);
    const response = await fetch(url, {
      method: "POST",
      body: bodyStr,
      headers: {
        "Content-Type": "application/json",
        ...(this.jwtToken ? { "Authorization": `Bearer ${this.jwtToken}` } : {}),
        ...(this.apiKey ? { "X-API-Key": this.apiKey } : {}),
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json() as Todo;
  }

  /**
   * Get a single todo by ID
   */
  async getTodoById(
    params: {
  id: string;
},
    options?: Omit<RequestInit, 'method' | 'body'>
  ): Promise<Todo> {    let url = `${this.baseUrl}/todos/:id`;
    url = url.replace(/:id/g, String(params.id));
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(this.jwtToken ? { "Authorization": `Bearer ${this.jwtToken}` } : {}),
        ...(this.apiKey ? { "X-API-Key": this.apiKey } : {}),
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json() as Todo;
  }

  /**
   * Update a todo
   */
  async updateTodo(
    params: {
  id: string;
},
    body: UpdateTodoInput,
    options?: Omit<RequestInit, 'method' | 'body'>
  ): Promise<Todo> {    let url = `${this.baseUrl}/todos/:id`;
    url = url.replace(/:id/g, String(params.id));
    const bodyStr = JSON.stringify(body);
    const response = await fetch(url, {
      method: "PUT",
      body: bodyStr,
      headers: {
        "Content-Type": "application/json",
        ...(this.jwtToken ? { "Authorization": `Bearer ${this.jwtToken}` } : {}),
        ...(this.apiKey ? { "X-API-Key": this.apiKey } : {}),
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json() as Todo;
  }

  /**
   * Delete a todo
   */
  async deleteTodo(
    params: {
  id: string;
},
    options?: Omit<RequestInit, 'method' | 'body'>
  ): Promise<void> {    let url = `${this.baseUrl}/todos/:id`;
    url = url.replace(/:id/g, String(params.id));
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(this.jwtToken ? { "Authorization": `Bearer ${this.jwtToken}` } : {}),
        ...(this.apiKey ? { "X-API-Key": this.apiKey } : {}),
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }
}

/**
 * Create a new Yama client instance
 */
export function createClient(baseUrl?: string): YamaClient {
  return new YamaClient(baseUrl);
}

/**
 * Default client instance
 */
export const api = new YamaClient();
