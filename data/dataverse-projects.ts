import type { Project } from '@/types'
import { DV } from '@/lib/dataverse-config'
import { dataverseClient } from '@/lib/dataverse-client'
import { ensureEnabled, assignColor } from './dataverse-common'
import { getProjectAssignments } from './dataverse-time-entries'

export async function getProjects(currentConsultantId?: string): Promise<Project[]> {
  ensureEnabled()
  const s = DV.project
  const fields = [s.id, s.name, s.code, s.client, s.billable]
  if (s.allUsers) fields.push(s.allUsers)
  if (s.meta && s.meta === 'tt_metaprojectname' && process.env.DATAVERSE_FIELD_PROJECT_META) fields.push(s.meta)
  else if (s.meta && s.meta !== 'tt_metaprojectname') fields.push(s.meta)
  fields.push(s.note, s.createdOn)
  const select = fields.filter(Boolean).join(',')
  const filter = `${s.stateCode} eq 0`
  let records: any[] = []
  try {
    const data = await dataverseClient.list(s.entitySet, `$select=${select}&$filter=${encodeURIComponent(filter)}`) as { value?: any[] }
    records = Array.isArray(data.value) ? data.value : []
  } catch (e: any) {
    const msg = e.message || ''
    if (s.allUsers && msg.includes(s.allUsers)) {
      const fallbackSelect = fields.filter(f => f !== s.allUsers).join(',')
      const data2 = await dataverseClient.list(s.entitySet, `$select=${fallbackSelect}&$filter=${encodeURIComponent(filter)}`) as { value?: any[] }
      records = Array.isArray(data2.value) ? data2.value : []
    } else throw e
  }
  let assignmentSet: Set<string> | null = null
  if (currentConsultantId) {
    try {
      const assigned = await getProjectAssignments(currentConsultantId)
      assignmentSet = new Set(assigned)
    } catch {/* ignore */}
  }
  return records.map(r => {
    const rawAll = s.allUsers ? r[s.allUsers] : undefined
    const allUsers = rawAll === 1 || rawAll === true || rawAll === '1'
    const assigned = allUsers ? true : (assignmentSet ? assignmentSet.has(r[s.id]) : true)
    return {
      id: r[s.id],
      code: r[s.code],
      client: r[s.client] || '',
      name: r[s.name] || '(No Name)',
      meta: r[s.meta] || undefined,
      note: r[s.note] || undefined,
      billable: !!r[s.billable],
      assigned,
      allUsers,
      color: assignColor(r[s.id]),
    }
  })
}
