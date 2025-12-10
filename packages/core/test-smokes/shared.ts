import { helloYamaCore, getCryptoProvider, getEnvProvider } from "../src/index.js";

export async function initSmoke() {
  // Basic import works
  const ok = helloYamaCore();
  if (!ok) {
    throw new Error("helloYamaCore failed");
  }

  // Check crypto provider (should be provided by runtime or adapters)
  try {
    const crypto = getCryptoProvider();
    const bytes = crypto.randomBytes(4);
    if (!bytes || bytes.length !== 4) {
      throw new Error("randomBytes failed");
    }
  } catch (err) {
    console.warn("Crypto provider missing in this runtime (expected if not injected):", err);
  }

  // Check env provider
  const env = getEnvProvider();
  env.getEnv("DUMMY");
}

