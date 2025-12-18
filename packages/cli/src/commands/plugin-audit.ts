import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir } from "../utils/file-utils.ts";
import {
    validateTableAccess,
    inferPolicyFromPluginName,
    formatSandboxViolations,
    analyzePluginTableAccess,
    extractTablesFromSQL,
    loadPluginFromPackage,
    type PluginTablePolicy,
} from "@yamajs/kernel";
import { info, error, success, warning } from "../utils/cli-utils.ts";
import { table } from "table";

interface PluginAuditOptions {
    config?: string;
    plugin?: string;
    violations?: boolean;
    verbose?: boolean;
}

/**
 * Audit plugin table access
 */
export async function pluginAuditCommand(options: PluginAuditOptions): Promise<void> {
    const configPath = options.config || findYamaConfig() || "yama.yaml";

    if (!existsSync(configPath)) {
        error(`Config file not found: ${configPath}`);
        process.exit(1);
    }

    try {
        const configDir = getConfigDir(configPath);

        // Load yama config to find plugins
        const yamaConfigContent = readFileSync(configPath, "utf-8");
        const yamaConfig = JSON.parse(yamaConfigContent);

        const pluginNames = yamaConfig.plugins || [];

        if (pluginNames.length === 0) {
            info("No plugins configured in yama.yaml");
            return;
        }

        // Filter to specific plugin if requested
        const pluginsToAudit = options.plugin
            ? pluginNames.filter((p: string) => p === options.plugin || p.includes(options.plugin))
            : pluginNames;

        if (pluginsToAudit.length === 0) {
            error(`Plugin not found: ${options.plugin}`);
            process.exit(1);
        }

        console.log("");
        info(`Auditing ${pluginsToAudit.length} plugin(s) for table access...`);
        console.log("");

        let hasViolations = false;

        for (const pluginName of pluginsToAudit) {
            console.log(`\n📦 ${pluginName}`);
            console.log("─".repeat(50));

            try {
                // Load plugin to get manifest
                const plugin = await loadPluginFromPackage(pluginName, {
                    autoInstall: false,
                });

                if (!plugin) {
                    warning(`  Could not load plugin: ${pluginName}`);
                    continue;
                }

                const manifest = plugin.manifest || {};

                // Get policy from manifest or infer from name
                const inferredPolicy = inferPolicyFromPluginName(pluginName);
                const policy: PluginTablePolicy = manifest.tablePolicy
                    ? { ...inferredPolicy, ...manifest.tablePolicy }
                    : inferredPolicy;

                info(`  Policy mode: ${policy.mode}`);
                info(`  Allowed prefixes: ${policy.allowedPrefixes.join(", ") || "(none)"}`);
                info(`  Allowed tables: ${policy.allowedTables?.join(", ") || "(none)"}`);
                console.log("");

                // Get migrations from manifest
                if (!manifest.migrations || Object.keys(manifest.migrations).length === 0) {
                    info("  No migrations defined.");
                    continue;
                }

                // Analyze each migration
                const migrations: Array<{ version: string; sql: string }> = [];

                for (const [version, migration] of Object.entries(manifest.migrations)) {
                    const migrationDef = migration as any;
                    if (typeof migrationDef.up === "string") {
                        // Try to load SQL file
                        try {
                            const pluginDir = dirname(require.resolve(pluginName));
                            const sqlPath = join(pluginDir, migrationDef.up);
                            if (existsSync(sqlPath)) {
                                const sql = readFileSync(sqlPath, "utf-8");
                                migrations.push({ version, sql });
                            }
                        } catch {
                            // Ignore if can't load
                        }
                    }
                }

                if (migrations.length === 0) {
                    info("  No SQL migrations to analyze.");
                    continue;
                }

                // Analyze migrations
                const analysis = analyzePluginTableAccess(migrations, policy);

                // Show results
                info(`  ${analysis.summary}`);

                if (analysis.allTablesAccessed.length > 0) {
                    info(`  Tables accessed: ${analysis.allTablesAccessed.join(", ")}`);
                }

                // Show violations
                for (const [version, result] of analysis.byVersion) {
                    if (!result.valid || (options.verbose && result.violations.length > 0)) {
                        console.log(`\n  Version ${version}:`);
                        console.log(
                            formatSandboxViolations(result)
                                .split("\n")
                                .map((line) => `    ${line}`)
                                .join("\n")
                        );
                    }
                }

                if (!analysis.valid) {
                    hasViolations = true;
                }
            } catch (err) {
                warning(`  Error analyzing plugin: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        console.log("");
        console.log("─".repeat(50));

        if (hasViolations) {
            warning("Some plugins have table access violations.");
            info("Review the violations above and update plugin manifests if needed.");
            process.exit(1);
        } else {
            success("All plugins comply with table access policies.");
        }
    } catch (err) {
        error(`Failed to audit plugins: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }
}

/**
 * Analyze SQL for table access
 */
export async function sqlAnalyzeCommand(sql: string, options: { plugin?: string }): Promise<void> {
    const tables = extractTablesFromSQL(sql);

    console.log("");
    info(`Tables accessed: ${tables.length}`);

    if (tables.length > 0) {
        console.log("");
        for (const table of tables) {
            console.log(`  • ${table}`);
        }
    }

    if (options.plugin) {
        console.log("");
        const policy = inferPolicyFromPluginName(options.plugin);
        const result = validateTableAccess(sql, policy);

        console.log(formatSandboxViolations(result));
    }
}
