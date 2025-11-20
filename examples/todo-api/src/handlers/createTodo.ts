import { FastifyRequest, FastifyReply } from "fastify";
import { todoStorage } from "../storage.js";

export async function createTodo(
  request: FastifyRequest<{ Body: { title: string } }>,
  reply: FastifyReply
) {
  const { title } = request.body;
  
  if (!title || typeof title !== "string") {
    reply.status(400).send({
      error: "Bad request",
      message: "Title is required and must be a string"
    });
    return;
  }

  const todo = todoStorage.create({
    title,
    completed: false
  });

  reply.status(201);
  return todo;
}

