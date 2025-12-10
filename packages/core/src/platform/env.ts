export interface EnvProvider {
  getEnv(name: string): string | undefined;
  setEnv?(name: string, value: string | undefined): void;
  cwd(): string;
}

const fallbackEnv: EnvProvider = {
  getEnv: () => undefined,
  setEnv: () => {},
  cwd: () => "/",
};

let envProvider: EnvProvider | null = detectDefaultEnv();

function detectDefaultEnv(): EnvProvider | null {
  if (typeof process !== "undefined" && process.env) {
    return {
      getEnv: (name: string) => process.env[name],
      setEnv: (name: string, value?: string) => {
        if (typeof value === "undefined") {
          delete process.env[name];
        } else {
          process.env[name] = value;
        }
      },
      cwd: () => (typeof process.cwd === "function" ? process.cwd() : "/"),
    };
  }
  return null;
}

export function setEnvProvider(provider: EnvProvider | null): void {
  envProvider = provider;
}

export function getEnvProvider(): EnvProvider {
  return envProvider ?? fallbackEnv;
}

