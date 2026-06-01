# Recipe Library Redesign Spec

## Purpose

Redesign the existing Vue recipe app from an admin-style recipe database into a calm, image-led personal cookbook.

The app is used by one home cook to collect recipes from cookbooks, websites, photos, and manual entry. It should help with browsing cooking ideas, adding recipes quickly, reviewing AI-extracted recipes, planning meals, and eventually creating shopping lists.

The backend and AI extraction logic are already solid and should be preserved. This redesign is primarily a frontend/product shell rewrite.

---

## High-level Direction

### Current Problem

The current UI is functional but feels bland and too much like an admin CRUD application.

Common issues:

- Too much "database management" feeling.
- Desktop and mobile share the same mental model.
- Recipe cards are functional but not emotionally engaging.
- Editor feels like a Shopify/product admin form.
- Tags use a native multi-select and feel unfinished.
- AI extraction states are not clearly integrated into the user experience.
- The visual design relies on orange UI accents, which compete with food images.
- The app does not yet feel like a personal cookbook.

### Target Feeling

The app should feel like:

> A calm personal cookbook that helps me rediscover things I want to cook.

The design should be:

- Image-led.
- Minimal but not empty.
- Calm.
- Personal.
- Fast on mobile.
- Useful on tablet.
- Productive on desktop.
- Dark-mode friendly.
- Not visually noisy.
- Not "food delivery app" themed.
- Not a generic SaaS dashboard.

Food photos should provide most of the color and emotion. The UI should stay restrained.

---

## Technical Context

- Frontend: Vue.
- Styling: pure CSS.
- Backend: existing backend should remain.
- AI extraction/OCR logic: already implemented and should remain.
- Data model: recipes, sources, favorites, nutrition/prep/health fields already exist.
- Sources are official managed entities.
- URLs are persisted for jumping back to recipe origin, but URLs are not managed as official sources.
- Meal planning and shopping are not finished yet; keep them as first-class navigation placeholders but do not invent complex behavior in this redesign pass.

---

## Core Product Principles

### 1. Recipes are the Home

Do not use a generic dashboard as the main entry point.

The recipe overview is the emotional home of the app.

Remove or hide the current `Dashboard` navigation item unless it has a specific future purpose.

### 2. Food Images Lead the Interface

Recipe photos should be large and prominent.

Avoid decorative UI that competes with photos.

Use neutral backgrounds, subtle borders, and restrained accents.

### 3. Mobile is a First-class Experience

This app will often be used on mobile or tablet.

Mobile should not be a compressed desktop view.

Use bottom navigation on mobile.

Adding recipes should be very easy from mobile, especially from camera/photos.

### 4. Editing is Structured, Not Wizard-like

A recipe is not a checkout flow.

Replace the current step-based editor with a section-based editor.

The user should be able to jump between:

- Basics
- Image
- Ingredients
- Instructions
- Nutrition & Health
- Tags
- Source
- Original Text / OCR

### 5. AI Should Be Trustworthy and Contextual

AI should not feel like a separate gimmick.

AI actions should appear near the content they affect.

Important AI states:

- Extracted from photo.
- Needs review.
- AI suggested tags.
- AI calculated nutrition.
- AI estimated times.
- Original OCR available.
- AI cleaned/translated/normalized version available.

### 6. "Needs review" Is Better Than "Draft"

This is a private app. "Draft" implies publishing.

After AI OCR/import, the user should see `Needs review`.

Meaning:

> This recipe was extracted by AI and should be checked before cooking.

Use `Needs review` on recipe cards, in recipe detail, and in editor state.

---

## Design System

Implement the redesign around semantic CSS variables.

Do not hardcode colors inside components.

All major colors, spacing, radius, shadows, and navigation dimensions should be defined as tokens.

### Base CSS Tokens

```css
:root {
  color-scheme: light;

  --color-bg: #f6f5f2;
  --color-surface: #ffffff;
  --color-surface-raised: #ffffff;
  --color-surface-subtle: #f0efec;

  --color-text: #1d1f25;
  --color-text-muted: #6f7583;
  --color-text-soft: #8c92a0;

  --color-border: #e2e4ea;
  --color-border-strong: #cfd3dc;

  --color-accent: #5f5ce6;
  --color-accent-hover: #504dd2;
  --color-accent-soft: #eeeeff;
  --color-accent-text: #ffffff;

  --color-danger: #d94a4a;
  --color-danger-soft: #fff0f0;

  --color-success: #3d8b64;
  --color-success-soft: #edf8f2;

  --color-warning: #a86d1d;
  --color-warning-soft: #fff4df;

  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;

  --shadow-soft: 0 8px 24px rgba(20, 20, 20, 0.08);
  --shadow-card: 0 2px 10px rgba(20, 20, 20, 0.06);

  --font-family-base: "Work Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

  --page-max-width: 1440px;
  --content-padding-desktop: 32px;
  --content-padding-tablet: 24px;
  --content-padding-mobile: 16px;

  --top-nav-height: 64px;
  --bottom-nav-height: 72px;

  --transition-fast: 140ms ease;
}
```

### Dark Mode Tokens

```css
[data-theme="dark"] {
  color-scheme: dark;

  --color-bg: #111217;
  --color-surface: #181a20;
  --color-surface-raised: #20232b;
  --color-surface-subtle: #242731;

  --color-text: #f4f4f5;
  --color-text-muted: #a1a6b3;
  --color-text-soft: #7f8593;

  --color-border: #30333d;
  --color-border-strong: #464a57;

  --color-accent: #8b88ff;
  --color-accent-hover: #a09dff;
  --color-accent-soft: rgba(139, 136, 255, 0.16);
  --color-accent-text: #ffffff;

  --color-danger: #ff6b6b;
  --color-danger-soft: rgba(255, 107, 107, 0.14);

  --color-success: #63c58f;
  --color-success-soft: rgba(99, 197, 143, 0.14);

  --color-warning: #e1a64d;
  --color-warning-soft: rgba(225, 166, 77, 0.16);

  --shadow-soft: 0 8px 24px rgba(0, 0, 0, 0.35);
  --shadow-card: 0 2px 12px rgba(0, 0, 0, 0.28);
}
```

### Future Accent Switching

Implement accent colors through variables only.

Accent switching should eventually update:

```css
--color-accent
--color-accent-hover
--color-accent-soft
```

Do not scatter accent-specific class names like `.orange`, `.purple`, etc. in components.

---

## Typography

The current Work Sans can remain for now.

Do not make typography overly bold.

Recommended hierarchy:

```css
.h1 {
  font-size: clamp(2rem, 4vw, 3.5rem);
  line-height: 1.05;
  font-weight: 650;
  letter-spacing: -0.04em;
}

.h2 {
  font-size: clamp(1.5rem, 2.5vw, 2.25rem);
  line-height: 1.15;
  font-weight: 620;
  letter-spacing: -0.03em;
}

.h3 {
  font-size: 1.25rem;
  line-height: 1.25;
  font-weight: 620;
}

.body {
  font-size: 1rem;
  line-height: 1.55;
}

.meta {
  font-size: 0.875rem;
  line-height: 1.4;
  color: var(--color-text-muted);
}
```

Avoid giant labels on form pages.

Avoid heavy all-caps except for very small badges.

---

## App Shell

### Desktop Navigation

Use top navigation on desktop.

Recommended primary nav:

```text
Recipes
Plan
Shopping
Sources
More
```

Do not show `Dashboard` in the primary navigation.

Do not show `Admin` directly in the primary navigation. Move it under `More`.

`Favorites` should not be a top-level item unless the existing app strongly depends on it. Prefer a filter/chip inside Recipes.

Desktop top nav requirements:

- Height: `--top-nav-height`.
- Sticky at top.
- Subtle bottom border.
- App logo/name on the left.
- Navigation centered or left-aligned after logo.
- Actions/settings on the right if needed.
- Dark mode toggle can live under More or as an icon in the top nav.

### Mobile Navigation

Use bottom navigation on mobile.

Recommended mobile nav:

```text
Recipes | Plan | Add | Shopping | More
```

The center Add item is important.

Reason:

- Adding recipes is a core workflow.
- The user often sees recipes in cookbooks and wants to quickly capture them.
- Adding should not be hidden behind a floating action button.

Mobile bottom nav requirements:

- Fixed to bottom.
- Height: `--bottom-nav-height`.
- Use safe-area inset padding.
- Label + icon.
- Center Add item can be visually emphasized but should not be a floating circular Material-style FAB.
- Avoid bright orange FAB styling.
- Content pages must include bottom padding so content is not hidden behind navigation.

Example CSS:

```css
.mobile-bottom-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background: color-mix(in srgb, var(--color-surface) 94%, transparent);
  border-top: 1px solid var(--color-border);
  backdrop-filter: blur(16px);
  z-index: 50;
}
```

---

## Responsive Breakpoints

Use simple CSS breakpoints:

```css
@media (max-width: 767px) {
  /* mobile */
}

@media (min-width: 768px) and (max-width: 1023px) {
  /* tablet */
}

@media (min-width: 1024px) {
  /* desktop */
}
```

Behavior:

- Desktop: top navigation.
- Tablet: top navigation may remain, but layouts should become less dense.
- Mobile: bottom navigation, simplified headers, full-width content.

---

## Shared Components

### Buttons

Button types:

- Primary
- Secondary
- Ghost
- Danger
- Icon button

Primary buttons should use `--color-accent`.

Avoid orange.

Use small radius.

Example:

```css
.button {
  border-radius: var(--radius-sm);
  min-height: 44px;
  padding: 0 16px;
  font-weight: 560;
  border: 1px solid transparent;
  transition: background var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast);
}

.button-primary {
  background: var(--color-accent);
  color: var(--color-accent-text);
}

.button-secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border-color: var(--color-border);
}

.button-ghost {
  background: transparent;
  color: var(--color-text-muted);
}
```

### Inputs

Inputs should be clean and app-like, not heavy form controls.

Requirements:

- Height at least 44px.
- Border uses `--color-border`.
- Focus ring uses accent.
- Radius small/medium.
- Works in dark mode.

### Chips

Chips are important for tags and filters.

Types:

- Filter chip.
- Selected filter chip.
- Tag chip.
- Suggested tag chip.
- Status chip.

Avoid too many colors.

### Cards

Cards should be subtle.

Use:

- White/dark surface.
- Small radius.
- Thin border or soft shadow, not both aggressively.
- Image-first for recipe cards.

---

## Recipe Overview Screen

### Goal

The recipe overview should feel like opening a personal cookbook, not viewing a database table.

### Current State to Replace

Avoid this pattern:

```text
My Recipes
5 recipes in your collection
Search recipes by title
Search ingredients
Sort dropdown
5 recipes shown
Recipe grid
```

### Target Layout

Desktop:

```text
Recipes

[Search recipes, ingredients, tags...]

All  Favorites  Quick  Healthy  Dinner  From books  Needs review

[Recipe grid]
```

Mobile:

```text
Recipes

[Search]

Horizontal filter chips:
All  Favorites  Quick  Healthy  Dinner  Books  Review

[Recipe cards]
```

### Search

Replace separate title and ingredient search fields with one unified search field if technically feasible.

Placeholder:

```text
Search recipes, ingredients, tags...
```

If separate searching must remain internally, map the single field to existing search logic or keep advanced ingredient search behind a filter panel.

### Filters

Use chips below search.

Initial suggested chips:

- All
- Favorites
- Quick
- Healthy
- Dinner
- From books
- Needs review

Do not overbuild filtering in this pass.

Sort should be secondary:

- Desktop: small sort control aligned right.
- Mobile: accessible through a filter/sort sheet or small icon button.

### Recipe Count

Do not prominently display `5 recipes shown`.

If needed, show subtle text in the filter/sort area.

Example:

```text
5 recipes
```

Do not make it a major part of the UI.

### Recipe Grid

Desktop:

- Use CSS grid.
- Cards should be larger than current cards.
- Prefer 3-5 columns depending on viewport.
- Let images breathe.

Tablet:

- 2-3 columns.

Mobile:

- 1 column.
- Large image.
- Title and compact metadata below.

Example CSS:

```css
.recipe-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 24px;
}

@media (max-width: 767px) {
  .recipe-grid {
    grid-template-columns: 1fr;
    gap: 20px;
  }
}
```

---

## Recipe Card

### Goal

Recipe cards should create appetite and curiosity.

### Structure

```text
[Image]

Title
Meta line
Optional status
```

Example:

```text
Vegan Couscous Salad
25 min · Balanced · Book
```

### Card Requirements

- Image is dominant.
- Title is readable.
- Metadata is optional and compact.
- Do not show too many badges.
- Do not show large `DRAFT` badge.
- Use `Needs review` only when action is required.
- Favorite can be a subtle icon.
- Card clickable area should be the whole card.

### Metadata Priority

Use at most 2-3 metadata items:

1. Time
2. Health label or calories
3. Source type or servings

Examples:

```text
25 min · Balanced
45 min · 4 servings
Book · 520 kcal
```

### Status Badge

Replace `DRAFT` with `Needs review`.

Visual style:

```css
.status-chip-review {
  background: var(--color-warning-soft);
  color: var(--color-warning);
  border: 1px solid color-mix(in srgb, var(--color-warning) 22%, transparent);
}
```

Position:

- Top-left overlay on image, but smaller than current draft badge.
- Or below title as subtle meta.

---

## Recipe Detail Screen

### Goal

Recipe detail should support deciding, cooking, and understanding the recipe.

It should not feel like a static document or admin page.

### Layout

Desktop/tablet:

```text
[Hero image]

Title
Subtitle/description

Meta row:
Prep time · Cook time · Servings · Health status · Calories

Actions:
Cook
Add to plan
Favorite
Add ingredients to shopping list

Main content:
Ingredients      Instructions
Nutrition       Source
Notes
```

Mobile:

```text
[Image]
Title
Meta row
Actions

Sections:
Overview
Ingredients
Steps
Nutrition
Source
```

Mobile can use a sticky section tab row or simple scroll sections.

### Hero Area

- Large image at top.
- Image should feel like the visual anchor.
- If no image exists, use a calm placeholder, not a loud empty box.

### Main Actions

Primary action:

```text
Cook
```

Secondary:

```text
Add to plan
Favorite
Shopping list
Edit
```

Do not overemphasize edit on the normal recipe detail page.

### Ingredients

Ingredients should be scannable.

Optional future behavior:

- Check off ingredients.
- Add all ingredients to shopping list.
- Adjust servings.

Current serving adjustment can remain, but style it calmly.

### Instructions

Use simple numbered steps.

Avoid large orange circles.

Preferred style:

```text
1
Cook the couscous according to package instructions.

2
Prepare vegetables and rinse chickpeas.
```

Use accent sparingly.

### Nutrition & Health

Show nutrition as an estimate.

Do not make the app feel like a strict diet tracker.

Suggested labels:

- Balanced
- Light
- Protein rich
- Comfort food
- Needs vegetables
- Energy dense

Example layout:

```text
Nutrition estimate

Calories
Protein
Carbs
Fat

Health notes:
- Good amount of fiber
- Could use more protein
- Reduce oil slightly for a lighter version
```

AI action:

```text
Make healthier
```

---

## Cooking Mode

### Goal

Cooking mode should be distinct from browsing mode.

It should be readable in the kitchen and work well on mobile/tablet.

### Entry Point

Primary button on recipe detail:

```text
Cook
```

### Mobile Layout

```text
Step 2 of 6

Prepare vegetables and rinse chickpeas.

Ingredients for this step:
- cucumber
- chickpeas
- onion

[Previous] [Next]
```

### Requirements

- Large typography.
- Minimal controls.
- No editing controls.
- Easy previous/next.
- Access to full ingredient list.
- Option to exit cooking mode.
- Keep screen awake if this is feasible; otherwise leave as future enhancement.

### Desktop/Tablet Layout

Possible split layout:

```text
Ingredients              Current Step
                         Step 2 of 6
                         ...
```

Cooking mode can be implemented after the main redesign if needed, but the recipe detail should already have a clear `Cook` action.

---

## Add Recipe Flow

### Goal

Adding recipes must be fast, especially on mobile.

### Mobile Add Navigation

The center bottom navigation item opens Add Recipe.

### Add Recipe Screen

Mobile order:

```text
Add recipe

Take photo
Upload image
Paste website
Manual entry
```

Desktop order:

```text
Add recipe

Upload image
Paste website
Manual entry
Take photo
```

Taking photos is primarily useful on mobile.

Uploading images and pasting URLs are more useful on desktop.

### Add Option Cards

Each option should be a simple card/button with title and short description.

Example:

```text
Take photo
Capture a recipe from a cookbook, magazine or note.

Upload image
Use photos you already took.

Paste website
Import from a recipe URL.

Manual entry
Start with an empty recipe.
```

### After AI Import

Do not dump the user directly into a huge form.

Show a compact import review screen:

```text
Recipe extracted

Title found
Image found
12 ingredients found
6 instruction steps found
Nutrition not calculated
Tags suggested
Source not linked

[Review recipe]
[Save for later]
```

Imported recipes should default to `Needs review`.

---

## Recipe Editor

### Goal

The editor must support complex recipe data without feeling like an enterprise form.

### Replace Wizard With Section Editor

Remove the Step 1 / Step 2 / Step 3 visual wizard.

Use a structured editor.

Top:

```text
Edit Recipe

Status: Needs review
Review AI-extracted ingredients and instructions before cooking.

[Mark as reviewed]
```

Sections:

```text
Basics
Image
Ingredients
Instructions
Nutrition & Health
Tags
Source
Original Text
```

Each section should be collapsible or navigable.

### Desktop Editor Layout

Use two columns if enough width is available:

```text
Main editor area                 Review / Original / AI panel
```

Main editor:

- Basics
- Image
- Ingredients
- Instructions
- Nutrition & Health
- Tags
- Source

Side panel:

- Original OCR.
- Source image preview.
- AI suggestions.
- Import confidence/status.
- Contextual actions.

If side panel is too much for the first implementation, use a collapsible right drawer.

### Mobile Editor Layout

Do not show one giant form.

Show a section list first:

```text
Edit Recipe

Basics              Complete
Image               Complete
Ingredients         Needs review
Instructions        Needs review
Nutrition           Calculated
Tags                5 selected
Source              Cookbook
Original text        Available
```

Tap a section to open a focused editing screen or collapsible section.

### Editor Section Status

Use status text, not loud colors.

Examples:

- Complete
- Needs review
- Missing
- AI generated
- Calculated
- Available

### Save Behavior

Keep existing save logic if possible.

Preferred UX:

- Autosave if already implemented.
- Otherwise show a sticky save bar only when there are unsaved changes.

Avoid large persistent form buttons that dominate the page.

---

## OCR and AI Comparison

### Goal

The user needs to compare original OCR text with AI-cleaned/recalculated content.

This is important because the user may cook from AI-extracted recipes.

### Terminology

Use clear labels:

- Original scan
- Original OCR
- AI version
- Cleaned version
- Translated version
- Normalized ingredients

Avoid vague labels like `generated content`.

### Desktop Behavior

For ingredients and instructions, allow comparison.

Option A: split view

```text
Ingredients

AI version                         Original OCR
225 g couscous                     225 g Couscous...
1 can chickpeas                    1 Kichererbsen...
```

Option B: editor side panel

```text
Main editor: AI cleaned fields
Right panel: Original OCR
```

Start with Option B if easier.

### Mobile Behavior

Do not use side-by-side comparison.

Use:

```text
AI Version | Original
```

or an expandable:

```text
Show original text
```

The default should be AI Version.

---

## Tags UX

### Current Problem

The native multi-select tag list is not acceptable for this app.

It feels unfinished and admin-like.

### Target UX

Use searchable chips.

Layout:

```text
Tags

[quick] [lunch] [vegan] [salad] [x]

Add tag...
[Search or create tag]

Suggested by AI
[healthy] [meal prep] [mediterranean] [summer]
```

### Requirements

- Selected tags display as removable chips.
- User can search existing tags.
- User can add/create a tag if allowed by existing logic.
- AI-suggested tags appear separately.
- Clicking a suggested tag adds it.
- No native multi-select.
- Tags should work with keyboard and touch.
- Tags should wrap cleanly on mobile.

### Tag Data

Keep existing tag model if possible.

If display labels are missing, derive them from tag names.

Do not overbuild tag categories yet.

---

## Sources

### Goal

Sources should feel like a personal cookbook shelf.

This is a unique differentiator because the user likes cooking from books.

### Source Overview

Replace table/admin presentation with cards.

For cookbooks:

```text
[Cover image]
Simple
Ottolenghi
12 recipes
```

For websites or URL-based origins that are not official managed sources:

- Persist URL on recipe.
- Show URL in recipe source section.
- Do not require website URLs to become managed source entities.

### Sources Navigation

Sources can remain in desktop primary navigation.

On mobile, put Sources under `More` unless the current workflow strongly requires direct access.

### Source Detail

Layout:

```text
[Cover image]

Title
Author
Type
Notes

Recipes from this source
[Recipe grid]
```

### Recipe Source Section

On recipe detail:

```text
Source

Cookbook title
Page number if available
Original URL if available
Original scan if available
```

The source section should help the user jump back to the cookbook/URL.

---

## Favorites

Favorites should continue to exist.

Do not necessarily keep Favorites as a top-level navigation item.

Preferred:

- Recipe filter chip: `Favorites`
- Favorite icon on recipe cards/detail
- Optional section under More

---

## Plan and Shopping

These features are not finished.

Do not fully design or invent them in this pass.

Navigation should still reserve space:

- Desktop: Plan and Shopping in top nav.
- Mobile: Plan and Shopping in bottom nav.

For now:

- Keep existing placeholder screens if present.
- Do not create complex meal planning/calendar behavior.
- Ensure visual style matches the new shell.

Future direction:

- Plan can become a weekly plan or "cook soon" queue.
- Shopping can be generated from planned recipes or selected recipes.

---

## Admin and Settings

Admin should not be primary.

Move admin/settings to More.

More screen should include:

```text
Settings
Sources
Favorites
Admin
Theme
About
```

Settings should eventually include:

- Light/dark/system theme.
- Accent color.
- Import preferences.
- AI preferences.
- Tag management if needed.

Dark mode must be available in this redesign.

---

## Theme Handling

Implement theme support in Vue in a simple way.

Preferred:

- Store theme preference in localStorage.
- Support `light`, `dark`, and optionally `system`.
- Apply theme via `data-theme` on the document root.

Example:

```js
document.documentElement.dataset.theme = selectedTheme
```

If `system` is implemented, listen to:

```js
window.matchMedia("(prefers-color-scheme: dark)")
```

Acceptance criteria:

- All redesigned screens work in light and dark mode.
- No hardcoded black-on-white assumptions.
- Food images remain unchanged.
- Borders and surfaces are visible in dark mode.
- Focus states are visible in both themes.

---

## Accessibility Requirements

- Use semantic buttons and links.
- Bottom navigation items must be reachable by keyboard.
- Inputs must have labels.
- Icon-only buttons must have accessible labels.
- Focus states must be visible.
- Text contrast must be sufficient in light and dark mode.
- Touch targets should be at least 44px high.
- Recipe cards should be clickable but must not hide nested interactive elements from keyboard users.

---

## Implementation Strategy

### Do Not Rewrite Everything at Once

Keep backend, API calls, and AI extraction logic.

Create a frontend redesign branch.

Recommended phases:

### Phase 1: Foundation

Implement:

- CSS token system.
- Light/dark mode.
- New app shell.
- Desktop top nav.
- Mobile bottom nav.
- Shared buttons, inputs, chips, cards.
- Basic page layout helpers.

Acceptance criteria:

- Existing screens still route correctly.
- Desktop and mobile navigation work.
- Theme switching works.
- No backend/API changes required.

### Phase 2: Recipe Overview

Implement:

- New Recipes page layout.
- Unified search UI.
- Filter chips.
- New recipe grid.
- New recipe cards.
- `Needs review` status replacing `Draft`.

Acceptance criteria:

- Existing recipe data displays.
- Existing search behavior still works or is mapped into new search.
- Favorites still work.
- Status displays correctly.
- Mobile layout is clean and bottom-nav safe.

### Phase 3: Recipe Detail

Implement:

- Image-led recipe detail page.
- Metadata row.
- Primary Cook action.
- Secondary actions.
- Ingredients section.
- Instructions section.
- Nutrition & Health section.
- Source section.
- Edit entry point.

Acceptance criteria:

- Existing recipe data displays.
- Serving adjustment still works if already implemented.
- Detail screen works in light/dark.
- Mobile detail is usable and not just squeezed desktop.

### Phase 4: Add Recipe Flow

Implement:

- Add screen accessible from mobile center nav and desktop action.
- Photo/upload/URL/manual choices.
- Responsive order of add options.
- After AI extraction, recipe enters `Needs review`.

Acceptance criteria:

- Existing import flows still call the existing backend.
- Mobile photo-first flow works.
- Desktop upload/url-first flow works.
- Imported recipes clearly show review state.

### Phase 5: Editor

Implement:

- Replace wizard with section editor.
- Section statuses.
- Better image editing area.
- Ingredients editor.
- Instructions editor.
- Nutrition/health editor.
- Source editor.
- Tags chip input.
- Original OCR/AI comparison.

Acceptance criteria:

- Existing editing functionality still works.
- No native multi-select remains for tags.
- Imported recipes can be reviewed and marked as reviewed.
- Original OCR is accessible when available.
- Mobile editor does not become one giant overwhelming form.

### Phase 6: Sources

Implement:

- Source bookshelf/card overview.
- Source detail page.
- Recipes from source grid.

Acceptance criteria:

- Existing sources display.
- Cookbooks feel like a library/shelf.
- Recipes can be browsed by source.
- URLs remain recipe-level persisted references, not mandatory managed sources.

---

## Component Suggestions

Create or refactor toward these components:

```text
AppShell.vue
TopNavigation.vue
BottomNavigation.vue
PageHeader.vue
ThemeToggle.vue

BaseButton.vue
BaseInput.vue
BaseTextarea.vue
BaseSelect.vue
IconButton.vue
Chip.vue
StatusChip.vue

RecipeGrid.vue
RecipeCard.vue
RecipeMeta.vue
RecipeStatusBadge.vue

RecipeDetailHero.vue
RecipeActions.vue
IngredientsList.vue
InstructionsList.vue
NutritionSummary.vue
SourceSummary.vue

AddRecipeOptions.vue
ImportReview.vue

RecipeEditor.vue
EditorSection.vue
TagInput.vue
AiSuggestionChips.vue
OriginalTextPanel.vue

SourceGrid.vue
SourceCard.vue
SourceDetailHeader.vue
```

Do not create all components if the app structure does not need them. Use this as a direction.

---

## Naming and Copy Guidelines

Prefer warm but practical copy.

Replace:

```text
My Recipes
5 recipes in your collection
DRAFT
Search recipes by title...
Search ingredients (comma-separated)
```

With:

```text
Recipes
Search recipes, ingredients, tags...
Needs review
From books
Recently added
```

Avoid:

- Admin language.
- Technical implementation language.
- Publishing language.
- Too much explanatory text.

Use short helper text where needed.

Example for Needs Review:

```text
AI extracted this recipe. Review it before cooking.
```

---

## Specific UI Replacements

### Replace Floating Add Button

Current mobile/desktop floating plus button should be removed or deemphasized.

Use:

- Desktop: normal Add button in header.
- Mobile: center Add item in bottom nav.

### Replace Orange Accent

Remove orange as the main accent.

Use semantic accent token.

Default accent: violet/blue.

Orange can appear only if chosen as a future user-selectable accent.

### Replace Native Tag Multi-select

Use custom chip/tag input.

### Replace Step Wizard Editor

Use section editor.

### Replace Dashboard Nav

Remove dashboard from primary navigation.

Recipes are the home.

### Replace Draft Badge

Use Needs Review.

---

## Acceptance Criteria Summary

The redesign is successful when:

- The app feels like a personal cookbook, not a database admin.
- Food images dominate the experience.
- The UI does not compete with food photos.
- Mobile has bottom navigation.
- Add recipe is central and fast.
- Dark mode works across redesigned screens.
- Recipe cards are more emotional and less admin-like.
- Recipe detail has a clear Cook action.
- Editor no longer feels like Shopify/product admin.
- Tags are managed with chips, not native multi-select.
- AI/OCR review state is clearly represented as Needs Review.
- Sources feel like a cookbook shelf/library.
- Backend and AI extraction logic remain intact.

---

## Cursor Task Prompt

Use the following as the implementation instruction.

```text
You are redesigning an existing Vue recipe app with pure CSS.

Goal:
Transform the current admin-style recipe database UI into a calm, image-led personal cookbook UI.

Do not rewrite backend logic.
Do not change API contracts unless absolutely necessary.
Keep existing AI extraction/OCR logic.
Keep existing recipe/source/nutrition/prep/health data.
Focus on the frontend shell, layout, CSS, and user experience.

Implement the redesign in phases:
1. Design tokens, light/dark mode, app shell, desktop top nav, mobile bottom nav.
2. Recipe overview with image-led recipe cards, unified search UI, filter chips, and Needs Review state.
3. Recipe detail with hero image, metadata, Cook action, ingredients, instructions, nutrition, and source sections.
4. Add recipe flow with mobile-first photo capture and desktop upload/url/manual options.
5. Replace recipe editor wizard with section-based editor.
6. Replace native tag multi-select with chip/tag input.
7. Redesign sources as a bookshelf/card view.

Use semantic CSS variables for all colors and spacing.
Default light theme should use an off-white background, white surfaces, dark text, subtle borders, and a violet/blue accent.
Dark mode must be supported via data-theme tokens.
Do not use orange as the default accent.
Do not make the UI look like a food delivery app, SaaS dashboard, or generic admin panel.
Let recipe photos provide most of the visual color.

Mobile:
Use bottom navigation:
Recipes | Plan | Add | Shopping | More

Desktop:
Use top navigation:
Recipes | Plan | Shopping | Sources | More

Move Admin into More.
Do not keep Dashboard as a primary route unless it already has unavoidable dependencies.

Rename Draft UI state to Needs review.
Use Needs review for AI-extracted recipes that must be checked before cooking.

Do not overbuild meal planning or shopping list in this pass.
Keep placeholders or existing screens styled within the new shell.

Preserve existing functionality while replacing the UI gradually.
```

---

## Notes for Future Specs

Meal planning and shopping list need their own dedicated specs later.

Likely future direction:

- Plan is a weekly plan plus optional "cook soon" queue.
- Shopping list is generated from planned meals or selected recipes.
- Ingredients should eventually normalize across recipes.
- Cooking mode can later support timers and step-specific ingredients.
