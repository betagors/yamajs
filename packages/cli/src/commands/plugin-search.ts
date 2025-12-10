import { table } from "table";
import { info, error } from "../utils/cli-utils.ts";

interface PluginSearchOptions {
  query: string;
  category?: string;
  limit?: number;
}

interface NpmSearchResult {
  package: {
    name: string;
    version: string;
    description?: string;
    keywords?: string[];
    date: string;
    links: {
      npm: string;
    };
  };
  score: {
    final: number;
  };
}

export async function pluginSearchCommand(
  options: PluginSearchOptions
): Promise<void> {
  try {
    const query = options.query;
    const limit = options.limit || 20;

    // Search npm registry
    const searchUrl = new URL("https://registry.npmjs.org/-/v1/search");
    searchUrl.searchParams.set("text", `yama ${query}`);
    searchUrl.searchParams.set("size", String(limit));

    if (options.category) {
      searchUrl.searchParams.append("text", `category:${options.category}`);
    }

    info(`Searching npm for Yama plugins matching "${query}"...\n`);

    const response = await fetch(searchUrl.toString());
    if (!response.ok) {
      throw new Error(`npm registry request failed: ${response.statusText}`);
    }

    const data = await response.json();
    const results = (data.objects || []) as NpmSearchResult[];

    if (results.length === 0) {
      info("No plugins found");
      return;
    }

    // Filter for Yama plugins (name starts with @betagors/yama- or @yama/)
    const yamaPlugins = results.filter(
      (result) =>
        result.package.name.startsWith("@betagors/yama-") ||
        result.package.name.startsWith("@yama/")
    );

    if (yamaPlugins.length === 0) {
      info("No Yama plugins found");
      return;
    }

    const rows: string[][] = [
      ["Plugin", "Version", "Description", "Score"],
    ];

    for (const result of yamaPlugins) {
      const pkg = result.package;
      const name = pkg.name;
      const version = pkg.version;
      const description = pkg.description || "No description";
      const score = result.score.final.toFixed(2);

      rows.push([
        name,
        version,
        description.substring(0, 60),
        score,
      ]);
    }

    console.log(table(rows));
    console.log(`\nFound ${yamaPlugins.length} plugin(s)`);
    console.log(`\nInstall with: yama plugin install <plugin-name>`);
  } catch (err) {
    error(`Failed to search plugins: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}


