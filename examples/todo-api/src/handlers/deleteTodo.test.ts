import { describe, it, expect, beforeEach, vi } from "vitest";
import { deleteTodo } from "./deleteTodo.js";
import type { HttpRequest, HttpResponse } from "@yama/core";
import { todoRepository } from "../generated/db/repository.js";

// Mock the repository
vi.mock("../generated/db/repository.js", () => ({
  todoRepository: {
    delete: vi.fn(),
  },
}));

describe("deleteTodo Handler", () => {
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

  it("should delete a todo successfully and return 204", async () => {
    vi.mocked(todoRepository.delete).mockResolvedValue(true);

    await deleteTodo(
      mockRequest as HttpRequest,
      mockReply as HttpResponse
    );

    expect(todoRepository.delete).toHaveBeenCalledWith("123");
    expect(mockReply.status).toHaveBeenCalledWith(204);
    expect(mockReply.send).toHaveBeenCalled();
  });

  it("should return 404 when todo not found", async () => {
    vi.mocked(todoRepository.delete).mockResolvedValue(false);

    await deleteTodo(
      mockRequest as HttpRequest,
      mockReply as HttpResponse
    );

    expect(todoRepository.delete).toHaveBeenCalledWith("123");
    expect(mockReply.status).toHaveBeenCalledWith(404);
    expect(mockReply.send).toHaveBeenCalledWith({
      error: "Not found",
      message: 'Todo with id "123" not found',
    });
  });

  it("should handle different todo IDs", async () => {
    mockRequest.params = { id: "456" };
    vi.mocked(db.deleteTodo).mockResolvedValue(true);

    await deleteTodo(
      mockRequest as HttpRequest,
      mockReply as HttpResponse
    );

    expect(db.deleteTodo).toHaveBeenCalledWith("456");
    expect(mockReply.status).toHaveBeenCalledWith(204);
  });

  it("should propagate database errors", async () => {
    const error = new Error("Database delete failed");
    vi.mocked(todoRepository.delete).mockRejectedValue(error);

    await expect(
      deleteTodo(
        mockRequest as HttpRequest,
        mockReply as HttpResponse
      )
    ).rejects.toThrow("Database delete failed");
  });
});

