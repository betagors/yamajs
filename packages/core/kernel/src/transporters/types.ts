
import { ProviderContext } from '../../../../../../../../core/kernel/src/providers/types.js';
import { OperationDefinition } from '../../../../../../../../core/kernel/src/operations/index.js';
import { EndpointDefinition } from '@yamajs/kernel';

export interface Transporter<TConfig = unknown> {
    name: string;

    /**
     * Initialize with global config and app context
     */
    init(config: TConfig, context: ProviderContext): Promise<void>;

    /**
     * Register operations that this transporter should expose
     */
    registerOperations(operations: OperationDefinition[]): void;


    /**
     * Start listening
     */
    start(): Promise<void>;

    /**
     * Graceful shutdown
     */
    stop(): Promise<void>;
}
