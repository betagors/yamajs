import { copyFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

const srcPath = join(rootDir, "src", "yama.schema.json");
const destPath = join(rootDir, "dist", "yama-cli", "src", "yama.schema.json");

try {
  // Ensure destination directory exists
  mkdirSync(dirname(destPath), { recursive: true });
  // Copy the schema file
  copyFileSync(srcPath, destPath);
  console.log("✅ Copied yama.schema.json to dist");
} catch (error) {
  console.error("❌ Failed to copy schema file:", error);
  process.exit(1);
}

