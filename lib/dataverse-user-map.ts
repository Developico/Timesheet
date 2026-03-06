import { DV } from './dataverse-config';
import { dataverseClient } from './dataverse-client';
import { odataGuid } from './odata-sanitizer';

// Simple in-memory cache (process scoped) to reduce Dataverse lookups
const cache = new Map<string, { id: string; ts: number }>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Resolve Dataverse consultant (system user) id by Azure AD Object ID (oid claim)
 * Returns systemuserid (GUID) or null if not found.
 */
export async function mapAadOidToConsultantId(aadOid: string): Promise<string | null> {
  if (!aadOid) return null;
  // Ensure it's a GUID (azureactivedirectoryobjectid column type = Uniqueidentifier)
  const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
  if (!guidRegex.test(aadOid)) return null; // can't query non-GUID value
  const now = Date.now();
  const hit = cache.get(aadOid);
  if (hit && now - hit.ts < TTL_MS) return hit.id;
  const c = DV.consultant;
  const select = c.id;
  // Sanitize GUID to prevent OData injection
  const safeOid = odataGuid(aadOid);
  const filter = encodeURIComponent(`${c.azureAdObjectId} eq ${safeOid}`);
  try {
    const data = await dataverseClient.list(c.entitySet, `$select=${select}&$filter=${filter}`) as { value?: Array<Record<string, unknown>> }
    const records = Array.isArray(data.value) ? data.value : []
    if (records.length) {
      const first = records[0]
      const id = typeof first[c.id] === 'string' ? String(first[c.id]) : null
      if (id) cache.set(aadOid, { id, ts: now })
      return id
    }
    return null
  } catch (_e: unknown) {
    return null
  }
}
