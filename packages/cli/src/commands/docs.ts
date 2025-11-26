import { existsSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname, extname } from "path";
import { readYamaConfig, ensureDir, getConfigDir } from "../utils/file-utils.ts";
import { findYamaConfig } from "../utils/project-detection.ts";
import yaml from "js-yaml";

// Dynamic import for openapi package to handle workspace resolution
async function getGenerateOpenAPI() {
  try {
    // @ts-ignore - dynamic import, package may not be available at compile time
    const openapiModule = await import("@betagors/yama-openapi");
    return openapiModule.generateOpenAPI;
  } catch (error) {
    throw new Error(
      `Failed to load @betagors/yama-openapi. Make sure it's built and available. ` +
      `Original error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Type for the OpenAPI spec (using any to avoid import issues)
type OpenAPISpec = any;

interface DocsOptions {
  config?: string;
  format?: string;
  output?: string;
}

export async function docsCommand(options: DocsOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    console.error(`❌ Config file not found: ${configPath}`);
    console.error("   Run 'yama init' to create a yama.yaml file");
    process.exit(1);
  }

  try {
    const generateOpenAPI = await getGenerateOpenAPI();
    const config = readYamaConfig(configPath) as Parameters<typeof generateOpenAPI>[0];
    const openAPISpec = generateOpenAPI(config);

    const format = options.format || "openapi";
    const outputPath = options.output || getDefaultOutputPath(configPath, format);

    await generateDocs(openAPISpec, format, outputPath, configPath);

    console.log(`\n✅ Documentation generated: ${outputPath}`);
  } catch (error) {
    console.error("❌ Documentation generation failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function getDefaultOutputPath(configPath: string, format: string): string {
  const configDir = getConfigDir(configPath);

  switch (format) {
    case "openapi":
    case "json":
      return join(configDir, "openapi.json");
    case "yaml":
      return join(configDir, "openapi.yaml");
    case "swagger-ui":
    case "html":
      return join(configDir, "docs", "index.html");
    case "markdown":
    case "md":
      return join(configDir, "docs", "api.md");
    default:
      return join(configDir, "openapi.json");
  }
}

async function generateDocs(
  spec: OpenAPISpec,
  format: string,
  outputPath: string,
  configPath: string
): Promise<void> {
  const configDir = getConfigDir(configPath);
  // If outputPath is absolute (starts with / or has drive letter), use it as-is
  // Otherwise, treat it as relative to the config directory
  const isAbsolute = outputPath.length > 0 && (
    outputPath[0] === '/' || 
    (outputPath.length > 1 && outputPath[1] === ':') ||
    outputPath.startsWith(configDir)
  );
  const absoluteOutputPath = isAbsolute ? outputPath : join(configDir, outputPath);
  const outputDir = dirname(absoluteOutputPath);

  ensureDir(outputDir);

  switch (format.toLowerCase()) {
    case "openapi":
    case "json":
      writeFileSync(absoluteOutputPath, JSON.stringify(spec, null, 2), "utf-8");
      break;

    case "yaml":
      writeFileSync(absoluteOutputPath, yaml.dump(spec, { indent: 2 }), "utf-8");
      break;

    case "swagger-ui":
    case "html":
      const html = generateSwaggerUIHTML(spec);
      writeFileSync(absoluteOutputPath, html, "utf-8");
      break;

    case "markdown":
    case "md":
      const markdown = generateMarkdown(spec);
      writeFileSync(absoluteOutputPath, markdown, "utf-8");
      break;

    default:
      // Auto-detect from extension
      const ext = extname(outputPath).toLowerCase();
      if (ext === ".yaml" || ext === ".yml") {
        writeFileSync(absoluteOutputPath, yaml.dump(spec, { indent: 2 }), "utf-8");
      } else if (ext === ".html") {
        const html = generateSwaggerUIHTML(spec);
        writeFileSync(absoluteOutputPath, html, "utf-8");
      } else if (ext === ".md") {
        const markdown = generateMarkdown(spec);
        writeFileSync(absoluteOutputPath, markdown, "utf-8");
      } else {
        // Default to JSON
        writeFileSync(absoluteOutputPath, JSON.stringify(spec, null, 2), "utf-8");
      }
  }
}

function generateSwaggerUIHTML(spec: OpenAPISpec): string {
  const specJson = JSON.stringify(spec, null, 2);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${spec.info.title} - API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin:0;
      background: #fafafa;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.ts"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.ts"></script>
  <script>
    window.onload = function() {
      const spec = ${specJson};
      window.ui = SwaggerUIBundle({
        spec: spec,
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>`;
}

function generateMarkdown(spec: OpenAPISpec): string {
  let md = `# ${spec.info.title}\n\n`;
  md += `**Version:** ${spec.info.version}\n\n`;
  
  if (spec.info.description) {
    md += `${spec.info.description}\n\n`;
  }

  md += `---\n\n`;

  // Group endpoints by path
  const paths = Object.entries((spec.paths || {}) as Record<string, unknown>).sort();

  for (const [path, methods] of paths) {
    md += `## ${path}\n\n`;

    for (const [method, operation] of Object.entries((methods || {}) as Record<string, unknown>)) {
      const op = operation as {
        summary?: string;
        description?: string;
        parameters?: Array<{
          name: string;
          in: string;
          required?: boolean;
          schema: Record<string, unknown>;
          description?: string;
        }>;
        requestBody?: {
          content: {
            "application/json": {
              schema: Record<string, unknown>;
            };
          };
        };
        responses: Record<string, {
          description: string;
          content?: {
            "application/json": {
              schema: Record<string, unknown>;
            };
          };
        }>;
      };

      md += `### \`${method.toUpperCase()}\` ${op.summary || path}\n\n`;

      if (op.description) {
        md += `${op.description}\n\n`;
      }

      // Parameters
      if (op.parameters && op.parameters.length > 0) {
        md += `**Parameters:**\n\n`;
        md += `| Name | In | Required | Type | Description |\n`;
        md += `|------|----|----------|------|-------------|\n`;

        for (const param of op.parameters) {
          const schema = param.schema;
          const type = (typeof schema.$ref === "string" && schema.$ref)
            ? schema.$ref.split("/").pop() 
            : (schema.type as string) || "unknown";
          const required = param.required ? "Yes" : "No";
          md += `| ${param.name} | ${param.in} | ${required} | ${type} | ${param.description || ""} |\n`;
        }
        md += `\n`;
      }

      // Request Body
      if (op.requestBody) {
        const schema = op.requestBody.content["application/json"].schema;
        const type = (typeof schema.$ref === "string" && schema.$ref)
          ? schema.$ref.split("/").pop() 
          : (schema.type as string) || "unknown";
        md += `**Request Body:** \`${type}\`\n\n`;
      }

      // Responses
      if (op.responses) {
        md += `**Responses:**\n\n`;
        for (const [statusCode, response] of Object.entries(op.responses)) {
          let responseType = "N/A";
          if (response.content?.["application/json"]?.schema) {
            const schema = response.content["application/json"].schema;
            responseType = (typeof schema.$ref === "string" && schema.$ref)
              ? schema.$ref.split("/").pop() as string
              : (schema.type as string) || "unknown";
          }
          md += `- \`${statusCode}\`: ${response.description}${responseType !== "N/A" ? ` (\`${responseType}\`)` : ""}\n`;
        }
        md += `\n`;
      }

      md += `---\n\n`;
    }
  }

  // Schemas
  if (Object.keys(spec.components.schemas).length > 0) {
    md += `## Schemas\n\n`;

    for (const [schemaName, schema] of Object.entries(spec.components.schemas)) {
      const schemaDef = schema as {
        type?: string;
        properties?: Record<string, {
          type?: string;
          format?: string;
          $ref?: string;
          items?: Record<string, unknown>;
        }>;
        required?: string[];
      };

      md += `### ${schemaName}\n\n`;

      if (schemaDef.properties) {
        md += `| Property | Type | Required | Description |\n`;
        md += `|----------|------|----------|-------------|\n`;

        for (const [propName, propSchema] of Object.entries(schemaDef.properties)) {
          let type = "unknown";
          if (propSchema.$ref) {
            type = propSchema.$ref.split("/").pop() as string;
          } else if (propSchema.type === "array" && propSchema.items) {
            const itemType = (propSchema.items as { $ref?: string; type?: string }).$ref
              ? (propSchema.items as { $ref: string }).$ref.split("/").pop()
              : (propSchema.items as { type?: string }).type || "unknown";
            type = `array<${itemType}>`;
          } else {
            type = propSchema.type || "unknown";
            if (propSchema.format) {
              type += ` (${propSchema.format})`;
            }
          }

          const required = schemaDef.required?.includes(propName) ? "Yes" : "No";
          md += `| ${propName} | ${type} | ${required} | |\n`;
        }
        md += `\n`;
      }
    }
  }

  return md;
}

