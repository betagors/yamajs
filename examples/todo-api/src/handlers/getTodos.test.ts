import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTodos } from "./getTodos.ts";
import type { HttpRequest, HttpResponse } from "@yama/core";
import { todoRepository } from "../generated/db/repository.ts";

// Mock the repository
vi.mock("../generated/db/repository.ts", () => ({
  todoRepository: {
    findAll: vi.fn(),
  },
}));

describe("getTodos Handler", () => {
  let mockRequest: Partial<HttpRequest>;
  let mockReply: Partial<HttpResponse>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      query: {},
    };

    mockReply = {};
  });

  it("should return all todos", async () => {
    const mockTodos = [
      {
        id: "1",
        title: "Todo 1",
        completed: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: "2",
        title: "Todo 2",
        completed: true,
        createdAt: new Date().toISOString(),
      },
    ];

    vi.mocked(todoRepository.findAll).mockResolvedValue(mockTodos);

    const result = await getTodos(
      mockRequest as HttpRequest,
      mockReply as HttpResponse
    );

    expect(todoRepository.findAll).toHaveBeenCalledWith({ completed: undefined, limit: undefined, offset: 0 });
    expect(result).toEqual({ todos: mockTodos });
  });

  it("should filter by completed status", async () => {
    const mockTodos = [
      {
        id: "1",
        title: "Completed Todo",
        completed: true,
        createdAt: new Date().toISOString(),
      },
    ];

    mockRequest.query = { completed: true };
    vi.mocked(todoRepository.findAll).mockResolvedValue(mockTodos);

    const result = await getTodos(
      mockRequest as HttpRequest,
      mockReply as HttpResponse
    );

    expect(todoRepository.findAll).toHaveBeenCalledWith({ completed: true, limit: undefined, offset: 0 });
    expect(result.todos).toHaveLength(1);
    expect(result.todos![0].completed).toBe(true);
  });

  it("should filter by completed false", async () => {
    const mockTodos = [
      {
        id: "1",
        title: "Incomplete Todo",
        completed: false,
        createdAt: new Date().toISOString(),
      },
    ];

    mockRequest.query = { completed: false };
    vi.mocked(todoRepository.findAll).mockResolvedValue(mockTodos);

    const result = await getTodos(
      mockRequest as HttpRequest,
      mockReply as HttpResponse
    );

    expect(todoRepository.findAll).toHaveBeenCalledWith({ completed: false, limit: undefined, offset: 0 });
    expect(result.todos![0].completed).toBe(false);
  });

  it("should apply limit", async () => {
    const mockTodos = [
      {
        id: "1",
        title: "Todo 1",
        completed: false,
        createdAt: new Date().toISOString(),
      },
    ];

    mockRequest.query = { limit: 10 };
    vi.mocked(todoRepository.findAll).mockResolvedValue(mockTodos);

    await getTodos(
      mockRequest as HttpRequest,
      mockReply as HttpResponse
    );

    expect(todoRepository.findAll).toHaveBeenCalledWith({ completed: undefined, limit: 10, offset: 0 });
  });

  it("should apply offset", async () => {
    const mockTodos: any[] = [];

    mockRequest.query = { offset: 5 };
    vi.mocked(todoRepository.findAll).mockResolvedValue(mockTodos);

    await getTodos(
      mockRequest as HttpRequest,
      mockReply as HttpResponse
    );

    expect(todoRepository.findAll).toHaveBeenCalledWith({ completed: undefined, limit: undefined, offset: 5 });
  });

  it("should combine query parameters", async () => {
    const mockTodos: any[] = [];

    mockRequest.query = {
      completed: true,
      limit: 20,
      offset: 10,
    };
    vi.mocked(todoRepository.findAll).mockResolvedValue(mockTodos);

    await getTodos(
      mockRequest as HttpRequest,
      mockReply as HttpResponse
    );

    expect(todoRepository.findAll).toHaveBeenCalledWith({ completed: true, limit: 20, offset: 10 });
  });

  it("should return empty array when no todos exist", async () => {
    vi.mocked(todoRepository.findAll).mockResolvedValue([]);

    const result = await getTodos(
      mockRequest as HttpRequest,
      mockReply as HttpResponse
    );

    expect(result).toEqual({ todos: [] });
  });

  it("should propagate database errors", async () => {
    const error = new Error("Database query failed");
    vi.mocked(todoRepository.findAll).mockRejectedValue(error);

    await expect(
      getTodos(
        mockRequest as HttpRequest,
        mockReply as HttpResponse
      )
    ).rejects.toThrow("Database query failed");
  });
});

