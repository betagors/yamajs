import type { ApisConfig, NormalizedApisConfig } from './types.js';
import type { YamaEntities } from '../entities.js';
import type { YamaOperations } from '../operations/types.js';
import type { YamaPolicies } from '../policies/types.js';
export declare function normalizeApisConfig(config: {
    apis?: ApisConfig;
    operations?: YamaOperations;
    policies?: YamaPolicies;
    schemas?: YamaEntities;
}): NormalizedApisConfig;
//# sourceMappingURL=normalizer.d.ts.map