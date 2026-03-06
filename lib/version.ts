/**
 * Application version information
 */

export const APP_VERSION = "1.3.0";
export const BUILD_DATE = "2026-03-06";
export const APP_NAME = "Developico Timesheet";

/**
 * Get formatted version string
 */
export function getVersionString(): string {
  return `v${APP_VERSION}`;
}

/**
 * Get formatted build info
 */
export function getBuildInfo(): string {
  return `${APP_NAME} ${getVersionString()} (${BUILD_DATE})`;
}