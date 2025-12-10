import type { SanitizationConfig } from "./types.js";

/**
 * Default sanitization configuration
 */
const DEFAULT_SANITIZATION_CONFIG: Required<Omit<SanitizationConfig, "excludePaths">> & {
  excludePaths: string[];
} = {
  enabled: true,
  sanitizeHtml: true,
  sanitizeSql: true,
  sanitizeXss: true,
  maxStringLength: 10000,
  excludePaths: [],
};

/**
 * SQL injection patterns to detect
 */
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
  /(--|#|\/\*|\*\/)/g,
  /(;|\||&|\$|`)/g,
  /(UNION\s+SELECT)/gi,
  /(OR\s+1\s*=\s*1)/gi,
  /(AND\s+1\s*=\s*1)/gi,
];

/**
 * XSS patterns to detect
 */
const XSS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /<iframe[^>]*>.*?<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<img[^>]*src[^>]*=.*?javascript:/gi,
  /<svg[^>]*onload/gi,
];

/**
 * HTML tags to remove
 */
const HTML_TAGS = /<[^>]+>/g;

/**
 * Check if path should be excluded from sanitization
 */
function isPathExcluded(path: string, excludePaths: string[]): boolean {
  return excludePaths.some((excluded) => {
    if (excluded === path) {
      return true;
    }
    if (excluded.endsWith("*")) {
      return path.startsWith(excluded.slice(0, -1));
    }
    return false;
  });
}

/**
 * Sanitize string value
 */
function sanitizeString(
  value: string,
  config: Required<SanitizationConfig>
): string {
  let sanitized = value;

  // Check max length
  if (sanitized.length > config.maxStringLength) {
    sanitized = sanitized.substring(0, config.maxStringLength);
  }

  // Sanitize HTML
  if (config.sanitizeHtml) {
    sanitized = sanitized.replace(HTML_TAGS, "");
  }

  // Sanitize SQL injection patterns
  if (config.sanitizeSql) {
    for (const pattern of SQL_INJECTION_PATTERNS) {
      if (pattern.test(sanitized)) {
        sanitized = sanitized.replace(pattern, "");
      }
    }
  }

  // Sanitize XSS patterns
  if (config.sanitizeXss) {
    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(sanitized)) {
        sanitized = sanitized.replace(pattern, "");
      }
    }
  }

  return sanitized;
}

/**
 * Recursively sanitize object values
 */
function sanitizeObject(
  obj: any,
  config: Required<SanitizationConfig>,
  currentPath: string = ""
): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    return sanitizeString(obj, config);
  }

  if (typeof obj === "number" || typeof obj === "boolean") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) =>
      sanitizeObject(item, config, `${currentPath}[${index}]`)
    );
  }

  if (typeof obj === "object") {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      sanitized[key] = sanitizeObject(value, config, newPath);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Sanitize request data
 */
export function sanitizeRequestData(
  data: any,
  config: SanitizationConfig,
  requestPath?: string
): any {
  const sanitizationConfig = {
    ...DEFAULT_SANITIZATION_CONFIG,
    ...config,
  };

  if (!sanitizationConfig.enabled) {
    return data;
  }

  // Check if path is excluded
  if (requestPath && isPathExcluded(requestPath, sanitizationConfig.excludePaths)) {
    return data;
  }

  return sanitizeObject(data, sanitizationConfig as Required<SanitizationConfig>);
}



















