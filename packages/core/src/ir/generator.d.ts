import type { YamaConfig } from "../types.js";
import type { YamaIR } from "./types.js";
/**
 * Build a minimal, versioned IR from a YamaConfig.
 * The IR intentionally excludes secrets and focuses on public shapes.
 */
export declare function generateIR(config: YamaConfig): YamaIR;
//# sourceMappingURL=generator.d.ts.map