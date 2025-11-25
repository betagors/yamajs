import { describe, it, expect, beforeEach, vi } from "vitest";
import { deleteTodo } from "./deleteTodo.ts";
import type { HandlerContext } from "@betagors/yama-core";
import { todoRepository } from "../generated/db/repository.ts";

// Mock the repository
vi.mock("../generated/db/repository.ts", () => ({
  todoRepository: {
    delete: vi.fn(),
  },
}));

describe("deleteTodo Handler", () => {
  let mockContext: Partial<HandlerContext>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      params: {
        id: "123",
      },
      status: vi.fn().mockReturnThis(),
    };
  });

  it("should delete a todo successfully and return 204", async () => {
    vi.mocked(todoRepository.delete).mockResolvedValue(true);

    const result = await deleteTodo(
      mockContext as HandlerContext
    );

    expect(todoRepository.delete).toHaveBeenCalledWith("123");
    expect(mockContext.status).toHaveBeenCalledWith(204);
    expect(result).toBeUndefined();
  });

  it("should return 404 when todo not found", async () => {
    vi.mocked(todoRepository.delete).mockResolvedValue(false);

    const result = await deleteTodo(
      mockContext as HandlerContext
    );

    expect(todoRepository.delete).toHaveBeenCalledWith("123");
    expect(mockContext.status).toHaveBeenCalledWith(404);
    expect(result).toEqual({
      error: "Not found",
      message: 'Todo with id "123" not found',
    });
  });

  it("should handle different todo IDs", async () => {
    mockContext.params = { id: "456" };
    vi.mocked(todoRepository.delete).mockResolvedValue(true);

    await deleteTodo(
      mockContext as HandlerContext
    );

    expect(todoRepository.delete).toHaveBeenCalledWith("456");
    expect(mockContext.status).toHaveBeenCalledWith(204);
  });

  it("should propagate database errors", async () => {
    const error = new Error("Database delete failed");
    vi.mocked(todoRepository.delete).mockRejectedValue(error);

    await expect(
      deleteTodo(
        mockContext as HandlerContext
      )
    ).rejects.toThrow("Database delete failed");
  });
});

