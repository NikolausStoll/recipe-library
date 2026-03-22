# Claude Instructions for Recipe Library

## Project Overview

Recipe Library is a full-stack monorepo application for managing and importing recipes. It consists of:

- **Frontend**: Vue 3 + Vite + TypeScript + Vue Router
- **Backend**: Node.js + Express + better-sqlite3 (SQLite)
- **AI Integration**: OpenAI GPT-4o (vision API) for recipe extraction from images

The app supports manual recipe entry, book source management, and AI-powered recipe import from images using a two-step overlay workflow.

## Architecture

### Frontend (`frontend/`)
- **Framework**: Vue 3 with Composition API, TypeScript
- **Routing**: Vue Router with AppLayout wrapper
- **Views**: Dashboard, Recipes, Sources (Buchquellen), Shopping
- **Styling**: CSS custom properties for light/dark mode theming
- **Key Components**:
  - `RecipeForm.vue` - Main recipe entry/edit form
  - `RecipeFormMultiStep.vue` - Multi-step recipe create/edit (ingredients & steps: **plain-text summary** by default; click to expand editors; **+ Add** opens new rows in edit mode; ingredient OCR original line hidden for `import_method === 'url'`; categories from `constants/ingredientCategories.ts`)
  - `RecipeImportOverlay.vue` - Two-step AI import overlay (1: optional recipe image, 2: text images → OpenAI extraction)
  - `AppLayout.vue` - Main layout with header and navigation

### Backend (`backend/src/`)
- **Constants**: `constants/ingredientCategories.js` – canonical ingredient category keys + `sanitizeIngredientCategory()` (must match frontend `constants/ingredientCategories.ts`)
- **Server**: Express.js on port 8097
- **Database**: SQLite with better-sqlite3, schema in `db/index.js`
- **Routes**: Organized in `routes/` (recipes, sources, upload, health, admin)
- **Services**:
  - `extractRecipeService.js` - OpenAI vision integration with structured JSON schema extraction
  - `recipeUrlExtractService.js` - Fetch recipe HTML, extract raw fields from JSON-LD Recipe + HTML fallbacks (no LLM); deduplicates `image_urls` that look like the same asset at different resolutions (keeps largest) before persisting to `image_urls_json`
  - `recipeNormalizationService.js` - LLM normalization of scraped raw recipe (`normalizeRecipeWithLLM`); same JSON schema as vision extract; optional after `extract-from-url` when `normalize: true`
  - `recipeHealthScoreService.js` - `estimateRecipeHealthScore(recipe)` / `estimateRecipeHealthScoreById(id)` — practical 0–100 health estimate from **already structured** recipe JSON (separate step; not wired into OCR/URL extract)
  - `recipeTimeEstimateService.js` - `estimateRecipePrepCookTimes(recipe)` — separate chat completion (`gpt-4o-mini` default) for prep/cook minutes + confidence; applied via `recipeService.applyRecipeTimeEstimate`
  - `recipeTagGenerationService.js` - `generateRecipeTags(recipe)` — structured JSON-only tagging (`gpt-4o-mini` default); `recipeTagValidation.js` enforces controlled vocabulary + group rules; `recipeTagPersistence.js` stores rows in `recipe_tags`; not part of vision/URL extract (`usage_kind: recipe_tag`)
  - `recipeHealthScorePersistence.js` - upsert/read `recipe_health_scores` (estimate fields only); model/tokens for health calls go to `ai_token_usage` via `logAiTokenUsage`
  - `recipeService.js` - Recipe CRUD operations
  - `sourceService.js` - Book source management
  - `imageProcessingService.js` - Image resizing, format conversion (Sharp)
  - `cropPerspectiveService.js` - Optional 4-point perspective crop (Python + OpenCV)
  - `utils/pendingImageUpload.js` - Helpers for **deferred** recipe/source images: save raw bytes under `recipe/pending/` or `source/pending/` when `processImageLater` is set; finalize via existing `crop-perspective` routes (then Sharp WebP + thumbnail)

### Database Schema
Tables: `recipe_sources`, `recipes`, `recipe_ingredient_sections`, `ingredients`, `recipe_steps`, `recipe_tips`, `recipe_health_scores`, `recipe_tags`, `ai_token_usage`, `recipe_history`

Key features:
- Cascading deletes (ON DELETE CASCADE)
- Recipe status: `draft` | `confirmed`
- Recipe favorites: `favorite` flag (0/1)
- Recipe "would cook again": `would_cook_again` flag (`yes` | `maybe` | `no`)
- Extract status: `pending` | `done` | `failed`
- Import method: `manual` | `url` | `image`
- Source types: `book` | `url` | `manual` | `other`
- **Image processing**: `recipes.image_processing_pending` and `recipe_sources.image_processing_pending` (0/1). When `1`, `image_path` points at a raw file in `uploads/*/pending/` until `POST .../crop-perspective` produces WebP + `_thumb.webp` and clears the flag.

## Development Workflow

### Local Development
```bash
npm run install:all  # Install all dependencies
npm run dev          # Start both frontend and backend
npm run dev:frontend # Frontend only (Vite dev server)
npm run dev:backend  # Backend only (Express on :8097)
```

### Docker
```bash
./run-local.sh  # Builds and runs Docker container
```
Requires `.env` file (see `.env.example`). App runs on http://localhost:8097

### Environment Variables
Located in project root `.env`:
- `DB_PATH` - SQLite database path (default: `recipe-library.db`)
- `UPLOAD_DIR` - Upload directory path
- `IMAGE_QUALITY` - WebP quality (default: 80)
- `IMAGE_MAX_DIMENSION` - Max dimension for uploaded images (default: 2400)
- `TEXT_IMAGE_MAX_DIMENSION` - Max dimension for OpenAI text images (default: 1400)
- `RECIPE_URL_FETCH_TIMEOUT_MS`, `RECIPE_URL_MAX_BYTES`, `RECIPE_URL_USER_AGENT` - Optional tuning for `POST /api/recipes/extract-from-url`
- `OPENAI_NORMALIZE_MODEL_PRIMARY`, `OPENAI_NORMALIZE_TEMPERATURE` - Optional URL normalization (`extract-from-url` + `normalize: true`)
- `OPENAI_API_KEY` - **Required** for recipe extraction
- `OPENAI_EXTRACT_MODEL` - Model for extraction (default: `gpt-4.1-mini`)
- `OPENAI_EXTRACT_DETAIL` - Vision detail level (default: `high`)
- `OPENAI_NUTRITION_MODEL`, `OPENAI_NUTRITION_MODEL_TEMPERATURE` - Optional nutrition estimation (`POST .../estimate-nutrition`; defaults: `gpt-4o-mini`, `0.2`, temperature clamped 0–0.3)
- `CROP_PYTHON` - Optional Python path for perspective crop (requires opencv-python + numpy)

**Note**: `.env` files are protected and cannot be read by Claude for security.

### Python Setup (Optional)
For 4-point perspective crop feature:
```bash
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
```

## API Endpoints

### Recipes
- `GET /api/recipes` - List all recipes (no ingredients/steps)
- `GET /api/recipes/:id` - Get one recipe with full details
- `POST /api/recipes` - Create recipe (stored as draft)
- `PUT /api/recipes/:id` - Update recipe (can change status to confirmed)
- `DELETE /api/recipes/:id` - Delete recipe (cascades)
- `POST /api/recipes/:id/favorite` - Body `{ favorite: boolean }`; toggles the `favorite` flag
- `GET /api/recipes/with-ingredients?favorite=1` - Same as `with-ingredients`, optionally filtered to favorites only
- `PUT /api/recipes/:id` - Can update `would_cook_again` with values `yes` | `maybe` | `no`
- `POST /api/recipes/extract-from-url` - Body `{ url, normalize? }`; returns raw `{ source, warnings, fetched_url, recipe }`; if `normalize: true`, adds `structured`, `normalize_model`, `normalize_usage` (OpenAI, `OPENAI_NORMALIZE_MODEL_PRIMARY`)
- `POST /api/recipes/import-from-url` - Body `{ url }`; draft recipe + scrape + `normalizeRecipeWithLLM`; logs each OpenAI call to `ai_token_usage` with `model` and `usage_kind: url_recipe_normalize`
- `POST /api/recipes/:id/estimate-health-score` - Practical health score + summary + tips from structured recipe; **persists** only successful estimates to `recipe_health_scores` and logs model/tokens to `ai_token_usage` (`usage_kind: health_score`); failures return **502**/**503** with `{ error }` (no DB row)
- `POST /api/recipes/estimate-health-score` - Body `{ recipe }`; same scoring without loading from DB
- `POST /api/recipes/:id/estimate-times` - First call runs LLM and applies non-original times; response `pendingOriginalReplace` lists originals still to confirm; follow-up with `use_client_estimate: true` + `estimate` + `replace_*` applies without a second LLM; logs `usage_kind: recipe_time_estimate` on LLM calls only
- `GET /api/recipes/tag-options` - Controlled tag vocabulary (`constants/recipeTags.js`)
- `POST /api/recipes/:id/generate-tags` - LLM assigns tags from structured recipe only; persists `recipe_tags`; `usage_kind: recipe_tag`; optional `OPENAI_RECIPE_TAG_MODEL`

### Image Import (Two-step process)
1. `POST /api/upload` - Upload recipe image (optional), creates draft recipe with `image_path`
2. `POST /api/recipes/:id/extract-from-images` - Extract recipe text from images via OpenAI

### Admin
- `GET /api/admin/extract-usage` - List `ai_token_usage` with recipe title join and per-row cost estimate (see `extractUsagePricing.js`)

### Sources
- `GET /api/sources` - List all sources
- `GET /api/sources/:id` - Get one source
- `POST /api/sources` - Create source
- `PUT /api/sources/:id` - Update source
- `DELETE /api/sources/:id` - Delete source (fails if recipes reference it)
- `POST /api/sources/:id/cover` - Upload book cover (supports 4-point crop)

### Static Files
- `GET /uploads/*` - Serve uploaded images

### Recipe ingredient persistence
- `PUT /api/recipes/:id` **replaces** all `recipe_ingredient_sections` and `ingredients` (delete then insert). Section and ingredient primary keys are always new after save; this keeps the handler simple and matches “full replace” semantics.
- Grouping for insert uses `groupIngredientsForSections()` in `recipeService.js`: **list order**, not a Map keyed only by heading. If the client sends `section_id` on each line (from `GET`), consecutive rows with the same `section_id` become one section; lines without `section_id` stay with the previous section. If no `section_id` is sent, a new section starts when `section_heading` changes between consecutive rows.
- `setRecipeParsedRecipe()` must use `insertSection.run(...).lastInsertRowid` (or equivalent) per section so ingredients attach to the correct section row.

## AI Recipe Extraction

The recipe extraction uses OpenAI's vision API with a strict JSON schema (`RECIPE_JSON_SCHEMA` in `extractRecipeService.js`).

### Extraction Schema
- **Root**: status, confidence, warnings, missingFields, recipe
- **Recipe**: title, subtitle, introText, language, servings, prepTimeMinutes, cookTimeMinutes (visible on image only; else null), ingredientsSections, steps, tips, nutritionTotal
- **Ingredients**: Organized in sections with heading, each item has originalText, amount, amountMax, unit, ingredient, additionalInfo, **category** (LLM / URL normalization)
- **Steps**: Array of {index, text}
- **Nutrition**: Estimated from ingredients (not extracted from image)

### Token Usage Tracking
All OpenAI API calls log token usage to the `ai_token_usage` table for cost monitoring (`model`, `usage_kind`: `recipe_image_extract` | `url_recipe_normalize` | `health_score` | `recipe_time_estimate` | `recipe_tag`, …, `response_json`, and `request_json` when the model input is JSON: URL normalization stores the scraped raw recipe payload; `health_score` stores `buildHealthScorePayload(recipe)`; `recipe_time_estimate` stores `buildTimeEstimateInput(recipe)`; `recipe_tag` stores the compact tagging payload).

## Code Style Guidelines

### General
- Use English for all code, comments, and documentation
- Prefer clarity over cleverness
- Keep functions small and focused
- Use descriptive variable names

### Frontend (Vue 3 + TypeScript)
- Use Composition API with `<script setup>` syntax
- Use TypeScript for all new files
- CSS custom properties for theming
- Keep component props typed
- Use async/await for API calls

### Backend (Node.js + Express)
- ES modules (`import`/`export`)
- Use `async`/`await` over promises
- Validate input at route handlers
- Use services for business logic
- Keep routes thin, logic in services

### Database
- Use prepared statements (better-sqlite3)
- Always enable foreign keys (`PRAGMA foreign_keys = ON`)
- Use transactions for multi-step operations
- Index foreign keys

## Common Tasks

### Adding a New Recipe Field
1. Update database schema in `backend/src/db/index.js` (`initDb()` — single `CREATE TABLE IF NOT EXISTS` block; extend when adding columns)
2. Update `RECIPE_JSON_SCHEMA` in `extractRecipeService.js` if extracted from AI
3. Update frontend `RecipeForm.vue` component
4. Update API route handlers in `backend/src/routes/recipes.js`
5. Update service layer in `backend/src/services/recipeService.js`

### Adding a New Route
1. Create route file in `backend/src/routes/`
2. Register in `backend/src/routes/index.js`
3. Create corresponding service in `backend/src/services/`
4. Add frontend API function in `frontend/src/api/`
5. Update documentation in `README.md` and this file

### Modifying OpenAI Extraction
1. Update `EXTRACT_PROMPT` and/or `RECIPE_JSON_SCHEMA` in `extractRecipeService.js`
2. Test with various recipe images
3. Check `ai_token_usage` table for token usage changes

## Testing

Currently manual testing. When adding tests:
- Use a test database (`:memory:` or separate file)
- Mock OpenAI API calls
- Test edge cases (missing fields, malformed input)
- Test cascade deletes

## Deployment

### Docker Production Build
```bash
docker build -t recipe-library .
docker run -p 8097:8097 --env-file .env -v $(pwd)/data:/data recipe-library
```

### Environment Requirements
- Node.js 20+
- Python 3 (optional, for perspective crop)
- OpenAI API key

## Troubleshooting

### OpenAI API Issues
- Check `OPENAI_API_KEY` is set correctly
- Review `ai_token_usage` table for error responses
- Verify image sizes don't exceed OpenAI limits
- Check model availability and pricing

### Prep / cook time estimate returns HTTP 409
- Current code returns **200** with `pendingOriginalReplace` (no 409 in repo). **409** usually means a **stale backend process** (restart Node or rebuild Docker).
- Frontend `estimateRecipeTimes` may recover legacy **409** responses that include an `estimate` in the JSON body by loading the recipe and showing the same confirm flow.

### Database Issues
- Ensure `DB_PATH` directory exists
- Check foreign keys are enabled
- Review `initDb()` in `db/index.js` after schema changes
- Backup database before schema changes

### Image Upload Issues
- Check `UPLOAD_DIR` permissions
- Verify Sharp can process the image format
- Check `IMAGE_MAX_DIMENSION` settings
- For perspective crop: ensure Python venv is set up
- List/detail APIs derive `image_thumb_path` via `uploadPaths.getThumbnailPathIfExists`; `resolveUploadedFilePath` maps `/uploads/...` URLs to files under `UPLOAD_DIR` (must strip the `uploads/` segment so paths are not doubled)

## Documentation Maintenance

When making changes, update:
- `README.md` - User-facing documentation, API reference, setup instructions
- `AGENTS.md` - High-level project rules and standards
- `CLAUDE.md` (this file) - Detailed technical context for AI assistants
- `SDD.md` - Architectural and design decisions (components, data models, merging user stories)

Keep all three files in sync with code changes.
