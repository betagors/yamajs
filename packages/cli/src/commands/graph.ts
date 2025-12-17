import { existsSync } from "fs";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir } from "../utils/file-utils.ts";
import {
    getGraphStats,
    pruneGraph,
    formatGraphStats,
    formatPruneResult,
    type GraphPruneOptions,
} from "@yamajs/core";
import { info, error, success, warning } from "../utils/cli-utils.ts";
import { confirm } from "../utils/interactive.ts";

interface GraphStatsOptions {
    config?: string;
}

interface GraphPruneCommandOptions {
    config?: string;
    olderThan?: string;
    keep?: string[];
    keepTags?: string[];
    dryRun?: boolean;
    force?: boolean;
}

/**
 * Show migration graph statistics
 */
export async function graphStatsCommand(options: GraphStatsOptions): Promise<void> {
    const configPath = options.config || findYamaConfig() || "yama.yaml";

    if (!existsSync(configPath)) {
        error(`Config file not found: ${configPath}`);
        process.exit(1);
    }

    try {
        const configDir = getConfigDir(configPath);
        const stats = getGraphStats(configDir);

        console.log("");
        console.log(formatGraphStats(stats));
        console.log("");

        // Provide suggestions
        if (stats.orphanedTransitions > 0) {
            warning(`Found ${stats.orphanedTransitions} orphaned transition(s). Run 'yama graph prune' to clean up.`);
        }

        if (stats.snapshotCount > 100) {
            info(`Consider pruning old snapshots. You have ${stats.snapshotCount} snapshots.`);
            info(`Run 'yama graph prune --older-than 90d --dry-run' to preview.`);
        }
    } catch (err) {
        error(`Failed to get graph stats: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }
}

/**
 * Prune old snapshots and orphaned transitions
 */
export async function graphPruneCommand(options: GraphPruneCommandOptions): Promise<void> {
    const configPath = options.config || findYamaConfig() || "yama.yaml";

    if (!existsSync(configPath)) {
        error(`Config file not found: ${configPath}`);
        process.exit(1);
    }

    try {
        const configDir = getConfigDir(configPath);

        // Require either --older-than or explicit confirmation
        if (!options.olderThan && !options.force) {
            error("Please specify --older-than <duration> or use --force to prune all eligible snapshots.");
            info("Example: yama graph prune --older-than 90d");
            process.exit(1);
        }

        // Build prune options
        const pruneOpts: GraphPruneOptions = {
            olderThan: options.olderThan,
            keepSnapshots: options.keep,
            keepTags: options.keepTags || ["production", "staging"],
            dryRun: options.dryRun ?? true, // Default to dry-run for safety
        };

        // Show what will be affected
        info(`Pruning options:`);
        if (options.olderThan) {
            info(`  • Remove snapshots older than: ${options.olderThan}`);
        }
        if (pruneOpts.keepTags && pruneOpts.keepTags.length > 0) {
            info(`  • Protecting tags: ${pruneOpts.keepTags.join(", ")}`);
        }
        if (options.dryRun) {
            info(`  • Mode: DRY RUN (no changes will be made)`);
        }
        console.log("");

        // Execute prune
        const result = pruneGraph(configDir, pruneOpts);

        console.log(formatPruneResult(result));
        console.log("");

        // If dry run and there are changes, offer to run for real
        if (result.dryRun && (result.removedSnapshots.length > 0 || result.removedTransitions.length > 0)) {
            const confirmed = await confirm(
                "Run pruning for real? (remove --dry-run to avoid this prompt)",
                false
            );

            if (confirmed) {
                const realResult = pruneGraph(configDir, { ...pruneOpts, dryRun: false });
                console.log("");
                console.log(formatPruneResult(realResult));
                success("Pruning complete!");
            } else {
                info("Pruning cancelled. Run again without --dry-run when ready.");
            }
        } else if (!result.dryRun) {
            success("Pruning complete!");
        }
    } catch (err) {
        error(`Failed to prune graph: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }
}
