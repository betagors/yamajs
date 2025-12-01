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
        examples?: Array<{
            name: string;
            config: Record<string, unknown>;
        }>;
    };
    migrations?: Array<{
        version: string;
        type: string;
        description?: string;
    }>;
    apiReference?: {
        methods?: Array<{
            name: string;
            description?: string;
            returns?: string;
        }>;
        properties?: Array<{
            name: string;
            type?: string;
            description?: string;
        }>;
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
export declare function generatePluginDocs(plugin: YamaPlugin, manifest: PluginManifest): PluginDocumentation;
/**
 * Generate markdown documentation
 */
export declare function generateMarkdownDocs(docs: PluginDocumentation): string;
/**
 * Generate HTML documentation
 */
export declare function generateHTMLDocs(docs: PluginDocumentation): string;
