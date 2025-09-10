import { DV } from './dataverse-config';
import { dataverseClient } from './dataverse-client';

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
  // For GUID equality do not wrap in quotes
  const filter = encodeURIComponent(`${c.azureAdObjectId} eq ${aadOid}`);
  try {
    const data = await dataverseClient.list(c.entitySet, `$select=${select}&$filter=${filter}`);
    const records: any[] = data.value || [];
    if (records.length) {
      const id = records[0][c.id];
      if (id) cache.set(aadOid, { id, ts: now });
      return id || null;
    }
    return null;
  } catch (e) {
    // swallow to avoid breaking API routes; return null triggers mock/empty fallbacks
    return null;
  }
}
