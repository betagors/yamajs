import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function getSchemaSyntaxResource(uri: string): Promise<{
  contents: Array<{ uri: string; mimeType: string; text: string }>;
}> {
  const docPath = join(__dirname, "docs", "schema-syntax.md");
  
  try {
    const content = readFileSync(docPath, "utf-8");
    
    return {
      contents: [
        {
          uri: "schema://docs/syntax",
          mimeType: "text/markdown",
          text: content,
        },
      ],
    };
  } catch (error) {
    throw new Error(
      `Failed to read schema syntax documentation: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
