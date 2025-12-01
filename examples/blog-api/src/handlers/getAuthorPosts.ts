import type { GetAuthorPostsHandlerContext, Post } from "@yama/gen";

export async function getAuthorPosts(
  context: GetAuthorPostsHandlerContext
): Promise<Post[]> {
  // context.params.id is already typed as string
  const { id } = context.params;

  // Use CRUD findAll method (authorId is auto-generated from relation, not a queryable field)
  // Filter in memory since repository doesn't have findByAuthorId variation method
  const allPosts = await context.entities.Post.findAll();
  const posts = allPosts.filter((post: any) => post.authorId === id);

  return posts;
}
