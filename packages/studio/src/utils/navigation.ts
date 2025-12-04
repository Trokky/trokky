/**
 * Navigation utilities for handling base path in embedded Studio
 */

/**
 * Get the base path for Studio routes.
 * When Studio is embedded at a path like `/studio`, this returns that path.
 * When running standalone, returns empty string.
 */
export function getBasePath(): string {
  const config = (window as any).TROKKY_CONFIG;
  return config?.basePath || '';
}

/**
 * Get a full path with the Studio base path prepended.
 * @param path - The path to navigate to (e.g., '/forgot-password')
 * @returns The full path with base path (e.g., '/studio/forgot-password')
 */
export function getStudioPath(path: string): string {
  const basePath = getBasePath();
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${basePath}${normalizedPath}`;
}

/**
 * Navigate to a Studio path, handling the base path automatically.
 * @param path - The path to navigate to (e.g., '/forgot-password')
 */
export function navigateTo(path: string): void {
  window.location.href = getStudioPath(path);
}
