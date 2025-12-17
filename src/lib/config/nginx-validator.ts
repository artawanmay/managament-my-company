/**
 * Nginx configuration validator for deployment verification
 * Used to validate that nginx.conf contains required settings
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Minimum required max-age for static assets (1 day in seconds)
 */
export const MIN_CACHE_MAX_AGE_SECONDS = 86400;

/**
 * Static asset path pattern that should have cache headers
 */
export const STATIC_ASSET_PATH = "/assets/";

/**
 * Result of parsing a Cache-Control header value
 */
export interface CacheControlParsed {
  maxAge: number | null;
  public: boolean;
  private: boolean;
  noCache: boolean;
  noStore: boolean;
  immutable: boolean;
}

/**
 * Result of validating nginx configuration
 */
export interface NginxValidationResult {
  valid: boolean;
  hasAssetsLocation: boolean;
  hasCacheControl: boolean;
  cacheMaxAge: number | null;
  meetsMinCacheAge: boolean;
  errors: string[];
}

/**
 * Parse a Cache-Control header value into its components
 * @param headerValue - The Cache-Control header value string
 * @returns Parsed cache control directives
 */
export function parseCacheControl(headerValue: string): CacheControlParsed {
  const result: CacheControlParsed = {
    maxAge: null,
    public: false,
    private: false,
    noCache: false,
    noStore: false,
    immutable: false,
  };

  if (!headerValue) {
    return result;
  }

  // Remove quotes if present
  const cleanValue = headerValue.replace(/^["']|["']$/g, "");
  const directives = cleanValue.split(",").map((d) => d.trim().toLowerCase());

  for (const directive of directives) {
    if (directive === "public") {
      result.public = true;
    } else if (directive === "private") {
      result.private = true;
    } else if (directive === "no-cache") {
      result.noCache = true;
    } else if (directive === "no-store") {
      result.noStore = true;
    } else if (directive === "immutable") {
      result.immutable = true;
    } else if (directive.startsWith("max-age=")) {
      const ageStr = directive.substring("max-age=".length);
      const age = parseInt(ageStr, 10);
      if (!isNaN(age)) {
        result.maxAge = age;
      }
    }
  }

  return result;
}

/**
 * Extract Cache-Control header value from nginx config for a specific location
 * @param configContent - The nginx configuration file content
 * @param locationPath - The location path to search for (e.g., "/assets/")
 * @returns The Cache-Control header value or null if not found
 */
export function extractCacheControlForLocation(
  configContent: string,
  locationPath: string
): string | null {
  // Find the location block for the given path
  // This is a simplified parser - looks for location block and extracts add_header Cache-Control
  const locationRegex = new RegExp(
    `location\\s+${escapeRegex(locationPath)}\\s*\\{([^}]+)\\}`,
    "gs"
  );

  const matches = configContent.match(locationRegex);
  if (!matches || matches.length === 0) {
    return null;
  }

  // Look for add_header Cache-Control in the location block
  for (const match of matches) {
    const headerRegex = /add_header\s+Cache-Control\s+["']([^"']+)["']/i;
    const headerMatch = match.match(headerRegex);
    if (headerMatch && headerMatch[1]) {
      return headerMatch[1];
    }
  }

  return null;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Validate that nginx configuration has proper cache headers for static assets
 * @param configContent - The nginx configuration file content
 * @returns Validation result with details
 */
export function validateNginxCacheHeaders(
  configContent: string
): NginxValidationResult {
  const errors: string[] = [];

  // Check if /assets/ location exists
  const hasAssetsLocation = configContent.includes(`location ${STATIC_ASSET_PATH}`);
  if (!hasAssetsLocation) {
    errors.push(`Missing location block for ${STATIC_ASSET_PATH}`);
  }

  // Extract Cache-Control header for assets
  const cacheControlValue = extractCacheControlForLocation(
    configContent,
    STATIC_ASSET_PATH
  );
  const hasCacheControl = cacheControlValue !== null;

  if (!hasCacheControl) {
    errors.push(`Missing Cache-Control header for ${STATIC_ASSET_PATH}`);
  }

  // Parse and validate cache control
  let cacheMaxAge: number | null = null;
  let meetsMinCacheAge = false;

  if (cacheControlValue) {
    const parsed = parseCacheControl(cacheControlValue);
    cacheMaxAge = parsed.maxAge;

    if (cacheMaxAge === null) {
      errors.push("Cache-Control header missing max-age directive");
    } else if (cacheMaxAge < MIN_CACHE_MAX_AGE_SECONDS) {
      errors.push(
        `Cache-Control max-age (${cacheMaxAge}s) is less than required minimum (${MIN_CACHE_MAX_AGE_SECONDS}s / 1 day)`
      );
    } else {
      meetsMinCacheAge = true;
    }
  }

  return {
    valid: errors.length === 0,
    hasAssetsLocation,
    hasCacheControl,
    cacheMaxAge,
    meetsMinCacheAge,
    errors,
  };
}

/**
 * Read and validate the nginx configuration file
 * @param configPath - Path to the nginx.conf file (defaults to docker/nginx/nginx.conf)
 * @returns Validation result
 */
export function validateNginxConfigFile(
  configPath: string = "docker/nginx/nginx.conf"
): NginxValidationResult {
  const fullPath = join(process.cwd(), configPath);

  if (!existsSync(fullPath)) {
    return {
      valid: false,
      hasAssetsLocation: false,
      hasCacheControl: false,
      cacheMaxAge: null,
      meetsMinCacheAge: false,
      errors: [`Nginx configuration file not found at ${configPath}`],
    };
  }

  const content = readFileSync(fullPath, "utf-8");
  return validateNginxCacheHeaders(content);
}

/**
 * Check if a max-age value meets the minimum requirement (1 day)
 * @param maxAgeSeconds - The max-age value in seconds
 * @returns true if meets minimum, false otherwise
 */
export function meetsMinimumCacheAge(maxAgeSeconds: number): boolean {
  return maxAgeSeconds >= MIN_CACHE_MAX_AGE_SECONDS;
}
