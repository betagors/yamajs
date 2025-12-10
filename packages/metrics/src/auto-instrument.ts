import type { PluginMetrics } from "@betagors/yama-core";

/**
 * Auto-instrument a plugin API to track method calls
 */
export function autoInstrumentPluginAPI(
  pluginName: string,
  api: any,
  onCall?: (pluginName: string, method: string, duration: number) => void,
  onError?: (pluginName: string, method: string, error: Error) => void
): any {
  if (!api || typeof api !== "object") {
    return api;
  }

  return new Proxy(api, {
    get: (target, prop) => {
      const value = target[prop];

      // Don't instrument non-functions or special properties
      if (typeof value !== "function" || prop === "constructor") {
        return value;
      }

      // Return instrumented function
      return function (...args: any[]) {
        const methodName = String(prop);
        const startTime = Date.now();

        try {
          const result = value.apply(target, args);

          // Handle async operations
          if (result instanceof Promise) {
            return result
              .then((res) => {
                const duration = Date.now() - startTime;
                onCall?.(pluginName, methodName, duration);
                return res;
              })
              .catch((err) => {
                const duration = Date.now() - startTime;
                onError?.(pluginName, methodName, err);
                throw err;
              });
          }

          // Handle sync operations
          const duration = Date.now() - startTime;
          onCall?.(pluginName, methodName, duration);
          return result;
        } catch (err) {
          const duration = Date.now() - startTime;
          onError?.(pluginName, methodName, err as Error);
          throw err;
        }
      };
    },
  });
}

/**
 * Create auto-instrumentation wrapper with metrics tracking
 */
export function createAutoInstrumenter(
  recordAPICall: (pluginName: string) => void,
  recordError: (pluginName: string, error: Error) => void,
  recordDuration?: (pluginName: string, method: string, duration: number) => void
) {
  return (pluginName: string, api: any): any => {
    return autoInstrumentPluginAPI(
      pluginName,
      api,
      (name, method, duration) => {
        recordAPICall(name);
        recordDuration?.(name, method, duration);
      },
      (name, method, error) => {
        recordError(name, error);
      }
    );
  };
}



















