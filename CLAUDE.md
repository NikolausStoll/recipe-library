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
  - `RecipeFormMultiStep.vue` - Multi-step recipe create/edit (ingredients include optional **category**, select-only from `constants/ingredientCategories.ts`; German labels, canonical English keys persisted)
  - `RecipeImportOverlay.vue` - Two-step AI import overlay (1: optional recipe image, 2: text images → OpenAI extraction)
  - `AppLayout.vue` - Main layout with header and navigation

### Backend (`backend/src/`)
- **Constants**: `constants/ingredientCategories.js` – canonical ingredient category keys + `sanitizeIngredientCategory()` (must match frontend `constants/ingredientCategories.ts`)
- **Server**: Express.js on port 8097
- **Database**: SQLite with better-sqlite3, schema in `db/index.js`
- **Routes**: Organized in `routes/` (recipes, sources, upload, health, admin)
- **Services**:
  - `extractRecipeService.js` - OpenAI vision integration with structured JSON schema extraction
  - `recipeUrlExtractService.js` - Fetch recipe HTML, extract raw fields from JSON-LD Recipe + HTML fallbacks (no LLM)
  - `recipeNormalizationService.js` - LLM normalization of scraped raw recipe (`normalizeRecipeWithLLM`, `isLowQuality`); same JSON schema as vision extract; optional after `extract-from-url` when `normalize: true`
  - `recipeService.js` - Recipe CRUD operations
  - `sourceService.js` - Book source management
  - `imageProcessingService.js` - Image resizing, format conversion (Sharp)
  - `cropPerspectiveService.js` - Optional 4-point perspective crop (Python + OpenCV)

### Database Schema
Tables: `recipe_sources`, `recipes`, `recipe_ingredient_sections`, `ingredients`, `recipe_steps`, `recipe_tips`, `extract_usage`

Key features:
- Cascading deletes (ON DELETE CASCADE)
- Recipe status: `draft` | `confirmed`
- Recipe favorites: `favorite` flag (0/1)
- Recipe "would cook again": `would_cook_again` flag (`yes` | `maybe` | `no`)
- Extract status: `pending` | `done` | `failed`
- Import method: `manual` | `url` | `image`
- Source types: `book` | `url` | `manual` | `other`

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
- `OPENAI_NORMALIZE_MODEL_PRIMARY`, `OPENAI_NORMALIZE_MODEL_FALLBACK`, `OPENAI_NORMALIZE_TEMPERATURE` - Optional URL normalization (`extract-from-url` + `normalize: true`)
- `OPENAI_API_KEY` - **Required** for recipe extraction
- `OPENAI_EXTRACT_MODEL` - Model for extraction (default: `gpt-4.1-mini`)
- `OPENAI_EXTRACT_DETAIL` - Vision detail level (default: `high`)
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
- `POST /api/recipes/extract-from-url` - Body `{ url, normalize? }`; returns raw `{ source, warnings, fetched_url, recipe }`; if `normalize: true`, adds `structured`, `normalize_model`, `normalize_usage` (OpenAI, primary `gpt-4o-mini` / fallback `gpt-4.1-mini` on low-quality heuristics)
- `POST /api/recipes/import-from-url` - Body `{ url }`; draft recipe + scrape + `normalizeRecipeWithLLM`; logs each OpenAI call to `extract_usage` with `model` and `extract_kind: url_normalize`

### Image Import (Two-step process)
1. `POST /api/upload` - Upload recipe image (optional), creates draft recipe with `image_path`
2. `POST /api/recipes/:id/extract-from-images` - Extract recipe text from images via OpenAI

### Admin
- `GET /api/admin/extract-usage` - List `extract_usage` with recipe title join and per-row cost estimate (see `extractUsagePricing.js`)

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
- **Recipe**: title, subtitle, introText, language, servings, ingredientsSections, steps, tips, nutritionTotal
- **Ingredients**: Organized in sections with heading, each item has originalText, amount, amountMax, unit, ingredient, additionalInfo, **category** (LLM / URL normalization)
- **Steps**: Array of {index, text}
- **Nutrition**: Estimated from ingredients (not extracted from image)

### Token Usage Tracking
All OpenAI API calls log token usage to the `extract_usage` table for cost monitoring (`model`, `extract_kind`: `vision` | `url_normalize`, `response_json`, and `request_json` when the model input is JSON—URL normalization stores the scraped raw recipe payload).

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
1. Update database schema in `backend/src/db/index.js` (add column with migration)
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
3. Check `extract_usage` table for token usage changes

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
- Review `extract_usage` table for error responses
- Verify image sizes don't exceed OpenAI limits
- Check model availability and pricing

### Database Issues
- Ensure `DB_PATH` directory exists
- Check foreign keys are enabled
- Review migration logic in `initDb()`
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
