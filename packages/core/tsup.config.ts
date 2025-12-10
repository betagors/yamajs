import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm"],
  platform: "neutral",
  target: "es2022",
  dts: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
  clean: true,
  external: [
    /^@betagors\//,
    "ajv",
    "ajv-formats",
    "js-yaml",
    "jsonwebtoken",
    "semver",
    "bcryptjs",
  ],
  banner: {
    js: "#!/usr/bin/env node",
  },
});

