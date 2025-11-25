import { describe, it, expect, beforeEach, vi } from "vitest";
import { updateTodo } from "./updateTodo.ts";
import type { HandlerContext } from "@betagors/yama-core";
import type { UpdateTodoInput } from "../types.ts";
import { todoRepository } from "../generated/db/repository.ts";

// Mock the repository
vi.mock("../generated/db/repository.ts", () => ({
  todoRepository: {
    update: vi.fn(),
  },
}));

describe("updateTodo Handler", () => {
  let mockContext: Partial<HandlerContext>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      params: {
        id: "123",
      },
      body: {
        title: "Updated Todo",
        completed: true,
      },
      status: vi.fn().mockReturnThis(),
    };
  });

  it("should update a todo successfully", async () => {
    const mockTodo = {
      id: "123",
      title: "Updated Todo",
      completed: true,
      createdAt: new Date().toISOString(),
    };

    vi.mocked(todoRepository.update).mockResolvedValue(mockTodo);

    const result = await updateTodo(
      mockContext as HandlerContext
    );

    expect(todoRepository.update).toHaveBeenCalledWith("123", mockContext.body);
    expect(result).toEqual(mockTodo);
    expect(mockContext.status).not.toHaveBeenCalled();
  });

  it("should return 404 when todo not found", async () => {
    vi.mocked(todoRepository.update).mockResolvedValue(null);

    const result = await updateTodo(
      mockContext as HandlerContext
    );

    expect(todoRepository.update).toHaveBeenCalledWith("123", mockContext.body);
    expect(result).toEqual({
      error: "Not found",
      message: 'Todo with id "123" not found',
    });
    expect(mockContext.status).toHaveBeenCalledWith(404);
  });

  it("should handle partial updates - only title", async () => {
    const input = { title: "New Title" };
    const mockTodo = {
      id: "123",
      title: "New Title",
      completed: false,
      createdAt: new Date().toISOString(),
    };

    mockContext.body = input;
    vi.mocked(todoRepository.update).mockResolvedValue(mockTodo);

    const result = await updateTodo(
      mockContext as HandlerContext
    );

    expect(todoRepository.update).toHaveBeenCalledWith("123", input);
    expect(result?.title).toBe("New Title");
  });

  it("should handle partial updates - only completed", async () => {
    const input = { completed: true };
    const mockTodo = {
      id: "123",
      title: "Existing Title",
      completed: true,
      createdAt: new Date().toISOString(),
    };

    mockContext.body = input;
    vi.mocked(todoRepository.update).mockResolvedValue(mockTodo);

    const result = await updateTodo(
      mockContext as HandlerContext
    );

    expect(todoRepository.update).toHaveBeenCalledWith("123", input);
    expect(result?.completed).toBe(true);
  });

  it("should handle empty update body", async () => {
    const input = {};
    const mockTodo = {
      id: "123",
      title: "Existing Title",
      completed: false,
      createdAt: new Date().toISOString(),
    };

    mockContext.body = input;
    vi.mocked(todoRepository.update).mockResolvedValue(mockTodo);

    const result = await updateTodo(
      mockContext as HandlerContext
    );

    expect(todoRepository.update).toHaveBeenCalledWith("123", input);
    expect(result).toEqual(mockTodo);
  });

  it("should propagate database errors", async () => {
    const error = new Error("Database update failed");
    vi.mocked(todoRepository.update).mockRejectedValue(error);

    await expect(
      updateTodo(
        mockContext as HandlerContext
      )
    ).rejects.toThrow("Database update failed");
  });
});

