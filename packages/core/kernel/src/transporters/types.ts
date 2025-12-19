
import { ProviderContext } from '../providers/types.js';
import { OperationDefinition } from '../operations/index.js';
import { EndpointDefinition } from '../typegen.js';

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
