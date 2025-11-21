import { describe, it, expect, beforeEach, vi } from "vitest";
import { updateTodo } from "./updateTodo.js";
import type { HttpRequest, HttpResponse } from "@yama/core";
import type { UpdateTodoInput } from "../types.js";
import { todoRepository } from "../generated/db/repository.js";

// Mock the repository
vi.mock("../generated/db/repository.js", () => ({
  todoRepository: {
    update: vi.fn(),
  },
}));

describe("updateTodo Handler", () => {
  let mockRequest: Partial<HttpRequest>;
  let mockReply: Partial<HttpResponse>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      params: {
        id: "123",
      },
      body: {
        title: "Updated Todo",
        completed: true,
      },
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
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
      mockRequest as HttpRequest,
      mockReply as HttpResponse
    );

    expect(todoRepository.update).toHaveBeenCalledWith("123", mockRequest.body);
    expect(result).toEqual(mockTodo);
    expect(mockReply.status).not.toHaveBeenCalled();
  });

  it("should return 404 when todo not found", async () => {
    vi.mocked(todoRepository.update).mockResolvedValue(null);

    const result = await updateTodo(
      mockRequest as HttpRequest,
      mockReply as HttpResponse
    );

    expect(todoRepository.update).toHaveBeenCalledWith("123", mockRequest.body);
    expect(result).toBeUndefined();
    expect(mockReply.status).toHaveBeenCalledWith(404);
    expect(mockReply.send).toHaveBeenCalledWith({
      error: "Not found",
      message: 'Todo with id "123" not found',
    });
  });

  it("should handle partial updates - only title", async () => {
    const input = { title: "New Title" };
    const mockTodo = {
      id: "123",
      title: "New Title",
      completed: false,
      createdAt: new Date().toISOString(),
    };

    mockRequest.body = input;
    vi.mocked(todoRepository.update).mockResolvedValue(mockTodo);

    const result = await updateTodo(
      mockRequest as HttpRequest,
      mockReply as HttpResponse
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

    mockRequest.body = input;
    vi.mocked(todoRepository.update).mockResolvedValue(mockTodo);

    const result = await updateTodo(
      mockRequest as HttpRequest,
      mockReply as HttpResponse
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

    mockRequest.body = input;
    vi.mocked(todoRepository.update).mockResolvedValue(mockTodo);

    const result = await updateTodo(
      mockRequest as HttpRequest,
      mockReply as HttpResponse
    );

    expect(todoRepository.update).toHaveBeenCalledWith("123", input);
    expect(result).toEqual(mockTodo);
  });

  it("should propagate database errors", async () => {
    const error = new Error("Database update failed");
    vi.mocked(todoRepository.update).mockRejectedValue(error);

    await expect(
      updateTodo(
        mockRequest as HttpRequest,
        mockReply as HttpResponse
      )
    ).rejects.toThrow("Database update failed");
  });
});

