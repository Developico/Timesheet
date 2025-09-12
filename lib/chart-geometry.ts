export interface BarGeometryResult {
  barWidth: number
  gap: number
  padding: { top: number; right: number; bottom: number; left: number }
}

// Computes bar width & gap to tightly fill width while preserving min constraints.
// count: number of bars; containerWidth: pixel width of outer wrapper.
// Returns geometry used by both ActiveProjects and HoursSummary charts.
export function computeBarGeometry(count: number, containerWidth: number): BarGeometryResult {
  const padding = { top: 10, right: 16, bottom: 36, left: 36 }
  const available = Math.max(200, containerWidth - padding.left - padding.right)
  const gapFactor = 0.6
  let barWidth = (available / (count + (count - 1) * gapFactor)) || 6
  barWidth = Math.max(4, barWidth)
  const gap = Math.max(2, barWidth * gapFactor)
  return { barWidth, gap, padding }
}