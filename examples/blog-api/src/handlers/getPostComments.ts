import type { GetPostCommentsHandlerContext, Comment } from "@yama/gen";

export async function getPostComments(
  context: GetPostCommentsHandlerContext
): Promise<Comment[]> {
  // context.params.id is already typed as string
  const { id } = context.params;

  // Use CRUD findAll method (postId is auto-generated from relation, not a queryable field)
  // Filter in memory since repository doesn't have findByPostId variation method
  const allComments = await context.entities.Comment.findAll();
  const comments = allComments.filter((comment: any) => comment.postId === id);

  return comments;
}
