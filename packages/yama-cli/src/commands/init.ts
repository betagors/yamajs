import { writeFileSync, existsSync, readFileSync, appendFileSync } from "fs";
import { join, basename } from "path";
import { ensureDir, readPackageJson, writePackageJson } from "../utils/file-utils.js";
import { getYamaDir, getDbDir, getSdkDir } from "../utils/paths.js";

interface InitOptions {
  name?: string;
  version?: string;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const cwd = process.cwd();
  const projectName = options.name || getProjectName(cwd);
  const version = options.version || "1.0.0";

  console.log("🚀 Initializing Yama project...\n");

  // Create yama.yaml
  const yamaConfig = {
    name: projectName,
    version: version,
    schemas: {
      Example: {
        fields: {
          id: { type: "string", required: true },
          name: { type: "string", required: true }
        }
      }
    },
    endpoints: [
      {
        path: "/examples",
        method: "GET",
        handler: "getExamples",
        response: {
          type: "Example"
        }
      }
    ]
  };

  const yamlContent = `name: ${projectName}
version: ${version}

schemas:
  Example:
    fields:
      id:
        type: string
        required: true
      name:
        type: string
        required: true

endpoints:
  - path: /examples
    method: GET
    handler: getExamples
    response:
      type: Example
`;

  const yamaPath = join(cwd, "yama.yaml");
  if (existsSync(yamaPath)) {
    console.log("⚠️  yama.yaml already exists, skipping...");
  } else {
    writeFileSync(yamaPath, yamlContent, "utf-8");
    console.log("✅ Created yama.yaml");
  }

  // Create src/handlers directory
  const handlersDir = join(cwd, "src", "handlers");
  ensureDir(handlersDir);
  console.log("✅ Created src/handlers/ directory");

  // Create .yama directory structure
  const yamaDir = getYamaDir(cwd);
  ensureDir(yamaDir);
  ensureDir(getDbDir(cwd));
  ensureDir(getSdkDir(cwd));
  console.log("✅ Created .yama/ directory structure");

  // Create example handler
  const exampleHandlerPath = join(handlersDir, "getExamples.ts");
  if (!existsSync(exampleHandlerPath)) {
    const handlerContent = `import type { HttpRequest, HttpResponse } from "@yama/core";
import type { Example } from "@yama/types";

export async function getExamples(
  request: HttpRequest,
  reply: HttpResponse
): Promise<Example> {
  return {
    id: "1",
    name: "Example"
  };
}
`;
    writeFileSync(exampleHandlerPath, handlerContent, "utf-8");
    console.log("✅ Created example handler: src/handlers/getExamples.ts");
  }

  // Update package.json if it exists
  const packageJsonPath = join(cwd, "package.json");
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = readPackageJson(packageJsonPath);
      
      // Add scripts if they don't exist
      if (!pkg.scripts) {
        pkg.scripts = {};
      }
      
      const scripts = pkg.scripts as Record<string, string>;
      if (!scripts["yama:dev"]) {
        scripts["yama:dev"] = "yama dev";
      }
      if (!scripts["yama:generate"]) {
        scripts["yama:generate"] = "yama generate";
      }
      if (!scripts["yama:validate"]) {
        scripts["yama:validate"] = "yama validate";
      }

      writePackageJson(packageJsonPath, pkg);
      console.log("✅ Added scripts to package.json");
    } catch (error) {
      console.log("⚠️  Could not update package.json:", error instanceof Error ? error.message : String(error));
    }
  } else {
    console.log("ℹ️  No package.json found - run 'npm init' first");
  }

  // Update .gitignore
  const gitignorePath = join(cwd, ".gitignore");
  const gitignoreEntry = "\n# Yama generated files\n.yama/\n";

  if (existsSync(gitignorePath)) {
    const currentContent = readFileSync(gitignorePath, "utf-8");
    // Remove old entries if they exist
    const cleanedContent = currentContent
      .replace(/\n# Yama generated files\n.*generated\/.*\n/g, "")
      .replace(/\n\.yama\/\n/g, "");
    
    if (!cleanedContent.includes(".yama/")) {
      writeFileSync(gitignorePath, cleanedContent + gitignoreEntry, "utf-8");
      console.log("✅ Updated .gitignore");
    }
  } else {
    writeFileSync(gitignorePath, gitignoreEntry.trimStart(), "utf-8");
    console.log("✅ Created .gitignore");
  }

  console.log("\n✨ Yama project initialized!");
  console.log("\nNext steps:");
  console.log("  1. Install dependencies: npm install @yama/runtime-node");
  console.log("  2. Start dev server: yama dev");
  console.log("  3. Generate types: yama generate");
}

function getProjectName(cwd: string): string {
  try {
    const pkg = readPackageJson();
    if (pkg.name && typeof pkg.name === "string") {
      return pkg.name;
    }
  } catch {
    // Ignore
  }
  
  // Fallback to directory name
  return basename(cwd);
}

