import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTodoById } from "./getTodoById.ts";
import type { HandlerContext } from "@yamajs/core";

describe("getTodoById Handler", () => {
  let mockContext: Partial<HandlerContext>;
  let mockTodoRepository: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTodoRepository = {
      findById: vi.fn(),
    };

    mockContext = {
      params: {
        id: "123",
      },
      status: vi.fn().mockReturnThis(),
      entities: {
        Todo: mockTodoRepository,
      },
    };
  });

  it("should return a todo when found", async () => {
    const mockTodo = {
      id: "123",
      title: "Test Todo",
      completed: false,
      createdAt: new Date().toISOString(),
    };

    mockTodoRepository.findById.mockResolvedValue(mockTodo);

    const result = await getTodoById(
      mockContext as HandlerContext
    );

    expect(mockTodoRepository.findById).toHaveBeenCalledWith("123");
    expect(result).toEqual(mockTodo);
    expect(mockContext.status).not.toHaveBeenCalled();
  });

  it("should return 404 when todo not found", async () => {
    mockTodoRepository.findById.mockResolvedValue(null);

    const result = await getTodoById(
      mockContext as HandlerContext
    );

    expect(mockTodoRepository.findById).toHaveBeenCalledWith("123");
    expect(result).toEqual({
      error: "Not found",
      message: 'Todo with id "123" not found',
    });
    expect(mockContext.status).toHaveBeenCalledWith(404);
  });

  it("should handle different todo IDs", async () => {
    const mockTodo = {
      id: "456",
      title: "Another Todo",
      completed: true,
      createdAt: new Date().toISOString(),
    };

    mockContext.params = { id: "456" };
    mockTodoRepository.findById.mockResolvedValue(mockTodo);

    const result = await getTodoById(
      mockContext as HandlerContext
    );

    expect(mockTodoRepository.findById).toHaveBeenCalledWith("456");
    expect(result).toEqual(mockTodo);
  });

  it("should propagate database errors", async () => {
    const error = new Error("Database query failed");
    mockTodoRepository.findById.mockRejectedValue(error);

    await expect(
      getTodoById(
        mockContext as HandlerContext
      )
    ).rejects.toThrow("Database query failed");
  });
});

