import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "neutral",
  target: "es2022",
  dts: false, // Use tsc for declarations due to project reference issues
  sourcemap: true,
  treeshake: true,
  splitting: false,
  clean: true,
  external: [
    /^@yamajs\//,
    /^@noble\//,
    "ajv",
    "ajv-formats",
    "js-yaml",
    "jsonwebtoken",
    "semver",
    "bcryptjs",
    // Node.js built-ins that are also available in Deno/Bun
    "url",
    "module",
  ],
});

