const fallbackEnv = {
    getEnv: () => undefined,
    setEnv: () => { },
    cwd: () => "/",
};
let envProvider = detectDefaultEnv();
function detectDefaultEnv() {
    if (typeof process !== "undefined" && process.env) {
        return {
            getEnv: (name) => process.env[name],
            setEnv: (name, value) => {
                if (typeof value === "undefined") {
                    delete process.env[name];
                }
                else {
                    process.env[name] = value;
                }
            },
            cwd: () => (typeof process.cwd === "function" ? process.cwd() : "/"),
        };
    }
    return null;
}
export function setEnvProvider(provider) {
    envProvider = provider;
}
export function getEnvProvider() {
    return envProvider ?? fallbackEnv;
}
//# sourceMappingURL=env.js.map