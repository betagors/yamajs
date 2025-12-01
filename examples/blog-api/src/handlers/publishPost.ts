import type { PublishPostHandlerContext, Post } from "@yama/gen";

export async function publishPost(
  context: PublishPostHandlerContext
): Promise<Post | { error: string; message: string }> {
  // context.params.id is already typed as string
  const { id } = context.params;
  
  // Use variation method to check if post exists and is not already published
  // This demonstrates using both CRUD (findById) and variation (findByIdAndPublishedIsFalse) methods
  const existingPost = await context.entities.Post.findByIdAndPublishedIsFalse(id);
  
  if (!existingPost) {
    // Check if post exists at all using CRUD method
    const post = await context.entities.Post.findById(id);
    if (!post) {
      context.status(404);
      return {
        error: "Not found",
        message: `Post with id "${id}" not found`,
      };
    }
    // Post exists but is already published
    context.status(400);
    return {
      error: "Bad request",
      message: `Post with id "${id}" is already published`,
    };
  }

  // Use CRUD update method to publish the post
  const updated = await context.entities.Post.update(id, {
    published: true,
    publishedAt: new Date().toISOString(),
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
