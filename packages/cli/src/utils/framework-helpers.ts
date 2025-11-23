import { existsSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { ensureDir } from "./file-utils.ts";
import type { ProjectType } from "./project-detection.ts";

export interface FrameworkConfig {
  outputPath: string;
  hooksPath?: string;
  examplePath?: string;
}

/**
 * Get framework-specific configuration
 */
export function getFrameworkConfig(
  projectType: ProjectType,
  framework?: string
): FrameworkConfig {
  const effectiveFramework = framework || projectType;

  switch (effectiveFramework) {
    case "nextjs":
      return {
        outputPath: "lib/generated",
        hooksPath: "lib/hooks/useApi.ts",
        examplePath: "app/api/example.ts"
      };

    case "react":
    case "vite":
      return {
        outputPath: "src/lib/generated",
        hooksPath: "src/hooks/useApi.ts",
        examplePath: "src/components/ApiExample.tsx"
      };

    case "node":
    default:
      return {
        outputPath: "lib/generated"
      };
  }
}

/**
 * Generate framework-specific helper files
 */
export async function generateFrameworkHelpers(
  projectType: ProjectType,
  framework: string | undefined,
  configDir: string
): Promise<void> {
  const effectiveFramework = framework || projectType;

  switch (effectiveFramework) {
    case "nextjs":
      await generateNextJsHelpers(configDir);
      break;

    case "react":
    case "vite":
      await generateReactHelpers(configDir);
      break;

    default:
      // No special helpers for Node.js
      break;
  }
}

async function generateNextJsHelpers(configDir: string): Promise<void> {
  const hooksDir = join(configDir, "lib", "hooks");
  ensureDir(hooksDir);

  const hooksContent = `// React hooks for Yama API
// This file is auto-generated
// Do not edit manually

import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../generated/sdk.ts";

// Example hook for GET requests
export function useGetExamples() {
  return useQuery({
    queryKey: ["examples"],
    queryFn: () => api.getExamples()
  });
}

// Example hook for POST requests
export function useCreateExample() {
  return useMutation({
    mutationFn: (data: unknown) => api.createExample(data)
  });
}
`;

  const hooksPath = join(hooksDir, "useApi.ts");
  if (!existsSync(hooksPath)) {
    writeFileSync(hooksPath, hooksContent, "utf-8");
    console.log("✅ Generated Next.js hooks: lib/hooks/useApi.ts");
  }
}

async function generateReactHelpers(configDir: string): Promise<void> {
  const hooksDir = join(configDir, "src", "hooks");
  ensureDir(hooksDir);

  const hooksContent = `// React hooks for Yama API
// This file is auto-generated
// Do not edit manually

import { useState, useEffect } from "react";
import { api } from "../lib/generated/sdk.ts";

// Example hook for GET requests
export function useGetExamples() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getExamples()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}

// Example hook for POST requests
export function useCreateExample() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mutate = async (data: unknown) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.createExample(data);
      setLoading(false);
      return result;
    } catch (err) {
      setError(err);
      setLoading(false);
      throw err;
    }
  };

  return { mutate, loading, error };
}
`;

  const hooksPath = join(hooksDir, "useApi.ts");
  if (!existsSync(hooksPath)) {
    writeFileSync(hooksPath, hooksContent, "utf-8");
    console.log("✅ Generated React hooks: src/hooks/useApi.ts");
  }
}

/**
 * Update framework-specific configuration files
 */
export async function updateFrameworkConfig(
  projectType: ProjectType,
  framework: string | undefined,
  configDir: string
): Promise<void> {
  const effectiveFramework = framework || projectType;

  switch (effectiveFramework) {
    case "nextjs":
      await updateNextJsConfig(configDir);
      break;

    default:
      // No config updates needed
      break;
  }
}

async function updateNextJsConfig(configDir: string): Promise<void> {
  const nextConfigPath = join(configDir, "next.config.ts");
  const nextConfigTsPath = join(configDir, "next.config.ts");

  // Check if Next.js config exists
  if (!existsSync(nextConfigPath) && !existsSync(nextConfigTsPath)) {
    console.log("ℹ️  No next.config.js found - skipping config update");
    return;
  }

  // For now, just log that config updates would go here
  // In a full implementation, we'd parse and update the config
  console.log("ℹ️  Next.js config updates would go here");
}

