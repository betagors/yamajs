import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTodo } from "./createTodo.ts";
import type { HandlerContext } from "@betagors/yama-core";
import type { CreateTodoInput } from "../types.ts";
import { todoRepository } from "../generated/db/repository.ts";

// Mock the repository
vi.mock("../generated/db/repository.ts", () => ({
  todoRepository: {
    create: vi.fn(),
  },
}));

describe("createTodo Handler", () => {
  let mockContext: Partial<HandlerContext>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      body: {
        title: "Test Todo",
        completed: false,
      },
      status: vi.fn().mockReturnThis(),
    };
  });

  it("should create a todo and return 201 status", async () => {
    const mockTodo = {
      id: "123",
      title: "Test Todo",
      completed: false,
      createdAt: new Date().toISOString(),
    };

    vi.mocked(todoRepository.create).mockResolvedValue(mockTodo);

    const result = await createTodo(
      mockContext as HandlerContext
    );

    expect(todoRepository.create).toHaveBeenCalledWith(mockContext.body);
    expect(mockContext.status).toHaveBeenCalledWith(201);
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
    vi.mocked(todoRepository.create).mockResolvedValue(mockTodo);

    const result = await createTodo(
      mockContext as HandlerContext
    );

    expect(todoRepository.create).toHaveBeenCalledWith(input);
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
    vi.mocked(todoRepository.create).mockResolvedValue(mockTodo);

    const result = await createTodo(
      mockContext as HandlerContext
    );

    expect(result.completed).toBe(true);
  });

  it("should propagate database errors", async () => {
    const error = new Error("Database connection failed");
    vi.mocked(todoRepository.create).mockRejectedValue(error);

    await expect(
      createTodo(
        mockContext as HandlerContext
      )
    ).rejects.toThrow("Database connection failed");
  });
});

