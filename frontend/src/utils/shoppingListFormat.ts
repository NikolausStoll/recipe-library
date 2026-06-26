import type { ShoppingAmountPart, ShoppingListItem } from './shoppingListTypes'

const COMPACT_UNITS = new Set(['g', 'kg', 'mg', 'ml', 'l', 'cl', 'dl'])

function formatAmountWithUnit(amountStr: string, unit: string): string {
  const u = unit.trim()
  if (!amountStr) return u
  if (!u) return amountStr
  if (COMPACT_UNITS.has(u.toLowerCase())) return `${amountStr}${u}`
  return `${amountStr} ${u}`
}

function formatSinglePart(part: ShoppingAmountPart): string {
  const { amount, amountMax, unit } = part
  if (amount == null && !unit?.trim()) return ''

  let amountStr = ''
  if (amount != null) {
    const rounded = Math.round(amount * 100) / 100
    if (amountMax != null && amountMax !== amount) {
      const roundedMax = Math.round(amountMax * 100) / 100
      amountStr = `${rounded}-${roundedMax}`
    } else {
      amountStr = String(rounded)
    }
  }

  return formatAmountWithUnit(amountStr, unit?.trim() ?? '')
}

/** `Tomaten (400g)` or `Tomaten (200g, 1 Handvoll)`. */
export function formatShoppingLine(item: ShoppingListItem): string {
  const name = item.ingredientName.trim()
  const hints = item.amountParts.map(formatSinglePart).filter(Boolean)
  if (hints.length === 0) return name
  return `${name} (${hints.join(', ')})`
}
