import type { GetPostHandlerContext, PostWithAuthor } from "@yama/gen";

export async function getPost(
  context: GetPostHandlerContext
): Promise<PostWithAuthor | { error: string; message: string }> {
  // context.params.id is already typed as string
  const { id } = context.params;
  const post = await context.entities.Post.findById(id);

  if (!post) {
    context.status(404);
    return {
      error: "Not found",
      message: `Post with id "${id}" not found`,
    };
  }

  // Fetch author
  const author = await context.entities.Author.findById(post.author?.id ?? "");

  return {
    ...post,
    author,
  };
}
