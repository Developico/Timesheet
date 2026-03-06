/**
 * OData value sanitizers to prevent filter injection.
 * Every user-supplied value interpolated into an OData $filter MUST go through one of these helpers.
 */

const GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/** Validate and return a raw GUID suitable for OData equality (no quotes needed). */
export function odataGuid(value: string): string {
  if (!GUID_RE.test(value)) {
    throw new Error(`Invalid GUID for OData filter: ${value.slice(0, 50)}`)
  }
  return value
}

/** Escape a string for use inside OData single quotes: double any embedded single quotes. */
export function odataString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

/** Validate an ISO date string (YYYY-MM-DD). Returns the value unchanged. */
export function odataDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date for OData filter: ${value.slice(0, 20)}`)
  }
  return value
}
