import type { YamaPlugin, PluginManifest } from "./base.js";

/**
 * Plugin documentation
 */
export interface PluginDocumentation {
  name: string;
  version: string;
  description?: string;
  category?: string;
  api?: string;
  yamaCore?: string;
  dependencies?: {
    plugins?: string[];
    core?: string;
  };
  configuration?: {
    schema?: Record<string, unknown>;
    examples?: Array<{ name: string; config: Record<string, unknown> }>;
  };
  migrations?: Array<{
    version: string;
    type: string;
    description?: string;
  }>;
  apiReference?: {
    methods?: Array<{ name: string; description?: string; returns?: string }>;
    properties?: Array<{ name: string; type?: string; description?: string }>;
  };
  examples?: string[];
  links?: {
    homepage?: string;
    repository?: string;
    documentation?: string;
  };
}

/**
 * Generate plugin documentation from plugin and manifest
 */
export function generatePluginDocs(
  plugin: YamaPlugin,
  manifest: PluginManifest
): PluginDocumentation {
  const docs: PluginDocumentation = {
    name: plugin.name,
    version: plugin.version || "Unknown",
    description: manifest.service || manifest.type || plugin.category,
    category: plugin.category,
    api: manifest.pluginApi,
    yamaCore: manifest.yamaCore || plugin.yamaCore,
  };

  // Dependencies
  if (manifest.dependencies) {
    docs.dependencies = {
      plugins: manifest.dependencies.plugins,
      core: manifest.dependencies.core,
    };
  }

  // Configuration
  if (manifest.configSchema) {
    docs.configuration = {
      schema: manifest.configSchema,
    };
  }

  // Migrations
  if (manifest.migrations) {
    docs.migrations = Object.entries(manifest.migrations).map(
      ([version, migration]) => ({
        version,
        type: migration.type || "schema",
        description: migration.description,
      })
    );
  }

  return docs;
}

/**
 * Generate markdown documentation
 */
export function generateMarkdownDocs(docs: PluginDocumentation): string {
  const lines: string[] = [];

  lines.push(`# ${docs.name}`);
  lines.push("");
  if (docs.description) {
    lines.push(docs.description);
    lines.push("");
  }

  // Metadata
  lines.push("## Metadata");
  lines.push("");
  lines.push(`- **Version**: ${docs.version}`);
  if (docs.category) {
    lines.push(`- **Category**: ${docs.category}`);
  }
  if (docs.api) {
    lines.push(`- **Plugin API**: ${docs.api}`);
  }
  if (docs.yamaCore) {
    lines.push(`- **Yama Core**: ${docs.yamaCore}`);
  }
  lines.push("");

  // Dependencies
  if (docs.dependencies) {
    lines.push("## Dependencies");
    lines.push("");
    if (docs.dependencies.core) {
      lines.push(`- **Yama Core**: ${docs.dependencies.core}`);
    }
    if (docs.dependencies.plugins && docs.dependencies.plugins.length > 0) {
      lines.push("- **Plugins**:");
      for (const dep of docs.dependencies.plugins) {
        lines.push(`  - ${dep}`);
      }
    }
    lines.push("");
  }

  // Configuration
  if (docs.configuration) {
    lines.push("## Configuration");
    lines.push("");
    if (docs.configuration.schema) {
      lines.push("### Schema");
      lines.push("");
      lines.push("```json");
      lines.push(JSON.stringify(docs.configuration.schema, null, 2));
      lines.push("```");
      lines.push("");
    }
    if (docs.configuration.examples) {
      lines.push("### Examples");
      lines.push("");
      for (const example of docs.configuration.examples) {
        lines.push(`#### ${example.name}`);
        lines.push("");
        lines.push("```yaml");
        lines.push(JSON.stringify(example.config, null, 2));
        lines.push("```");
        lines.push("");
      }
    }
  }

  // Migrations
  if (docs.migrations && docs.migrations.length > 0) {
    lines.push("## Migrations");
    lines.push("");
    for (const migration of docs.migrations) {
      lines.push(`### ${migration.version} (${migration.type})`);
      if (migration.description) {
        lines.push("");
        lines.push(migration.description);
      }
      lines.push("");
    }
  }

  // API Reference
  if (docs.apiReference) {
    lines.push("## API Reference");
    lines.push("");
    if (docs.apiReference.methods) {
      lines.push("### Methods");
      lines.push("");
      for (const method of docs.apiReference.methods) {
        lines.push(`#### ${method.name}()`);
        if (method.description) {
          lines.push("");
          lines.push(method.description);
        }
        if (method.returns) {
          lines.push("");
          lines.push(`**Returns**: ${method.returns}`);
        }
        lines.push("");
      }
    }
    if (docs.apiReference.properties) {
      lines.push("### Properties");
      lines.push("");
      for (const prop of docs.apiReference.properties) {
        lines.push(`- **${prop.name}**${prop.type ? ` (${prop.type})` : ""}`);
        if (prop.description) {
          lines.push(`  - ${prop.description}`);
        }
      }
      lines.push("");
    }
  }

  // Examples
  if (docs.examples && docs.examples.length > 0) {
    lines.push("## Examples");
    lines.push("");
    for (const example of docs.examples) {
      lines.push(example);
      lines.push("");
    }
  }

  // Links
  if (docs.links) {
    lines.push("## Links");
    lines.push("");
    if (docs.links.homepage) {
      lines.push(`- [Homepage](${docs.links.homepage})`);
    }
    if (docs.links.repository) {
      lines.push(`- [Repository](${docs.links.repository})`);
    }
    if (docs.links.documentation) {
      lines.push(`- [Documentation](${docs.links.documentation})`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Generate HTML documentation
 */
export function generateHTMLDocs(docs: PluginDocumentation): string {
  const markdown = generateMarkdownDocs(docs);
  // Simple markdown to HTML conversion (basic)
  // For production, use a proper markdown library
  return `<!DOCTYPE html>
<html>
<head>
  <title>${docs.name} - Documentation</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { border-bottom: 2px solid #333; }
    h2 { border-bottom: 1px solid #ccc; margin-top: 2em; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
    pre { background: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto; }
  </style>
</head>
<body>
${markdown
  .replace(/^# (.*)$/gm, "<h1>$1</h1>")
  .replace(/^## (.*)$/gm, "<h2>$1</h2>")
  .replace(/^### (.*)$/gm, "<h3>$1</h3>")
  .replace(/```json\n([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
  .replace(/```yaml\n([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
  .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
  .replace(/\n\n/g, "</p><p>")
  .replace(/^/gm, "<p>")
  .replace(/$/gm, "</p>")}
</body>
</html>`;
}



















