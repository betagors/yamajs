import type { ListPostsHandlerContext, PostWithAuthor } from "@yama/gen";

export async function listPosts(
  context: ListPostsHandlerContext
): Promise<PostWithAuthor[]> {
  // context.query is already typed with published, authorId, limit, offset
  const { published, authorId, limit = 10, offset = 0 } = context.query;

  // Use variation method for published filter when available
  let posts;
  if (published === true || published === "true") {
    // Use variation method: findByPublishedIsTrue
    posts = await context.entities.Post.findByPublishedIsTrue();
  } else if (published === false || published === "false") {
    // Use variation method: findByPublishedIsFalse
    posts = await context.entities.Post.findByPublishedIsFalse();
  } else {
    // Use CRUD method: findAll for all posts
    posts = await context.entities.Post.findAll({
      limit: Number(limit),
      offset: Number(offset),
    });
  }

  // Filter by authorId if provided (using CRUD findAll since authorId is not a queryable field)
  if (authorId) {
    posts = posts.filter((p: any) => p.authorId === authorId);
  }

  // Apply pagination if using variation methods
  if (published !== undefined) {
    posts = posts.slice(Number(offset), Number(offset) + Number(limit));
  }

  // Fetch authors for each post using CRUD methods
  const authorIds = [...new Set(posts.map((p: any) => p.authorId).filter(Boolean))];
  
  // Use Promise.all with findById for each author (more efficient than findAll)
  const authors = await Promise.all(
    authorIds.map(id => context.entities.Author.findById(id))
  ).then(results => results.filter((author): author is NonNullable<typeof author> => author !== null));

  const authorMap = new Map(authors.map((a) => [a.id, a]));

  return posts.map((post: any) => ({
    ...post,
    author: authorMap.get(post.authorId),
  }));
}



