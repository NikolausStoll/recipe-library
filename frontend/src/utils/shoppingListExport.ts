import type { ShoppingListGroup } from './shoppingListTypes'
import { formatShoppingLine } from './shoppingListFormat'

/** Plain-text export for copy/share; only unchecked items. */
export function formatShoppingListAsText(
  groups: ShoppingListGroup[],
  options: { includeChecked?: boolean } = {},
): string {
  const includeChecked = options.includeChecked ?? false
  const lines: string[] = ['Einkaufsliste', '']

  for (const group of groups) {
    const items = includeChecked ? group.items : group.items.filter((item) => !item.checked)
    if (items.length === 0) continue
    lines.push(group.categoryLabel)
    for (const item of items) {
      lines.push(`- ${formatShoppingLine(item)}`)
    }
    lines.push('')
  }

  return lines.join('\n').trimEnd()
}

export async function copyShoppingListToClipboard(text: string): Promise<boolean> {
  if (!text.trim()) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
