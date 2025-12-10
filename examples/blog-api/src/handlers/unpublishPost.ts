import type { UnpublishPostHandlerContext, Post } from "@yama/gen";

export async function unpublishPost(
  context: UnpublishPostHandlerContext
): Promise<Post | { error: string; message: string }> {
  const { id } = context.params;
  
  // Check if post exists and is published
  const existingPost = await context.entities.Post.findById(id);
  
  if (!existingPost) {
    context.status(404);
    return {
      error: "Not found",
      message: `Post with id "${id}" not found`,
    };
  }
  
  if (!existingPost.published) {
    context.status(400);
    return {
      error: "Bad request",
      message: `Post with id "${id}" is not published`,
    };
  }

  // Unpublish the post
  const updated = await context.entities.Post.update(id, {
    published: false,
    publishedAt: null,
  });

  if (!updated) {
    context.status(404);
    return {
      error: "Not found",
      message: `Post with id "${id}" not found`,
    };
  }

  return updated;
}
