import type { Transport } from "../logger.js";
import type { LogEvent } from "../event.js";
import { formatLogEntry, type LogFormat } from "../formatters.js";

export interface FSTransportConfig {
    path: string;
    format?: LogFormat;
}

/**
 * Basic File System Transport.
 * 
 * Note: In a runtime-agnostic kernel, this would typically 
 * be provided by the runtime. For core logging, we provide 
 * a simple version or an interface for it.
 */
export class FSTransport implements Transport {
    private path: string;
    private format: LogFormat;

    constructor(config: FSTransportConfig) {
        this.path = config.path;
        this.format = config.format || "json";
    }

    async write(event: LogEvent): Promise<void> {
        const formatted = formatLogEntry(event, this.format);
        // Implementation would use runtime-specific FS 
        // For now, we'll try to use global 'runtime' if available 
        // or fallback to a simple console.error if we can't write.

        // In actual use, this transport might be replaced or enhanced 
        // by the runtime-node package.

        // For core, we just define the structure.
        try {
            // @ts-ignore - dynamic check for global runtime
            if (typeof getRuntime !== 'undefined') {
                // @ts-ignore
                const runtime = getRuntime();
                if (runtime.fs) {
                    await runtime.fs.appendFile(this.path, formatted + "\n");
                }
            }
        } catch (err: any) {
            console.error(`[Logging] FS Transport failure: ${err.message}`);
        }
    }
}

export function createFSTransport(config: FSTransportConfig): FSTransport {
    return new FSTransport(config);
}
