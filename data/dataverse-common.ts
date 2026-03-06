import { DV } from '@/lib/dataverse-config'

// Basic color palette for deterministic color assignment
const PROJECT_COLORS = ['#01EED4', '#6366f1', '#f59e0b', '#dc2626', '#6B7280', '#10b981', '#8b5cf6']
const colorCache = new Map<string, string>()

export function assignColor(id: string): string {
  if (colorCache.has(id)) return colorCache.get(id) as string
  const color = PROJECT_COLORS[colorCache.size % PROJECT_COLORS.length]
  colorCache.set(id, color)
  return color
}

export function ensureEnabled(): void {
  if (!DV.baseUrl) throw new Error('Dataverse disabled: DATAVERSE_URL not set')
}
