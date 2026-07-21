# Plan & shopping backend persistence

Sync meal plan and shopping list across devices (phone / tablet / desktop) via the existing SQLite backend. No auth, no multi-user.

**Last updated:** 2026-07-21  
**Related:** [plan-tool-spec.md](./plan-tool-spec.md), [shopping-list-spec.md](./shopping-list-spec.md)

---

## Confirmed product decisions (2026-07-21)

| Topic | Decision |
|-------|----------|
| Why backend | **Device switch** is essential (phone ↔ tablet ↔ desktop). |
| Auth / user model | **None.** Single household DB; one plan + one shopping list. |
| Sync conflicts | **Last-write-wins** via `updated_at` (typically one active device). |
| localStorage migration | **No.** On cutover, server state is empty; old browser data is discarded. |
| Plan retention | Keep plan entries for roughly **last 30 days**; older open/past plan rows may be pruned. Longer history = **cook calendar from `recipe_history`**, not from the planner. |
| Deleted recipes | Plan/shopping rows that reference a missing recipe are **dropped** (or skipped in UI). No orphan UX. |
| “Was on shopping list” | **Out of scope** forever for v1 calendar; do not log shopping history. |
| Aisle order | **Persisted on server** and identical on all devices. |
| Shopping list | Persist current list document only (items, checked, contributions). |

---

## Scope

### In

1. **Shopping list** — CRUD document API; replace localStorage as source of truth.
2. **Shopping aisle order** — server-stored category order array.
3. **Meal plan** — days/entries for the rolling window + ~30 days past; replace localStorage.
4. Frontend: load on app/plan/shopping open; save on change (debounced where useful).
5. Optional: prune job or on-read cleanup for plan entries older than 30 days.

### Out

- User accounts / auth
- Conflict merge UI
- Shopping history / “was bought”
- Planned-but-not-cooked long archive beyond ~30 days
- Migrating existing `localStorage` payloads

---

## Suggested data model (SQLite)

### Shopping (document style)

```text
shopping_list_meta
  id INTEGER PRIMARY KEY CHECK (id = 1)   -- singleton
  updated_at TEXT NOT NULL
  aisle_order_json TEXT                     -- string[] category keys, or NULL = default

shopping_list_items
  id TEXT PRIMARY KEY
  ingredient_name TEXT NOT NULL
  category TEXT
  amount_parts_json TEXT NOT NULL           -- ShoppingAmountPart[]
  contributions_json TEXT NOT NULL          -- ShoppingContribution[]
  source_recipes_json TEXT NOT NULL
  checked INTEGER NOT NULL DEFAULT 0
  position INTEGER                          -- optional stable order
  updated_at TEXT
```

Alternatively store the whole list as one JSON blob on `shopping_list_meta` (simpler MVP, harder partial updates). Prefer **rows + aisle_order on meta** if item updates are frequent; **blob** is fine for last-write-wins whole-document PUT.

**MVP recommendation:** `GET/PUT /api/shopping-list` with body `{ updatedAt, aisleOrder, items[] }` — one document, last-write-wins.

### Meal plan

```text
meal_plan_meta
  id INTEGER PRIMARY KEY CHECK (id = 1)
  day_count INTEGER NOT NULL DEFAULT 7
  updated_at TEXT NOT NULL

meal_plan_entries
  id TEXT PRIMARY KEY
  plan_date TEXT NOT NULL                   -- YYYY-MM-DD
  recipe_id INTEGER                         -- FK soft; NULL/delete if recipe gone
  recipe_title TEXT NOT NULL                -- snapshot
  recipe_image_url TEXT
  servings REAL NOT NULL
  sort_order INTEGER NOT NULL DEFAULT 0
  role TEXT
  added_at TEXT NOT NULL
  cooked_at TEXT                            -- ISO date when checked in plan, else NULL
```

**MVP recommendation:** `GET/PUT /api/meal-plan` with body matching current frontend `MealPlan` shape (`version`, `dayCount`, `days[]`, `updatedAt`). Server may prune entries with `plan_date < today - 30` on write or via periodic cleanup.

---

## API (draft)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/shopping-list` | Full document + `updatedAt` + aisle order |
| `PUT` | `/api/shopping-list` | Replace document; optional If-Unmodified-Since / client `updatedAt` check → 409 then client reloads |
| `GET` | `/api/meal-plan` | Normalized rolling window + retained past (~30d) |
| `PUT` | `/api/meal-plan` | Replace plan; prune old dates |

409 on stale `updatedAt` is optional; if omitted, pure last-write-wins is enough per product decision.

---

## Frontend cutover

1. Implement API + storage services.
2. Point `useShoppingList` / aisle order storage / `useMealPlan` at API (keep types).
3. Remove or stop writing `recipe-library-shopping-list-v2`, `recipe-library-shopping-category-order`, `recipe-library-meal-plan-v1`.
4. No import path from localStorage.

Offline: optional later; for MVP, failed save → toast / retry. Cache last successful GET in memory (and optionally localStorage as **cache only**, not source of truth).

---

## Calendar (later)

- **Cooked:** `recipe_history` only.
- **Planner:** not a long-term archive; ~30 days of plan rows is enough for “recent plan”.
- No shopping-list archaeology.

---

## Implementation order

1. Shopping list document + aisle order API  
2. Wire frontend shopping  
3. Meal plan API  
4. Wire frontend plan  
5. Prune plan entries > 30 days  

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-21 | Product decisions locked; MVP document APIs; no migration; no auth; aisle order server-side. |
