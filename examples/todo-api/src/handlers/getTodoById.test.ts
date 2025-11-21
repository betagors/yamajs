import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTodoById } from "./getTodoById.js";
import type { HttpRequest, HttpResponse } from "@yama/core";
import { todoRepository } from "../generated/db/repository.js";

// Mock the repository
vi.mock("../generated/db/repository.js", () => ({
  todoRepository: {
    findById: vi.fn(),
  },
}));

describe("getTodoById Handler", () => {
  let mockRequest: Partial<HttpRequest>;
  let mockReply: Partial<HttpResponse>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      params: {
        id: "123",
      },
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
  });

  it("should return a todo when found", async () => {
    const mockTodo = {
      id: "123",
      title: "Test Todo",
      completed: false,
      createdAt: new Date().toISOString(),
    };

    vi.mocked(todoRepository.findById).mockResolvedValue(mockTodo);

    const result = await getTodoById(
      mockRequest as HttpRequest,
      mockReply as HttpResponse
    );

    expect(todoRepository.findById).toHaveBeenCalledWith("123");
    expect(result).toEqual(mockTodo);
    expect(mockReply.status).not.toHaveBeenCalled();
  });

  it("should return 404 when todo not found", async () => {
    vi.mocked(todoRepository.findById).mockResolvedValue(null);

    const result = await getTodoById(
      mockRequest as HttpRequest,
      mockReply as HttpResponse
    );

    expect(db.getTodoById).toHaveBeenCalledWith("123");
    expect(result).toBeUndefined();
    expect(mockReply.status).toHaveBeenCalledWith(404);
    expect(mockReply.send).toHaveBeenCalledWith({
      error: "Not found",
      message: 'Todo with id "123" not found',
    });
  });

  it("should handle different todo IDs", async () => {
    const mockTodo = {
      id: "456",
      title: "Another Todo",
      completed: true,
      createdAt: new Date().toISOString(),
    };

    mockRequest.params = { id: "456" };
    vi.mocked(db.getTodoById).mockResolvedValue(mockTodo);

    const result = await getTodoById(
      mockRequest as HttpRequest,
      mockReply as HttpResponse
    );

    expect(db.getTodoById).toHaveBeenCalledWith("456");
    expect(result).toEqual(mockTodo);
  });

  it("should propagate database errors", async () => {
    const error = new Error("Database query failed");
    vi.mocked(todoRepository.findById).mockRejectedValue(error);

    await expect(
      getTodoById(
        mockRequest as HttpRequest,
        mockReply as HttpResponse
      )
    ).rejects.toThrow("Database query failed");
  });
});

