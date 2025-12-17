import type { ParsedOperation } from "./types.js";
/**
 * Extract entity name from operation name
 * Examples:
 * - listPosts -> Post
 * - getPost -> Post
 * - createPost -> Post
 * - listPostComments -> Comment (with parent Post)
 */
export declare function extractEntityName(operationName: string): string | undefined;
/**
 * Infer HTTP method from operation name
 */
export declare function inferMethodFromName(operationName: string): string;
/**
 * Infer operation type from name
 */
export declare function inferOperationType(operationName: string): ParsedOperation["operationType"];
/**
 * Infer path from operation name
 * Examples:
 * - listPosts -> /posts
 * - getPost -> /posts/{id}
 * - createPost -> /posts
 * - updatePost -> /posts/{id}
 * - deletePost -> /posts/{id}
 * - searchPosts -> /posts/search
 * - publishPost -> /posts/{id}/publish
 */
export declare function inferPathFromName(operationName: string, entityName?: string, parentEntity?: string): string;
//# sourceMappingURL=inference.d.ts.map