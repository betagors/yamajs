/**
 * Enhanced Plugin System - Example Usage
 * 
 * This file demonstrates the new plugin features:
 * - requires/optional/conflicts declarations
 * - onReady/onShutdown lifecycle hooks
 * - Enhanced health checks
 * - Graceful shutdown
 */

import type { YamaPlugin, PluginContext } from "@yamajs/core";

// ============================================================================
// EXAMPLE 1: Plugin with Dependencies
// ============================================================================

/**
 * Stripe plugin that requires Clerk for authentication
 */
const stripePlugin: YamaPlugin = {
    name: "@yamajs/plugin-stripe",
    version: "1.0.0",
    category: "payments",
    description: "Stripe payment processing",
    author: "Yama Team",

    // NEW: Declare dependencies
    requires: ["@yamajs/plugin-clerk"],  // Must be loaded first
    optional: ["@yamajs/plugin-analytics"],  // Use if available
    conflicts: ["@yamajs/plugin-paddle"],  // Can't use with Paddle

    async init(opts, ctx) {
        ctx.logger.info("Stripe initializing...");

        // At this point, other plugins may not be fully ready
        // Just do basic setup here

        return {
            createPaymentIntent: async (amount: number) => {
                // Implementation
                return { id: "pi_123", amount };
            },
        };
    },

    // NEW: Called after ALL plugins are initialized
    async onReady(ctx) {
        ctx.logger.info("Stripe ready - all plugins initialized");

        // NOW it's safe to interact with other plugins
        const clerk = ctx.getPluginAPI("@yamajs/plugin-clerk");
        if (clerk) {
            ctx.logger.info("Clerk integration enabled");
        }

        // Check optional plugin
        const analytics = ctx.getPluginAPI("@yamajs/plugin-analytics");
        if (analytics) {
            analytics.track("stripe.ready");
        }
    },

    // NEW: Called during graceful shutdown
    async onShutdown(ctx) {
        ctx.logger.info("Stripe shutting down...");
        // Close connections, flush pending operations, etc.
        await new Promise(resolve => setTimeout(resolve, 100));
        ctx.logger.info("Stripe shutdown complete");
    },

    // ENHANCED: Health check with latency
    async onHealthCheck() {
        const start = Date.now();

        // Check Stripe API connectivity
        const healthy = true; // Would actually ping Stripe

        return {
            healthy,
            latency: Date.now() - start,
            details: {
                apiVersion: "2023-10-16",
                mode: "test",
            },
        };
    },
};

// ============================================================================
// EXAMPLE 2: Lifecycle in Action
// ============================================================================

import {
    PluginLifecycleManager,
    registerGracefulShutdown,
    aggregateHealthCheck
} from "@yamajs/core";

async function runApp() {
    // Create lifecycle manager
    const lifecycle = new PluginLifecycleManager({
        coreVersion: "0.1.0",
        failFast: false,
        timeout: 30000,
        logger: console,
    });

    // Register plugins
    lifecycle.register(stripePlugin);

    // Initialize all (in dependency order)
    const context = {} as PluginContext; // Simplified for example
    await lifecycle.initializeAll({}, context);

    // Start all
    await lifecycle.startAll();

    // NEW: Call onReady on all plugins
    const readyResult = await lifecycle.readyAll(context);
    if (!readyResult.success) {
        console.error("Some plugins failed onReady:", readyResult.errors);
    }

    // NEW: Register graceful shutdown
    registerGracefulShutdown(lifecycle, {
        timeout: 30000,
        logger: console,
    });

    // Health endpoint handler
    async function handleHealthRequest(): Promise<Response> {
        const healthMap = await lifecycle.healthCheck();
        const result = aggregateHealthCheck(healthMap);

        return new Response(JSON.stringify(result, null, 2), {
            status: result.healthy ? 200 : 503,
            headers: { "Content-Type": "application/json" },
        });
    }

    console.log("App running. Press Ctrl+C to shutdown gracefully.");
}

// ============================================================================
// EXAMPLE 3: Dependency Validation
// ============================================================================

import {
    validatePluginRelationships,
    detectPluginConflicts,
    canLoadPlugin
} from "@yamajs/core";

function validateBeforeLoad() {
    const loadedPlugins = new Set([
        "@yamajs/plugin-clerk",
        "@yamajs/plugin-analytics",
    ]);

    // Validate stripe plugin
    const validation = validatePluginRelationships(stripePlugin, loadedPlugins);

    if (!validation.valid) {
        console.error("Cannot load Stripe:", validation.errors);
        return;
    }

    if (validation.warnings.length > 0) {
        console.warn("Warnings:", validation.warnings);
    }

    console.log("✅ Stripe can be loaded");
}

// ============================================================================
// EXAMPLE 4: Conflict Detection
// ============================================================================

function checkConflicts() {
    const plugins = new Map<string, YamaPlugin>([
        ["@yamajs/plugin-stripe", stripePlugin],
        // If we tried to add Paddle here, it would conflict
    ]);

    const conflicts = detectPluginConflicts(plugins);

    if (conflicts.length > 0) {
        console.error("Plugin conflicts detected:", conflicts);
        process.exit(1);
    }

    console.log("✅ No conflicts");
}

// ============================================================================
// SUMMARY: New Plugin Fields
// ============================================================================

/**
 * The enhanced YamaPlugin interface now includes:
 * 
 * DEPENDENCY MANAGEMENT:
 * - requires: string[]     - Plugins that MUST be loaded first
 * - optional: string[]     - Plugins to use if available
 * - conflicts: string[]    - Plugins that cannot coexist
 * 
 * LIFECYCLE HOOKS:
 * - onReady(ctx)           - Called after ALL plugins initialized
 * - onShutdown(ctx)        - Called during graceful shutdown
 * 
 * HEALTH CHECK:
 * - onHealthCheck()        - Now includes latency tracking
 * 
 * METADATA:
 * - description: string    - What the plugin does
 * - author: string         - Plugin author
 * - repository: string     - Git repository URL
 */

export { stripePlugin };
