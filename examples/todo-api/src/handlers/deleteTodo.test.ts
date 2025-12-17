import { describe, it, expect, beforeEach, vi } from "vitest";
import { deleteTodo } from "./deleteTodo";
import type { DeleteTodoHandlerContext } from "@yamajs/gen";

describe("deleteTodo Handler", () => {
  let mockContext: Partial<DeleteTodoHandlerContext>;
  let mockTodoRepository: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTodoRepository = {
      delete: vi.fn(),
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

  it("should delete a todo successfully and return 204", async () => {
    mockTodoRepository.delete.mockResolvedValue(true);

    const result = await deleteTodo(
      mockContext as DeleteTodoHandlerContext
    );

    expect(mockTodoRepository.delete).toHaveBeenCalledWith("123");
    expect(mockContext.status).toHaveBeenCalledWith(204);
    expect(result).toBeUndefined();
  });

  it("should return 404 when todo not found", async () => {
    mockTodoRepository.delete.mockResolvedValue(false);

    const result = await deleteTodo(
      mockContext as DeleteTodoHandlerContext
    );

    expect(mockTodoRepository.delete).toHaveBeenCalledWith("123");
    expect(mockContext.status).toHaveBeenCalledWith(404);
    expect(result).toEqual({
      error: "Not found",
      message: 'Todo with id "123" not found',
    });
  });

  it("should handle different todo IDs", async () => {
    mockContext.params = { id: "456" };
    mockTodoRepository.delete.mockResolvedValue(true);

    await deleteTodo(
      mockContext as DeleteTodoHandlerContext
    );

    expect(mockTodoRepository.delete).toHaveBeenCalledWith("456");
    expect(mockContext.status).toHaveBeenCalledWith(204);
  });

  it("should propagate database errors", async () => {
    const error = new Error("Database delete failed");
    mockTodoRepository.delete.mockRejectedValue(error);

    await expect(
      deleteTodo(
        mockContext as DeleteTodoHandlerContext
      )
    ).rejects.toThrow("Database delete failed");
  });
});

