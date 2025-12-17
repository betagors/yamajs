export interface EnvProvider {
    getEnv(name: string): string | undefined;
    setEnv?(name: string, value: string | undefined): void;
    cwd(): string;
}
export declare function setEnvProvider(provider: EnvProvider | null): void;
export declare function getEnvProvider(): EnvProvider;
//# sourceMappingURL=env.d.ts.map