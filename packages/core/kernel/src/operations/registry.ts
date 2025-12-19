
import { OperationDefinition } from './types.js';

/**
 * The Central Registry for all System Operations.
 * This is the catalog that Transporters read from.
 */
export class OperationRegistry {
    private operations = new Map<string, OperationDefinition>();

    /**
     * Register a new operation
     */
    register(op: OperationDefinition): void {
        if (this.operations.has(op.name)) {
            // Warn or throw? For safety, we warn but allow overrides if explicit
            console.warn(`[OperationRegistry] Overwriting operation: ${op.name}`);
        }
        this.validateDefinition(op);
        this.operations.set(op.name, op);
    }

    /**
     * Get an operation by name
     */
    get(name: string): OperationDefinition | undefined {
        return this.operations.get(name);
    }

    /**
     * Get all registered operations
     */
    getAll(): OperationDefinition[] {
        return Array.from(this.operations.values());
    }

    /**
     * Sanity check the definition
     */
    private validateDefinition(op: OperationDefinition) {
        if (!op.name) throw new Error('Operation must have a name');
        if (!op.type) throw new Error(`Operation ${op.name} must have a type (query/mutation/subscription)`);
        if (!op.handler) throw new Error(`Operation ${op.name} must have a handler`);
    }

    /**
     * Clear all operations (useful for tests/hot-reload)
     */
    clear() {
        this.operations.clear();
    }
}

// Singleton instance for the kernel
export const operationRegistry = new OperationRegistry();
