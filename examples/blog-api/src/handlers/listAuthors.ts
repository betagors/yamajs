import type { ListAuthorsHandlerContext, Author } from "@yama/gen";

export async function listAuthors(
  context: ListAuthorsHandlerContext
): Promise<Author[]> {
  // Use CRUD findAll method with search capabilities
  // This demonstrates using CRUD method with optional search/query features
  const authors = await context.entities.Author.findAll({
    // Can add search, limit, offset, orderBy, etc. from query params if needed
    // Example: search: context.query.search, limit: context.query.limit
  });

  return authors;
}
