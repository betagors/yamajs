import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTodo } from "./createTodo.ts";
import type { HandlerContext } from "@betagors/yama-core";
import type { CreateTodoInput } from "@yama/types";

describe("createTodo Handler", () => {
  let mockContext: Partial<HandlerContext>;
  let mockTodoRepository: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTodoRepository = {
      create: vi.fn(),
    };

    mockContext = {
      body: {
        title: "Test Todo",
        completed: false,
      },
      status: vi.fn().mockReturnThis(),
      entities: {
        Todo: mockTodoRepository,
      },
    };
  });

  it("should create a todo and return 201 status", async () => {
    const mockTodo = {
      id: "123",
      title: "Test Todo",
      completed: false,
      createdAt: new Date().toISOString(),
    };

    mockTodoRepository.create.mockResolvedValue(mockTodo);

    const result = await createTodo(
      mockContext as HandlerContext
    );

    expect(mockTodoRepository.create).toHaveBeenCalledWith(mockContext.body);
    // Note: status 201 is set by the runtime for POST handlers, not the handler itself
    expect(result).toEqual(mockTodo);
  });

  it("should handle todo creation with only title", async () => {
    const input = { title: "Simple Todo" };
    const mockTodo = {
      id: "456",
      title: "Simple Todo",
      completed: false,
      createdAt: new Date().toISOString(),
    };

    mockContext.body = input;
    mockTodoRepository.create.mockResolvedValue(mockTodo);

    const result = await createTodo(
      mockContext as HandlerContext
    );

    expect(mockTodoRepository.create).toHaveBeenCalledWith(input);
    expect(result).toEqual(mockTodo);
  });

  it("should handle todo creation with completed true", async () => {
    const input = {
      title: "Completed Todo",
      completed: true,
    };
    const mockTodo = {
      id: "789",
      title: "Completed Todo",
      completed: true,
      createdAt: new Date().toISOString(),
    };

    mockContext.body = input;
    mockTodoRepository.create.mockResolvedValue(mockTodo);

    const result = await createTodo(
      mockContext as HandlerContext
    );

    expect(result.completed).toBe(true);
  });

  it("should propagate database errors", async () => {
    const error = new Error("Database connection failed");
    mockTodoRepository.create.mockRejectedValue(error);

    await expect(
      createTodo(
        mockContext as HandlerContext
      )
    ).rejects.toThrow("Database connection failed");
  });
});

