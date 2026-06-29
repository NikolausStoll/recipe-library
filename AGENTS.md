# Agent Instructions for Recipe Library

## Project overview

Recipe Library is a personal recipe-management monorepo. It covers:

- A curated library view (list, detail, favorites, “would cook again”, cooking mode) plus **shopping list** (`/shopping`, `localStorage`, print) and **meal plan** (`/plan`, 7-day rolling window, suggestions, `localStorage`; spec in `sdd/plan-tool-spec.md`).
- Manual editing via the multi-step `RecipeFormMultiStep` system that keeps ingredients, steps, tips, nutrition, tags, and source info in sync.
- Website import and AI-powered image/photo import with enrichment, normalization, cup conversion, tagging, and optional estimates (health/time).
- Source tracking for cookbooks and URLs, including cover upload/crop and image-processing queues.
- Admin tooling (AI token usage) and support for a responsive PWA shell with native-like navigation.

## Tech stack

### Frontend
- Vue 3 + Composition API with `<script setup>`, TypeScript, and Vite.
- Vue Router for `/recipes`, `/add`, `/sources`, `/more`, `/plan`, `/shopping`, `/admin`, and import flows.
- CSS custom properties for semantic theming, `data-theme` toggles, and breakpoints defined in `src/styles/*.css`.
- App shell (`AppShell.vue`) that renders a desktop top nav and a fixed mobile bottom nav; includes `TagInput`, `RecipeImportOverlayUnified`, `SourceCoverPicker`, and other reusable controls.
- PWA metadata in `frontend/public/manifest.webmanifest` and a service worker (`public/sw.js`) registered in `src/main.ts`.

### Backend
- Node 20+, Express, and better-sqlite3 for synchronous SQLite access.
- `Multer` + `Sharp` for uploads/resizing and optional Python/OpenCV (via `cropPerspectiveService.js`) for perspective crops.
- OpenAI SDK integration (`extractRecipeService.js`, `recipeTagGenerationService.js`, `recipeTimeEstimateService.js`, `recipeHealthScoreService.js`).
- API routes live under `backend/src/routes` (recipes, upload, sources, admin, health) and rely on a thin service layer under `backend/src/services`.
- Environment loading happens in `backend/src/server.js` plus `load-env.js`; static assets served when `STATIC_DIR` is set.

### Database & AI data
- Schema lives in `backend/src/db/index.js`. Key tables: `recipes`, `recipe_ingredient_sections`, `ingredients`, `recipe_steps`, `recipe_tips`, `recipe_health_scores`, `recipe_tags`, `ai_token_usage`, `recipe_history`, `recipe_sources`, `recipe_source_covers` (via `sourceService`).
- AI token usage is tracked in `ai_token_usage` (`logAiTokenUsage`) for every normalization, tag, time, health, or cup conversion call.
- Cup-conversion (`cupConversionService.js`) and tagging (`recipeTagGenerationService.js`) are part of `recipeImportPipelineService.js`.

## Directory map

- `frontend/src/views`: main pages (RecipesView, RecipeEditPage, AddRecipeView, ShoppingView, PlanView, SourcesView, AdminExtractUsageView, import variants).
- `frontend/src/components`: reusable controls (RecipeFormMultiStep, SourceCoverPicker, TagInput, AppShell, import overlays, icons).
- `frontend/src/api`: keeps typed calls (`api/recipes.ts`) that mirror backend endpoints; use these functions where possible.
- `backend/src/routes`: register `/api/recipes`, `/api/upload`, `/api/sources`, `/api/admin`, `/api/health`.
- `backend/src/services`: business logic (recipes, sources, image processing, AI helpers, pending-upload utilities).
- `backend/src/db`: schema initialization (`initDb()`), migrations, and index definitions.
- `backend/scripts`: helper scripts such as `evaluate-vision-quality.js` and Python requirements for crops.
- `data/`: default `recipe-library.db`, `uploads/` for processed media, and `pending/` storage.
- `recipe-library/`, `docs/`, and `sdd/`: Home Assistant meta and design docs; update `SDD.md` and `README.md` when workflows change.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run install:all` | Install dependencies for root + both workspaces. |
| `npm run dev` | Start backend (`:8097`), wait for it, then start the Vite frontend. |
| `npm run dev:frontend` | Run only the Vite dev server. |
| `npm run dev:backend` | Run only the backend (`node backend/src/server.js`). |
| `npm run build` | Build the frontend bundle. |
| `npm run start` | Run the production backend server (expects built frontend + env). |
| `npm --prefix backend run test` | Run backend test suite (`node --test tests/**/*.test.js`). |
| `npm --prefix backend run evaluate-vision` | Run the backend vision-evaluation helper. |
| `npm --prefix frontend run preview` | Serve the built frontend for manual verification. |

## Working rules for agents

- Read `AGENTS.md` before you touch code; this is the canonical guidance for AI collaborators.
- Prefer small, targeted changes. Large refactors or schema edits must be explicitly requested.
- Reuse existing UI patterns (`RecipeFormMultiStep`, chips, AppShell nav, spacing). Keep `<script setup>` + Composition API + TypeScript everywhere in the frontend.
- Validate inputs at the route/service boundary and use prepared statements in backend services.
- Keep `README.md`, `AGENTS.md`, `CLAUDE.md`, and `SDD.md` synchronized whenever you change functionality, workflows, or infrastructure.
- Don’t add new dependencies unless necessary and documented with a clear justification.
- Consider mobile, tablet, desktop, light/dark modes, and the PWA install experience when adjusting UI/layout.
- Leave `.env` secrets out of the repo; mention only the needed keys in docs.
- Avoid touching LLM prompts, JSON schema, or pipeline wiring unless a task explicitly asks for it.

## Import & AI pipeline

- **Image import** (`POST /api/upload` → `recipes/:id/extract-from-images`): uploads are optional, optionally marked with `processImageLater` to keep raw bytes in `data/uploads/{recipe,source}/pending/`. The pipeline crops (Sharp + optional Python), resizes to WebP, writes thumbnails, creates a draft recipe, runs `extractRecipeFromImages` (OpenAI vision via `extractRecipeService.js`), and logs tokens.
- **URL import/extract** (`/api/recipes/extract-from-url` and `/api/recipes/import-from-url`): `recipeUrlExtractService` scrapes JSON-LD + recipe-card HTML (`recipeHtmlEnrichment.js`), deduplicates images, optionally runs `normalizeRecipeWithLLM` (`recipeNormalizationService.js`), and returns structured data for review. `recipeImportPipelineService.finalizeImportedRecipe` applies imperial unit conversion (`imperialUnitConversionService.js`), cup conversion (`cupConversionService.js`), writes `parsed_recipe`, and waits on tag generation (`generateRecipeTags`).
- **Tags/estimates**: tagging runs after `finalizeImportedRecipe`, health/time estimates are separate endpoints (`recipeHealthScoreService`, `recipeTimeEstimateService`, `recipeService.applyRecipeTimeEstimate`) and log usage to `ai_token_usage` via `logAiTokenUsage`.
- **Persistence**: `recipeService.setRecipeParsedRecipe` populates recipe rows + ingredient/step/tip tables from the structured envelope. `PUT /api/recipes/:id` replaces ingredient sections (new IDs) and relies on `groupIngredientsForSections()` for ordering/grouping.

## UI conventions

- Desktop: App shell has top nav (Recipes, Plan, Add, Shopping, Sources, More). Mobile shows a fixed bottom nav with the same entries plus a prominent Add button.
- `RecipesView` renders the list overview, search, filter chips, and a grid at `>=1100px`. Clicking a card opens the overlay-style detail which shares state with the cooking mode (stepper + ingredients panel, optional original text toggle).
- Detail view exposes a “More” menu (open original URL, run estimates, edit, delete). Drafts show the “Prüfen / Needs review” badge.
- Editing happens on `/recipes/:id/edit` via `RecipeEditPage.vue`, which hosts `RecipeFormMultiStep.vue`. The form toggles between summary & edit modes, auto-assigns ingredient categories from `frontend/src/constants/ingredientCategories.ts`, and hides OCR originals for URL imports.
- Import flows live under `ImportView`, `AddRecipeImageImportView`, and `AddRecipeUrlImportView`. `RecipeImportOverlayUnified` coordinates selecting images + cover.
- `SourceCoverPicker.vue` manages rotate/crop/remove controls for book covers, reusing `CropPerspectiveModal.vue`.
- `TagInput.vue` handles controlled vocab tags; frontend fetches `GET /api/recipes/tag-options`.
- Admin view `AdminExtractUsageView.vue` mirrors `/api/admin/extract-usage`.
- Keep UI tokens/dimensions in `styles/*.css` and avoid mixing new global styles unless necessary. Preserve the violet accent, Work Sans typography, and `data-theme` approach.

## Data & persistence details

- Tables:
  - `recipes`: main metadata + `parsed_recipe`, `image_processing_pending`, `image_urls_json`.
  - `recipe_ingredient_sections` + `ingredients`: sections and ingredient rows (positioned, optionally grouped via `section_id`).
  - `recipe_steps`, `recipe_tips`, `recipe_tags`, `recipe_health_scores`, `ai_token_usage`, `recipe_history`.
  - `recipe_sources`: books/websites; `recipes.source_id` references this table and `recipes.original_url` keeps the per-page link.
- `PUT /api/recipes/:id` deletes and reinserts sections + ingredients; include `section_id` on each line to keep sections intact when editing.
- `processImageLater` + `image_processing_pending`: recipes/sources can defer WebP processing. The `pendingImageUpload` utils store raw uploads, and `POST /api/recipes/:id/crop-perspective` or `/api/sources/:id/crop-perspective` finalize the WebP + thumbnail.
- Recipe history (`recipe_history`) stores cook dates; `POST /api/recipes/:id/cook` adds entries and the UI surfaces them on detail/cooking mode.

## Testing & verification

- Use the provided scripts (`npm run dev`, `npm run build`, backend `npm --prefix backend run test`, `npm --prefix backend run evaluate-vision`, frontend `npm --prefix frontend run preview`) to verify functionality.
- After UI/import changes, manually exercise: list/detail views, cooking mode, recipe edit, image import, URL import, tag generation, estimate endpoints, and sources/covers.
- For AI features, ensure `OPENAI_API_KEY` is set locally and inspect `ai_token_usage` if debugging (token logging is always on).
- Verify PWA behavior by building + running the preview/production server (`npm run build` + `npm run start`).

## Safety & quality

- Never commit secrets (API keys, `.env`, etc.). Mention only required env keys and keep `.env` entries local.
- Preserve error handling and warnings when upstream services fail; the backend logs meaningful messages before returning 4xx/5xx responses.
- Keep `app-shell` accessibility (aria labels, keyboard focus) intact when modifying navigation or buttons.
- Coordinate with `SDD.md` when you change major workflows or data models, and mention doc updates in your PR description.

