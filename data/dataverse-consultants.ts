import type { Consultant } from '@/types'
import { DV } from '@/lib/dataverse-config'
import { dataverseClient } from '@/lib/dataverse-client'
import { ensureEnabled } from './dataverse-common'

export async function getConsultants(): Promise<Consultant[]> {
  ensureEnabled()
  const baseEntitySet = DV.consultant.entitySet
  const candidateEntitySets = [baseEntitySet]
  if (!/s$/i.test(baseEntitySet)) candidateEntitySets.push(baseEntitySet + 's')
  if (baseEntitySet.toLowerCase() !== 'systemusers') candidateEntitySets.push('systemusers')

  let lastError: any = null
  for (const entitySet of candidateEntitySets) {
    let wantState = !!DV.consultant.stateCode
    let wantAvatar = !!DV.consultant.avatar
    let wantDisabled = !!DV.consultant.disabledFlag
    let wantAccessMode = !!DV.consultant.accessMode
    for (let attempt = 0; attempt < 3; attempt++) {
      const fields = [DV.consultant.id, DV.consultant.fullName, DV.consultant.email, DV.consultant.azureAdObjectId]
      if (wantDisabled) fields.push(DV.consultant.disabledFlag as string)
      if (wantAccessMode) fields.push(DV.consultant.accessMode as string)
      if (wantState && DV.consultant.stateCode) fields.push(DV.consultant.stateCode as string)
      if (wantAvatar) fields.push(DV.consultant.avatar as string)
      const select = fields.filter(Boolean).join(',')
      try {
        const data = await dataverseClient.list(entitySet, `$select=${select}&$orderby=${DV.consultant.fullName} asc`) as { value?: any[] }
        const records: any[] = Array.isArray(data.value) ? data.value : []
        return records.map(r => {
          const disabledVal = wantDisabled ? r[DV.consultant.disabledFlag as string] : undefined
          const accessModeVal = wantAccessMode ? r[DV.consultant.accessMode as string] : undefined
          const stateVal = wantState && DV.consultant.stateCode ? r[DV.consultant.stateCode as string] : undefined
          let isActive = true
          if (disabledVal !== undefined) {
            isActive = !(disabledVal === true || disabledVal === 1 || disabledVal === '1')
          } else if (accessModeVal !== undefined) {
            if (accessModeVal === 2 || accessModeVal === '2' || accessModeVal === 4 || accessModeVal === '4') isActive = false
          } else if (stateVal !== undefined) {
            isActive = stateVal === 0 || stateVal === 'Active' || stateVal === '0'
          }
          return {
            id: r[DV.consultant.id],
            name: r[DV.consultant.fullName],
            email: r[DV.consultant.email],
            avatarUrl: wantAvatar ? (r[DV.consultant.avatar as string] || undefined) : undefined,
            aadObjectId: r[DV.consultant.azureAdObjectId] || undefined,
            isActive,
          }
        })
      } catch (e: any) {
        lastError = e
        const msg = e?.message || ''
        if (/404/.test(msg) || /Resource not found/i.test(msg)) break
        if (/Could not find a property named/.test(msg)) {
          if (wantDisabled && DV.consultant.disabledFlag && msg.includes(DV.consultant.disabledFlag)) { wantDisabled = false; continue }
          if (wantAccessMode && DV.consultant.accessMode && msg.includes(DV.consultant.accessMode)) { wantAccessMode = false; continue }
          if (wantAvatar && DV.consultant.avatar && msg.includes(DV.consultant.avatar)) { wantAvatar = false; continue }
          if (wantState && (msg.includes(DV.consultant.stateCode || '') || msg.toLowerCase().includes('statecode'))) { wantState = false; continue }
        }
        break
      }
    }
  }
  if (lastError) throw lastError
  return []
}
