import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function getTypeSystemResource(uri: string): Promise<{
  contents: Array<{ uri: string; mimeType: string; text: string }>;
}> {
  const docPath = join(__dirname, "docs", "type-system.md");
  
  try {
    const content = readFileSync(docPath, "utf-8");
    
    return {
      contents: [
        {
          uri: "schema://docs/type-system",
          mimeType: "text/markdown",
          text: content,
        },
      ],
    };
  } catch (error) {
    throw new Error(
      `Failed to read type system documentation: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
