import type { AdminXPluginConfig, AdminXResolvedConfig } from "./types.js";

function normalizePath(path?: string): string {
  if (!path || path.trim() === "") {
    return "/adminx";
  }
  let normalized = path.trim();
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function resolveAdminXConfig(
  opts: AdminXPluginConfig | undefined,
  nodeEnv: string
): AdminXResolvedConfig {
  const devPassword =
    opts?.devPassword ||
    process.env.ADMINX_PASSWORD ||
    process.env.YAMA_ADMINX_PASSWORD;

  const allowInProduction = opts?.allowInProduction === true;
  const enabledByEnv = nodeEnv !== "production" || allowInProduction;
  const enabled =
    opts?.enabled === false ? false : opts?.enabled === true ? true : enabledByEnv;

  return {
    enabled,
    path: normalizePath(opts?.path),
    requireAuth: opts?.requireAuth !== false,
    allowInProduction,
    devPassword,
    nodeEnv,
  };
}

