import type {
  ShoppingAmountPart,
  ShoppingContribution,
  ShoppingIngredientInput,
  ShoppingListItem,
} from './shoppingListTypes'
import {
  normalizeIngredientNameForMerge,
  preferIngredientDisplayName,
} from './shoppingIngredientNameNormalize'

type UnitFamily = 'mass' | 'volume' | 'count' | 'other'

const MASS_UNITS: Record<string, number> = { g: 1, kg: 1000, mg: 0.001 }
const VOLUME_UNITS: Record<string, number> = { ml: 1, l: 1000, cl: 10, dl: 100 }

function normalizeUnit(unit: string | null | undefined): string {
  if (!unit?.trim()) return ''
  const u = unit.trim().toLowerCase()
  if (u === 'stk' || u === 'stück' || u === 'stueck') return 'stück'
  return u
}

function unitFamily(unit: string | null | undefined): UnitFamily {
  const u = normalizeUnit(unit)
  if (!u) return 'other'
  if (u in MASS_UNITS) return 'mass'
  if (u in VOLUME_UNITS) return 'volume'
  if (u === 'stück') return 'count'
  return 'other'
}

function hasRange(part: ShoppingAmountPart): boolean {
  return part.amountMax != null && part.amount != null && part.amountMax !== part.amount
}

function toBaseAmount(amount: number, unit: string, family: UnitFamily): number | null {
  const u = normalizeUnit(unit)
  if (family === 'mass') return amount * (MASS_UNITS[u] ?? NaN)
  if (family === 'volume') return amount * (VOLUME_UNITS[u] ?? NaN)
  if (family === 'count') return amount
  return null
}

function fromBaseAmount(total: number, family: UnitFamily): ShoppingAmountPart {
  if (family === 'mass') {
    if (total >= 1000) {
      const kg = Math.round((total / 1000) * 100) / 100
      return { amount: kg, amountMax: null, unit: 'kg' }
    }
    return { amount: Math.round(total * 100) / 100, amountMax: null, unit: 'g' }
  }
  if (family === 'volume') {
    if (total >= 1000) {
      const l = Math.round((total / 1000) * 100) / 100
      return { amount: l, amountMax: null, unit: 'l' }
    }
    return { amount: Math.round(total * 100) / 100, amountMax: null, unit: 'ml' }
  }
  return { amount: Math.round(total * 100) / 100, amountMax: null, unit: 'Stück' }
}

function tryMergeParts(a: ShoppingAmountPart, b: ShoppingAmountPart): ShoppingAmountPart | null {
  if (hasRange(a) || hasRange(b)) return null
  if (a.amount == null && b.amount == null) {
    if (normalizeUnit(a.unit) && normalizeUnit(a.unit) === normalizeUnit(b.unit)) {
      return { amount: null, amountMax: null, unit: a.unit ?? b.unit }
    }
    return null
  }
  if (a.amount == null || b.amount == null) return null

  const famA = unitFamily(a.unit)
  const famB = unitFamily(b.unit)

  if (famA === 'other' || famB === 'other') {
    if (normalizeUnit(a.unit) !== normalizeUnit(b.unit)) return null
    return {
      amount: Math.round((a.amount + b.amount) * 100) / 100,
      amountMax: null,
      unit: a.unit ?? b.unit,
    }
  }

  if (famA !== famB) return null

  const baseA = toBaseAmount(a.amount, a.unit ?? '', famA)
  const baseB = toBaseAmount(b.amount, b.unit ?? '', famB)
  if (baseA == null || baseB == null || Number.isNaN(baseA) || Number.isNaN(baseB)) return null

  return fromBaseAmount(baseA + baseB, famA)
}

export function mergeAmountParts(
  existing: ShoppingAmountPart[],
  incoming: ShoppingAmountPart[],
): ShoppingAmountPart[] {
  const result = existing.map((p) => ({ ...p }))

  for (const part of incoming) {
    if (part.amount == null && !part.unit?.trim()) continue

    let merged = false
    for (let i = 0; i < result.length; i++) {
      const combined = tryMergeParts(result[i], part)
      if (combined) {
        result[i] = combined
        merged = true
        break
      }
    }
    if (!merged) {
      result.push({ ...part })
    }
  }

  return result
}

export function shoppingItemMergeKey(ingredientName: string, category: string | null): string {
  const name = normalizeIngredientNameForMerge(ingredientName)
  const cat = category?.trim() || 'other'
  return `${name}|${cat}`
}

export function ingredientInputToAmountPart(input: ShoppingIngredientInput): ShoppingAmountPart {
  return {
    amount: input.amount,
    amountMax: input.amountMax,
    unit: input.unit,
  }
}

export function deriveSourceRecipes(contributions: ShoppingContribution[]): { id: number; title: string }[] {
  const byId = new Map<number, string>()
  for (const contribution of contributions) {
    if (!byId.has(contribution.recipeId)) {
      byId.set(contribution.recipeId, contribution.recipeTitle)
    }
  }
  return [...byId.entries()].map(([id, title]) => ({ id, title }))
}

export function recomputeAmountPartsFromContributions(
  contributions: ShoppingContribution[],
): ShoppingAmountPart[] {
  return contributions.reduce(
    (acc, contribution) => mergeAmountParts(acc, contribution.amountParts),
    [] as ShoppingAmountPart[],
  )
}

export function finalizeShoppingItem(
  item: Pick<ShoppingListItem, 'id' | 'ingredientName' | 'category' | 'contributions' | 'checked'>,
): ShoppingListItem {
  return {
    ...item,
    amountParts: recomputeAmountPartsFromContributions(item.contributions),
    sourceRecipes: deriveSourceRecipes(item.contributions),
  }
}

function cloneItem(item: ShoppingListItem): ShoppingListItem {
  return {
    ...item,
    amountParts: [...item.amountParts],
    contributions: item.contributions.map((c) => ({
      ...c,
      amountParts: c.amountParts.map((p) => ({ ...p })),
    })),
    sourceRecipes: [...item.sourceRecipes],
  }
}

export function mergeShoppingItems(
  existing: ShoppingListItem[],
  additions: ShoppingListItem[],
): ShoppingListItem[] {
  const byKey = new Map<string, ShoppingListItem>()
  for (const item of existing) {
    byKey.set(shoppingItemMergeKey(item.ingredientName, item.category), cloneItem(item))
  }

  for (const addition of additions) {
    const key = shoppingItemMergeKey(addition.ingredientName, addition.category)
    const current = byKey.get(key)
    if (!current) {
      byKey.set(key, cloneItem(addition))
      continue
    }

    current.contributions = [...current.contributions, ...addition.contributions.map((c) => ({
      ...c,
      amountParts: c.amountParts.map((p) => ({ ...p })),
    }))]
    current.ingredientName = preferIngredientDisplayName(current.ingredientName, addition.ingredientName)
    const finalized = finalizeShoppingItem(current)
    current.amountParts = finalized.amountParts
    current.sourceRecipes = finalized.sourceRecipes
  }

  return [...byKey.values()]
}

export function buildShoppingListItemsFromInputs(
  inputs: ShoppingIngredientInput[],
  sourceRecipe: { id: number; title: string },
): ShoppingListItem[] {
  const grouped = new Map<string, ShoppingListItem>()

  for (const input of inputs) {
    const key = shoppingItemMergeKey(input.ingredientName, input.category)
    const part = ingredientInputToAmountPart(input)
    const contribution: ShoppingContribution = {
      recipeId: sourceRecipe.id,
      recipeTitle: sourceRecipe.title,
      amountParts: [part],
    }
    const existing = grouped.get(key)
    if (existing) {
      existing.contributions.push(contribution)
      existing.ingredientName = preferIngredientDisplayName(existing.ingredientName, input.ingredientName.trim())
      const finalized = finalizeShoppingItem(existing)
      existing.amountParts = finalized.amountParts
      existing.sourceRecipes = finalized.sourceRecipes
    } else {
      grouped.set(
        key,
        finalizeShoppingItem({
          id: crypto.randomUUID(),
          ingredientName: input.ingredientName.trim(),
          category: input.category,
          contributions: [contribution],
          checked: false,
        }),
      )
    }
  }

  return [...grouped.values()]
}

export function removeRecipeFromItems(items: ShoppingListItem[], recipeId: number): ShoppingListItem[] {
  const result: ShoppingListItem[] = []
  for (const item of items) {
    const contributions = item.contributions.filter((c) => c.recipeId !== recipeId)
    if (contributions.length === 0) continue
    result.push(
      finalizeShoppingItem({
        id: item.id,
        ingredientName: item.ingredientName,
        category: item.category,
        contributions,
        checked: item.checked,
      }),
    )
  }
  return result
}

export function removeItemById(items: ShoppingListItem[], itemId: string): ShoppingListItem[] {
  return items.filter((item) => item.id !== itemId)
}

export function toggleItemChecked(items: ShoppingListItem[], itemId: string): ShoppingListItem[] {
  return items.map((item) => (item.id === itemId ? { ...item, checked: !item.checked } : item))
}

/** Merge two rows into one; keeps `keepId` name and combines contributions. */
export function mergeItemsById(
  items: ShoppingListItem[],
  keepId: string,
  removeId: string,
): ShoppingListItem[] {
  const keep = items.find((item) => item.id === keepId)
  const remove = items.find((item) => item.id === removeId)
  if (!keep || !remove || keepId === removeId) return items

  const merged = finalizeShoppingItem({
    id: keep.id,
    ingredientName: keep.ingredientName,
    category: keep.category ?? remove.category,
    contributions: [...keep.contributions, ...remove.contributions],
    checked: keep.checked && remove.checked,
  })

  return items
    .filter((item) => item.id !== removeId)
    .map((item) => (item.id === keepId ? merged : item))
}

/** Re-group list rows by merge key (e.g. after plural normalization rules change). */
export function regroupShoppingItems(items: ShoppingListItem[]): ShoppingListItem[] {
  if (items.length <= 1) return items
  return mergeShoppingItems([], items)
}
