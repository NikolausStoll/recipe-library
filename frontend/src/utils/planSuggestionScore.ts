import { addDaysIso, daysBetweenIso, isWeekendIsoDate } from './mealPlanDates'
import { isRecipePlannable, type MealPlan, type PlanEntry } from './mealPlanTypes'

export const PLAN_SUGGESTIONS_PER_DAY = 8

const CUISINE_TAGS = new Set([
  'italian',
  'asian',
  'american',
  'mediterranean',
  'greek',
  'spanish',
  'french',
  'mexican',
  'scandinavian',
  'middle_eastern',
  'other',
])

const DISH_TAGS = new Set([
  'pasta',
  'ramen',
  'soup',
  'salad',
  'burger',
  'sandwich',
  'bread',
  'baked',
  'dessert',
  'breakfast',
  'main',
  'side',
  'drink',
])

const WEIGHTS = {
  favorite: 12,
  wouldCookAgain: 10,
  frequency: 8,
  recency: 14,
  neverCooked: 7,
  timeFit: 12,
  health: 5,
  quickEasy: 8,
  passiveCook: 5,
  diversity: 10,
} as const

export type PlanDayTimeContext = 'weekday' | 'friday' | 'weekend'

export interface PlanSuggestionRecipe {
  id: number
  title: string
  favorite: boolean
  would_cook_again: 'yes' | 'maybe' | 'no' | null
  status: string
  tags?: string[]
  prep_time_min: number | null
  cook_time_min: number | null
  servings: number | null
  servings_value?: number | null
  image_path?: string | null
  image_thumb_path?: string | null
  image_urls_json?: string | null
  image_processing_pending?: boolean
}

export interface RecipeCookSummary {
  cookCount: number
  lastCookedDate: string | null
}

export interface PlanSuggestionInput {
  recipe: PlanSuggestionRecipe
  cookSummary?: RecipeCookSummary | null
  healthScore?: number | null
}

export interface PlanSuggestionScoreContext {
  targetDate: string
  today: string
  plannedOpenRecipeIds: Set<number>
  neighborTags: string[]
}

export interface PlanSuggestionScoreBreakdown {
  favorite: number
  wouldCookAgain: number
  frequency: number
  recency: number
  neverCooked: number
  timeFit: number
  health: number
  quickEasy: number
  passiveCook: number
  diversity: number
}

export interface PlanSuggestionCandidate {
  recipeId: number
  recipeTitle: string
  defaultServings: number
  score: number
  reasons: string[]
  breakdown: PlanSuggestionScoreBreakdown
}

export function isFridayIsoDate(isoDate: string): boolean {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).getDay() === 5
}

export function planDayTimeContext(isoDate: string): PlanDayTimeContext {
  if (isWeekendIsoDate(isoDate)) return 'weekend'
  if (isFridayIsoDate(isoDate)) return 'friday'
  return 'weekday'
}

export function getPlannedOpenRecipeIds(plan: MealPlan): Set<number> {
  const ids = new Set<number>()
  for (const day of plan.days) {
    for (const entry of day.entries) {
      if (!entry.cookedAt) ids.add(entry.recipeId)
    }
  }
  return ids
}

export function collectNeighborPlanTags(
  targetDate: string,
  plan: MealPlan,
  recipeTagsById: Map<number, string[]>,
): string[] {
  const neighborDates = new Set([addDaysIso(targetDate, -1), addDaysIso(targetDate, 1)])
  const tags: string[] = []
  for (const day of plan.days) {
    if (!neighborDates.has(day.date)) continue
    for (const entry of day.entries) {
      if (entry.cookedAt) continue
      const recipeTags = recipeTagsById.get(entry.recipeId) ?? []
      tags.push(...recipeTags)
    }
  }
  return tags
}

function defaultServingsForRecipe(recipe: PlanSuggestionRecipe): number {
  const base = recipe.servings_value ?? recipe.servings ?? 2
  return Math.max(1, Math.round(Number(base) || 2))
}

function wouldCookAgainBonus(value: PlanSuggestionRecipe['would_cook_again']): number {
  if (value === 'yes') return 1
  if (value === 'maybe') return 0.55
  return 0.25
}

function frequencyBonus(cookCount: number): number {
  if (cookCount <= 0) return 0
  const peak = 4
  const spread = 2.5
  return Math.exp(-((cookCount - peak) ** 2) / (2 * spread ** 2))
}

function recencyComponent(lastCookedDate: string | null, today: string): number {
  if (!lastCookedDate) return 0
  const days = daysBetweenIso(lastCookedDate, today)
  if (days < 7) return -1 + days / 7
  if (days <= 21) return 0
  return Math.min(1, (days - 21) / 21)
}

function timeFitScore(
  prep: number | null,
  cook: number | null,
  context: PlanDayTimeContext,
): number {
  const hasTimes = prep != null || cook != null
  if (!hasTimes) return 0.45

  const p = prep ?? 0
  const c = cook ?? 0
  const total = p + c

  if (context === 'weekday') {
    if (total <= 45) return 1
    if (total <= 75) return 0.55
    return 0.2
  }
  if (context === 'friday') {
    if (total >= 40 && total <= 90) return 1
    if (total <= 120) return 0.6
    return 0.35
  }
  if (total >= 75) return 0.9
  if (total >= 45) return 0.65
  return 0.4
}

function passiveCookBonus(prep: number | null, cook: number | null): number {
  const p = prep ?? 0
  const c = cook ?? 0
  if (c >= 90 && p <= 30) return 1
  if (c >= 60 && p <= 45) return 0.6
  return 0
}

function quickEasyBonus(tags: string[] | undefined, context: PlanDayTimeContext): number {
  if (context === 'weekend') return 0
  const tagSet = new Set(tags ?? [])
  if (tagSet.has('quick') && tagSet.has('easy')) return 1
  if (tagSet.has('quick') || tagSet.has('easy')) return 0.7
  return 0
}

function diversityOverlap(recipeTags: string[] | undefined, neighborTags: string[]): number {
  if (neighborTags.length === 0) return 0
  const recipeKeys = new Set(
    (recipeTags ?? []).filter((tag) => CUISINE_TAGS.has(tag) || DISH_TAGS.has(tag)),
  )
  if (recipeKeys.size === 0) return 0
  const overlaps = neighborTags.filter(
    (tag) => (CUISINE_TAGS.has(tag) || DISH_TAGS.has(tag)) && recipeKeys.has(tag),
  ).length
  return Math.min(1, overlaps * 0.45)
}

function healthNormalized(score: number | null | undefined): number {
  if (score == null || !Number.isFinite(score)) return 0.5
  return Math.max(0, Math.min(1, score / 100))
}

function buildReasons(
  recipe: PlanSuggestionRecipe,
  cookSummary: RecipeCookSummary | null | undefined,
  context: PlanDayTimeContext,
  breakdown: PlanSuggestionScoreBreakdown,
  today: string,
): string[] {
  const reasons: string[] = []
  if (recipe.favorite) reasons.push('Favorit')
  if (recipe.would_cook_again === 'yes') reasons.push('Wieder: ja')
  else if (recipe.would_cook_again === 'maybe') reasons.push('Wieder: ?')

  const cookCount = cookSummary?.cookCount ?? 0
  if (cookCount === 0) {
    reasons.push('Gekocht: 0')
  } else if (cookSummary?.lastCookedDate) {
    const days = daysBetweenIso(cookSummary.lastCookedDate, today)
    if (days >= 14) {
      const weeks = Math.max(1, Math.round(days / 7))
      reasons.push(`Gekocht: ${cookCount} · ${weeks} Wo.`)
    } else {
      reasons.push(`Gekocht: ${cookCount}`)
    }
  } else {
    reasons.push(`Gekocht: ${cookCount}`)
  }

  if (breakdown.quickEasy >= 0.7 && context !== 'weekend') reasons.push('Schnell')
  if (breakdown.passiveCook >= 0.6) reasons.push('Passiv')
  if (context === 'weekend' && breakdown.timeFit >= 0.75) reasons.push('Wochenende')
  if (context === 'weekday' && breakdown.timeFit >= 0.85) reasons.push('Wochentag')

  return reasons.slice(0, 3)
}

export function scoreRecipeForPlanDay(
  input: PlanSuggestionInput,
  context: PlanSuggestionScoreContext,
): PlanSuggestionCandidate | null {
  const { recipe, cookSummary, healthScore } = input
  if (!isRecipePlannable({ status: recipe.status, wouldCookAgain: recipe.would_cook_again })) {
    return null
  }
  if (context.plannedOpenRecipeIds.has(recipe.id)) return null

  const dayContext = planDayTimeContext(context.targetDate)
  const cookCount = cookSummary?.cookCount ?? 0

  const breakdown: PlanSuggestionScoreBreakdown = {
    favorite: recipe.favorite ? 1 : 0,
    wouldCookAgain: wouldCookAgainBonus(recipe.would_cook_again),
    frequency: frequencyBonus(cookCount),
    recency: recencyComponent(cookSummary?.lastCookedDate ?? null, context.today),
    neverCooked: cookCount === 0 ? 1 : 0,
    timeFit: timeFitScore(recipe.prep_time_min, recipe.cook_time_min, dayContext),
    health: healthNormalized(healthScore),
    quickEasy: quickEasyBonus(recipe.tags, dayContext),
    passiveCook: passiveCookBonus(recipe.prep_time_min, recipe.cook_time_min),
    diversity: diversityOverlap(recipe.tags, context.neighborTags),
  }

  const weighted =
    breakdown.favorite * WEIGHTS.favorite +
    breakdown.wouldCookAgain * WEIGHTS.wouldCookAgain +
    breakdown.frequency * WEIGHTS.frequency +
    breakdown.recency * WEIGHTS.recency +
    breakdown.neverCooked * WEIGHTS.neverCooked +
    breakdown.timeFit * WEIGHTS.timeFit +
    breakdown.health * WEIGHTS.health +
    breakdown.quickEasy * WEIGHTS.quickEasy +
    breakdown.passiveCook * WEIGHTS.passiveCook -
    breakdown.diversity * WEIGHTS.diversity

  const maxPositive =
    WEIGHTS.favorite +
    WEIGHTS.wouldCookAgain +
    WEIGHTS.frequency +
    WEIGHTS.neverCooked +
    WEIGHTS.timeFit +
    WEIGHTS.health +
    WEIGHTS.quickEasy +
    WEIGHTS.passiveCook +
    WEIGHTS.recency
  const score = Math.round(Math.max(0, Math.min(100, (weighted / maxPositive) * 100)))

  const reasons = buildReasons(recipe, cookSummary, dayContext, breakdown, context.today)

  return {
    recipeId: recipe.id,
    recipeTitle: recipe.title,
    defaultServings: defaultServingsForRecipe(recipe),
    score,
    reasons,
    breakdown,
  }
}

export function buildPlanSuggestionsForDay(
  inputs: PlanSuggestionInput[],
  context: PlanSuggestionScoreContext,
  limit = PLAN_SUGGESTIONS_PER_DAY,
): PlanSuggestionCandidate[] {
  const scored = inputs
    .map((input) => scoreRecipeForPlanDay(input, context))
    .filter((item): item is PlanSuggestionCandidate => item != null)
    .sort((a, b) => b.score - a.score || a.recipeTitle.localeCompare(b.recipeTitle, 'de'))

  return scored.slice(0, limit)
}

export function planEntryFromSuggestion(
  candidate: PlanSuggestionCandidate,
  extras?: Pick<PlanEntry, 'recipeImageUrl'>,
): Pick<PlanEntry, 'recipeId' | 'recipeTitle' | 'servings' | 'recipeImageUrl'> {
  return {
    recipeId: candidate.recipeId,
    recipeTitle: candidate.recipeTitle,
    servings: candidate.defaultServings,
    recipeImageUrl: extras?.recipeImageUrl ?? null,
  }
}
