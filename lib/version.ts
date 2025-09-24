/**
 * Application version information
 */

export const APP_VERSION = "1.2.4";
export const BUILD_DATE = "2024-09-24";
export const APP_NAME = "DVLP Time Tracker";

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