import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTodo } from "./createTodo.ts";
import type { HttpRequest, HttpResponse } from "@yama/core";
import type { CreateTodoInput } from "../types.ts";
import { todoRepository } from "../generated/db/repository.ts";

// Mock the repository
vi.mock("../generated/db/repository.ts", () => ({
  todoRepository: {
    create: vi.fn(),
  },
}));

describe("createTodo Handler", () => {
  let mockRequest: Partial<HttpRequest>;
  let mockReply: Partial<HttpResponse>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      body: {
        title: "Test Todo",
        completed: false,
      },
    };

    mockReply = {
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
      mockRequest as HttpRequest,
      mockReply as HttpResponse
    );

    expect(todoRepository.create).toHaveBeenCalledWith(mockRequest.body);
    expect(mockReply.status).toHaveBeenCalledWith(201);
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

    mockRequest.body = input;
    vi.mocked(todoRepository.create).mockResolvedValue(mockTodo);

    const result = await createTodo(
      mockRequest as HttpRequest,
      mockReply as HttpResponse
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

    mockRequest.body = input;
    vi.mocked(db.createTodo).mockResolvedValue(mockTodo);

    const result = await createTodo(
      mockRequest as HttpRequest,
      mockReply as HttpResponse
    );

    expect(result.completed).toBe(true);
  });

  it("should propagate database errors", async () => {
    const error = new Error("Database connection failed");
    vi.mocked(todoRepository.create).mockRejectedValue(error);

    await expect(
      createTodo(
        mockRequest as HttpRequest,
        mockReply as HttpResponse
      )
    ).rejects.toThrow("Database connection failed");
  });
});

