export function getPerServingValue(total?: number | null, servings?: number | null) {
  if (total == null) return null
  const divisor = servings && servings > 0 ? servings : 1
  const result = total / divisor
  if (!Number.isFinite(result)) return null
  return Number(result.toFixed(1))
}
