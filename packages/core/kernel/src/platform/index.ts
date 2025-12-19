
import { RuntimeAdapter } from '../../../../../../../../core/kernel/src/platform/runtime.js';

let activeRuntime: RuntimeAdapter | null = null;

export function setRuntime(runtime: RuntimeAdapter) {
    activeRuntime = runtime;
}

export function getRuntime(): RuntimeAdapter {
    if (!activeRuntime) {
        throw new Error(
            'Yama Runtime not initialized. ' +
            'You must call setRuntime() with a valid adapter (e.g. NodeRuntime) before using Core features.'
        );
    }
    return activeRuntime;
}

export * from '../../../../../../../../core/kernel/src/platform/runtime.js';
