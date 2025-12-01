import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTodos } from "./getTodos.ts";
import type { HandlerContext } from "@betagors/yama-core";

describe("getTodos Handler", () => {
  let mockContext: Partial<HandlerContext>;
  let mockTodoRepository: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTodoRepository = {
      findAll: vi.fn(),
    };

    mockContext = {
      query: {},
      status: vi.fn().mockReturnThis(),
      entities: {
        Todo: mockTodoRepository,
      },
    };
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

    mockTodoRepository.findAll.mockResolvedValue(mockTodos);

    const result = await getTodos(
      mockContext as HandlerContext
    );

    expect(mockTodoRepository.findAll).toHaveBeenCalledWith({ completed: undefined, limit: undefined, offset: 0 });
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

    mockContext.query = { completed: true };
    mockTodoRepository.findAll.mockResolvedValue(mockTodos);

    const result = await getTodos(
      mockContext as HandlerContext
    );

    expect(mockTodoRepository.findAll).toHaveBeenCalledWith({ completed: true, limit: undefined, offset: 0 });
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

    mockContext.query = { completed: false };
    mockTodoRepository.findAll.mockResolvedValue(mockTodos);

    const result = await getTodos(
      mockContext as HandlerContext
    );

    expect(mockTodoRepository.findAll).toHaveBeenCalledWith({ completed: false, limit: undefined, offset: 0 });
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

    mockContext.query = { limit: 10 };
    mockTodoRepository.findAll.mockResolvedValue(mockTodos);

    await getTodos(
      mockContext as HandlerContext
    );

    expect(mockTodoRepository.findAll).toHaveBeenCalledWith({ completed: undefined, limit: 10, offset: 0 });
  });

  it("should apply offset", async () => {
    const mockTodos: any[] = [];

    mockContext.query = { offset: 5 };
    mockTodoRepository.findAll.mockResolvedValue(mockTodos);

    await getTodos(
      mockContext as HandlerContext
    );

    expect(mockTodoRepository.findAll).toHaveBeenCalledWith({ completed: undefined, limit: undefined, offset: 5 });
  });

  it("should combine query parameters", async () => {
    const mockTodos: any[] = [];

    mockContext.query = {
      completed: true,
      limit: 20,
      offset: 10,
    };
    mockTodoRepository.findAll.mockResolvedValue(mockTodos);

    await getTodos(
      mockContext as HandlerContext
    );

    expect(mockTodoRepository.findAll).toHaveBeenCalledWith({ completed: true, limit: 20, offset: 10 });
  });

  it("should return empty array when no todos exist", async () => {
    mockTodoRepository.findAll.mockResolvedValue([]);

    const result = await getTodos(
      mockContext as HandlerContext
    );

    expect(result).toEqual({ todos: [] });
  });

  it("should propagate database errors", async () => {
    const error = new Error("Database query failed");
    mockTodoRepository.findAll.mockRejectedValue(error);

    await expect(
      getTodos(
        mockContext as HandlerContext
      )
    ).rejects.toThrow("Database query failed");
  });
});

