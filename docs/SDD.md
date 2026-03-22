# Software Design Document

## 1. Purpose & Scope

### Brief Description
Recipe Library is a full-stack web application for managing and digitizing recipes. The system enables users to:
- Manually enter recipes with structured data (ingredients, steps, tips, nutrition)
- Import recipes from images using AI-powered text extraction (OpenAI gpt-4.1-mini vision API)
- Scrape raw recipe fields from public recipe URLs (JSON-LD / HTML heuristics, no LLM in this step)
- Manage cookbook sources with metadata and cover images
- Organize recipes by source, status (draft/confirmed), and servings
- View and scale recipes with automatic ingredient amount calculation

### Target Audience
- Home cooks who want to digitize their recipe collections
- Users with physical cookbooks looking to create a searchable digital library
- Anyone who wants to extract and organize recipes from photos

### Boundaries
**In Scope:**
- Recipe CRUD operations (manual entry and AI import)
- Image upload and processing (resize, crop, format conversion)
- OpenAI vision API integration for text extraction
- SQLite database for local data storage
- Book source management (cookbook metadata)
- Recipe status tracking (draft/confirmed)
- Token usage tracking for cost monitoring

**Out of Scope:**
- User authentication and multi-user support
- Recipe sharing or social features
- Meal planning or calendar integration
- Grocery list generation
- Recipe rating or commenting system
- Nutritional analysis beyond basic storage
- Mobile native apps (web-only)

## 2. Architectural Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Browser                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Vue 3 Frontend (Port 5173 dev)              │   │
│  │  - Vue Router (SPA routing)                         │   │
│  │  - TypeScript components                            │   │
│  │  - CSS custom properties (theming)                  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/REST
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Express Backend (Port 8097)                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Routes Layer (API endpoints)                        │   │
│  │  - /api/recipes                                      │   │
│  │  - /api/sources                                      │   │
│  │  - /api/upload                                       │   │
│  │  - /api/health                                       │   │
│  │  - /api/admin                                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Service Layer (Business Logic)                      │   │
│  │  - recipeService.js                                  │   │
│  │  - sourceService.js                                  │   │
│  │  - extractRecipeService.js                           │   │
│  │  - recipeUrlExtractService.js (URL → raw fields)       │   │
│  │  - imageProcessingService.js                         │   │
│  │  - cropPerspectiveService.js                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Database Layer (SQLite + better-sqlite3)            │   │
│  │  - recipe-library.db                                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS API calls
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              External Services                               │
│  - OpenAI Vision API (gpt-4.1-mini)                  │
│  - Python/OpenCV (optional, for perspective crop)          │
└─────────────────────────────────────────────────────────────┘
```

### Frontend (Vue 3)
- **Framework**: Vue 3 with Composition API and `<script setup>` syntax
- **Build Tool**: Vite for fast development and optimized production builds
- **Routing**: Vue Router with AppLayout wrapper for consistent navigation
- **Views**:
  - `DashboardView.vue` - Statistics and quick actions
  - `RecipesView.vue` - Recipe list, detail view, and edit overlay
  - `SourcesView.vue` - Book source management
  - `ShoppingView.vue` - Placeholder for future features
- **Key Components**:
  - `RecipeFormMultiStep.vue` - 4-step recipe form (Basics, Ingredients, Instructions, Review)
  - `RecipeImportOverlay.vue` - AI import workflow with camera/file upload and crop
  - `AppLayout.vue` - Header with navigation and branding
- **Styling**: CSS custom properties for light/dark theme support, modern card-based layouts

### Backend (Express + Node.js)
- **Server**: Express.js web framework on port 8097
- **Database**: SQLite with better-sqlite3 (synchronous, high-performance)
- **Routes**: RESTful API organized by resource type
  - `recipes.js` - Recipe CRUD and AI extraction
  - `sources.js` - Source management
  - `upload.js` - Image upload for recipe images
  - `health.js` - Health check endpoint
- **Middleware**:
  - `multer` for file uploads (memory storage)
  - `express.static` for serving uploaded images
  - CORS enabled for development

### Database (SQLite)
- **Tables**: 7 core tables with foreign key relationships
- **Schema Features**:
  - `ON DELETE CASCADE` for referential integrity
  - Check constraints for enum values (status, type, etc.)
  - Automatic timestamps (`created_at`, `updated_at`)
  - JSON fields for structured data (warnings, missing_fields)

### External Services
- **OpenAI Vision API**: gpt-4.1-mini GPT for recipe text extraction
  - Structured JSON schema with strict validation
  - Token usage tracking for cost monitoring
  - Configurable detail level (low/high/auto)
- **Python + OpenCV** (Optional): 4-point perspective crop for cookbook photos
  - Subprocess execution from Node.js
  - Coordinate transformation from display to natural image dimensions

### Data Flow: Typical AI Import Request

```
1. User uploads recipe photo (optional)
   └─> POST /api/upload
       └─> multer.single('image')
       └─> Sharp resize/convert to WebP
       └─> Save to /uploads/
       └─> Create draft recipe in DB
       └─> Return recipe ID

2. User uploads text image(s) for extraction
   └─> POST /api/recipes/:id/extract-from-images
       └─> multer.array('images', 10)
       └─> Optional: 4-point perspective crop per image
       │   └─> Python script via subprocess
       └─> Sharp resize to TEXT_IMAGE_MAX_DIMENSION
       └─> OpenAI vision API call with JSON schema
       │   └─> Extract: title, ingredients, steps, tips
       └─> Parse and validate JSON response
       └─> Save to normalized DB tables
       │   └─> recipe_ingredient_sections
       │   └─> ingredients (with original_text)
       │   └─> recipe_steps
       │   └─> recipe_tips
       └─> Log token usage to ai_token_usage table
       └─> Return updated recipe with confidence score

3. User views/edits recipe
   └─> GET /api/recipes/:id
       └─> Join queries for ingredients, steps, tips
       └─> Build parsed_recipe from normalized data
       └─> Return full recipe object

4. User saves changes
   └─> PUT /api/recipes/:id
       └─> Replace ingredients/steps arrays
       └─> Update recipe fields
       └─> Return updated recipe
```

## 3. Components

### Frontend Components

| Component | Responsibility | Key Features |
|-----------|---------------|--------------|
| `RecipesView.vue` | Recipe list, detail view, edit overlay | Card grid, search/sort, servings adjustment, ingredient scaling |
| `RecipeFormMultiStep.vue` | 4-step recipe form | Progress indicator, image upload, ingredients, steps, review |
| `RecipeImportOverlay.vue` | AI import workflow | Camera/file upload, 4-point crop UI, OpenAI extraction |
| `RecipeUrlImportOverlay.vue` | URL import | Paste URL, `POST /import-from-url`, opens same edit flow as image import |
| `AdminExtractUsageView.vue` | Token / cost admin | Table of `ai_token_usage`, JSON expand, sums |
| `SourcesView.vue` | Book source management | CRUD operations, cover upload with crop |
| `DashboardView.vue` | Statistics and quick actions | Recipe counts, recent recipes, quick links |
| `AppLayout.vue` | Main layout with navigation | Sticky header, route links, responsive design |

### Backend Components

| Component | Responsibility | Inputs/Interfaces | Key Dependencies |
|-----------|---------------|-------------------|------------------|
| **Routes Layer** |
| `recipes.js` | Recipe API endpoints | GET/POST/PUT/DELETE /api/recipes, POST /extract-from-url, /import-from-url | recipeService, extractRecipeService, recipeUrlExtractService, recipeNormalizationService |
| `sources.js` | Source API endpoints | GET/POST/PUT/DELETE /api/sources | sourceService |
| `upload.js` | Recipe image upload | POST /api/upload | recipeService, Sharp |
| `health.js` | Health check | GET /api/health | Database connection |
| `admin.js` | Admin API | GET /admin/extract-usage | extractUsageAdminService |
| **Service Layer** |
| `extractUsageAdminService.js` | ai_token_usage listing | Join recipes for title | better-sqlite3, extractUsagePricing |
| `recipeService.js` | Recipe CRUD operations | createRecipe, updateRecipe, getRecipeById, listRecipes | Database (better-sqlite3) |
| `sourceService.js` | Source CRUD operations | createSource, updateSource, getSourceById, listSources | Database |
| `extractRecipeService.js` | OpenAI vision integration | extractRecipeFromImages, logAiTokenUsage | OpenAI SDK, Database |
| `recipeUrlExtractService.js` | URL → raw recipe fields | extractRecipeFromUrl (JSON-LD + HTML) | fetch, cheerio |
| `recipeNormalizationService.js` | Raw URL recipe → structured JSON | normalizeRecipeWithLLM, isLowQuality | OpenAI SDK, RECIPE_JSON_SCHEMA |
| `imageProcessingService.js` | Image resize/convert | prepareTextImage, resizeImage | Sharp |
| `cropPerspectiveService.js` | 4-point perspective crop | cropPerspective, cropPerspectiveBuffer | Python subprocess, OpenCV |
| **Database Layer** |
| `db/index.js` | Database initialization | getDb, initDb | better-sqlite3 |
| **Utils** |
| `extractUsagePricing.js` | Token cost estimate | gpt-4o-mini / gpt-4.1-mini USD per 1M tokens | — |

## 4. Data Model (Core Entities)

### Entity: `recipe_sources`
**Description**: Cookbook or URL sources for recipes

**Key Fields**:
- `id` (PK) - Auto-increment ID
- `type` - Enum: 'book' | 'url' | 'manual' | 'other'
- `name` - Source display name (e.g., "The Joy of Cooking")
- `book_title`, `author`, `year` - Book metadata
- `image_path` - Cover image URL
- `created_at` - Timestamp

**Relationships**:
- 1:N to `recipes` (one source can have many recipes)

### Entity: `recipes`
**Description**: Main recipe entity with metadata and status

**Key Fields**:
- `id` (PK) - Auto-increment ID
- `source_id` (FK) - References recipe_sources.id
- `source_page` - Page number in cookbook
- `import_method` - Enum: 'manual' | 'url' | 'image'
- `favorite` - Boolean flag (0/1) for marking a recipe as favorite
- `would_cook_again` - User rating for "would you cook this again?" (`yes` | `maybe` | `no`)
- `extract_status` - Enum: 'pending' | 'done' | 'failed' (nullable)
- `extract_confidence` - AI extraction confidence score (0-1)
- `status` - Enum: 'draft' | 'confirmed'
- `title`, `subtitle`, `description` - Recipe text content
- `servings_value`, `servings_unit_text` - Servings information
- `nutrition_kcal`, `nutrition_protein`, `nutrition_carbs`, `nutrition_fat` - Nutrition data
- `prep_time_min`, `cook_time_min` - Time values (minutes)
- `prep_time_source`, `cook_time_source` - `original` (URL scrape or visible on extract image) | `estimated` (AI time estimate) | null
- `prep_time_confidence`, `cook_time_confidence` - 0–1 when source is `estimated`; null otherwise
- `image_path` - Recipe photo URL
- `created_at`, `updated_at` - Timestamps

**Relationships**:
- N:1 to `recipe_sources` (many recipes to one source)
- 1:N to `recipe_ingredient_sections` (one recipe has many sections)
- 1:N to `recipe_steps` (one recipe has many steps)
- 1:N to `recipe_tips` (one recipe has many tips)
- 0:1 to `recipe_health_scores` (optional persisted health estimate)
- 1:N to `recipe_tags` (zero or more controlled tag strings per recipe; separate from ingredient `category`)

### Entity: `recipe_tags`
**Description**: Junction-style rows `(recipe_id, tag)` for a fixed vocabulary (meal type, cuisine, dish type, diet, context). Assigned by `POST /api/recipes/:id/generate-tags` or manual `tags` on create/update; validated server-side (`recipeTagValidation.js`).

**Key Fields**:
- `recipe_id` (PK part, FK) - References recipes.id ON DELETE CASCADE
- `tag` (PK part) - Allowed string from `constants/recipeTags.js`

**Relationships**:
- N:1 to `recipes`

### Entity: `recipe_ingredient_sections`
**Description**: Grouping of ingredients with optional heading (e.g., "For the dough", "For the filling")

**Key Fields**:
- `id` (PK) - Auto-increment ID
- `recipe_id` (FK) - References recipes.id ON DELETE CASCADE
- `position` - Display order
- `heading` - Section name (nullable)

**Relationships**:
- N:1 to `recipes` (many sections to one recipe)
- 1:N to `ingredients` (one section has many ingredients)

### Entity: `ingredients`
**Description**: Individual ingredient with amount, unit, and original text from OCR

**Key Fields**:
- `id` (PK) - Auto-increment ID
- `section_id` (FK) - References recipe_ingredient_sections.id ON DELETE CASCADE
- `position` - Display order within section
- `original_text` - Raw text from OCR extraction
- `amount` - Numeric quantity
- `amount_max` - Max quantity for ranges (e.g., "1-2 cups")
- `unit` - Measurement unit (cup, tsp, g, etc.)
- `ingredient` - Ingredient name
- `additional_info` - Notes (e.g., "chopped", "optional")

**Relationships**:
- N:1 to `recipe_ingredient_sections` (many ingredients to one section)

### Entity: `recipe_steps`
**Description**: Preparation step with sequential numbering

**Key Fields**:
- `id` (PK) - Auto-increment ID
- `recipe_id` (FK) - References recipes.id ON DELETE CASCADE
- `step_number` - Sequential step number (1, 2, 3, ...)
- `instruction` - Step text

**Relationships**:
- N:1 to `recipes` (many steps to one recipe)

### Entity: `recipe_tips`
**Description**: Cooking tips, variations, or notes

**Key Fields**:
- `id` (PK) - Auto-increment ID
- `recipe_id` (FK) - References recipes.id ON DELETE CASCADE
- `position` - Display order
- `text` - Tip content

**Relationships**:
- N:1 to `recipes` (many tips to one recipe)

### Entity: `recipe_health_scores`
**Description**: Latest LLM health estimate for a recipe (practical, not medical); one row per recipe, upserted on each `POST .../estimate-health-score`.

**Key Fields**:
- `recipe_id` (PK, FK) - References recipes.id ON DELETE CASCADE
- `health_score` - 0–100 or null if fallback
- `confidence` - 0–1 or null
- `summary` - Short text
- `positives_json`, `concerns_json`, `improvement_tips_json` - JSON arrays of strings
- `updated_at` - Last estimate time (model/tokens are in `ai_token_usage`, `usage_kind` = `health_score`). Failed estimates are not stored.

**Relationships**:
- 1:1 with `recipes` (optional; row exists only after at least one estimate)

### Entity: `ai_token_usage`
**Description**: OpenAI API token usage for cost monitoring (vision extract, URL normalization, health score, recipe tags, etc.)

**Key Fields**:
- `id` (PK) - Auto-increment ID
- `recipe_id` (FK) - References recipes.id
- `prompt_tokens` - Input tokens
- `completion_tokens` - Output tokens
- `total_tokens` - Sum of prompt + completion
- `response_json` - Model output / structured response (JSON text)
- `request_json` - JSON sent to the model when the call is text-based (e.g. URL scrape payload); null for vision-only calls
- `model` - OpenAI model id used for that call (e.g. gpt-4.1-mini, gpt-4o-mini)
- `usage_kind` - Call type: `recipe_image_extract`, `url_recipe_normalize`, `health_score`, `recipe_time_estimate`, … (legacy rows may have been migrated from `vision` / `url_normalize`)
- `created_at` - Timestamp

**Relationships**:
- N:1 to `recipes` (many AI calls per recipe)

## 5. Mapping: User Stories → Components/Entities

| Story ID | Title | Affected Components | Affected Entities | NFR Notes |
|----------|-------|---------------------|-------------------|-----------|
| US-001 | Manual recipe entry | RecipeFormMultiStep, recipeService, recipes.js | recipes, recipe_ingredient_sections, ingredients, recipe_steps, recipe_tips | Validation: Required title, min 1 ingredient |
| US-002 | AI recipe import | RecipeImportOverlay, RecipeUrlImportOverlay, extractRecipeService, recipeNormalizationService, recipes.js, upload.js | recipes, ingredients, recipe_steps, ai_token_usage | Performance: Image resize before API call; Cost: Token tracking |
| US-003 | View recipe list | RecipesView, recipeService | recipes, recipe_sources | Performance: No ingredients/steps in list query |
| US-004 | View recipe detail | RecipesView, recipeService | recipes, ingredients, recipe_steps, recipe_tips, recipe_health_scores | UI: Servings adjustment with ingredient scaling; optional persisted health estimate |
| US-005 | Edit recipe | RecipeFormMultiStep, recipeService | All recipe-related entities | Data: Preserve original_text for OCR imports |
| US-006 | Delete recipe | RecipesView, recipeService | recipes + cascades | Data Integrity: ON DELETE CASCADE for related records |
| US-007 | Manage sources | SourcesView, sourceService | recipe_sources | Validation: Name required, year range check |
| US-008 | Upload source cover | SourcesView, sourceService | recipe_sources | Performance: Resize to 2400px, WebP compression |
| US-009 | 4-point perspective crop | RecipeImportOverlay, SourcesView, cropPerspectiveService | recipes.image_path, recipe_sources.image_path | Optional: Requires Python/OpenCV setup |
| US-010 | Search/filter recipes | RecipesView | recipes | Performance: Add index on title for search |
| US-011 | Recipe status (draft/confirmed) | RecipeFormMultiStep, recipeService | recipes.status | Workflow: Draft → Confirmed (one-way) |
| US-012 | Token usage monitoring | extractRecipeService, recipe routes | ai_token_usage | Cost: Log all OpenAI API calls |
| US-013 | Favorite recipes | RecipesView, AppLayout, recipes.js | recipes.favorite | UI: Star toggle + favorites-only listing |
| US-014 | Would cook again rating | RecipesView, RecipeFormMultiStep, recipes.js | recipes.would_cook_again | UI: prompt after first "Mark cooked today" + selectable in Edit Recipe |

## 6. Important Design Rules

### Coding Conventions

**Language & Style**:
- All code, comments, documentation, and UI text must be in English
- Use descriptive variable/function names (no abbreviations)
- Prefer clarity over cleverness
- Comment only when logic isn't self-evident

**Frontend (Vue 3 + TypeScript)**:
- Use Composition API with `<script setup>` syntax
- TypeScript for all new files
- CSS custom properties for theming (no hardcoded colors)
- Props must be typed
- Use async/await for API calls

**Backend (Node.js + Express)**:
- ES modules (`import`/`export`, not CommonJS)
- async/await over promises
- Validate input at route handlers
- Business logic in services, not routes
- Prepared statements for all SQL queries

### Architectural Principles

**Separation of Concerns**:
- Routes: HTTP concerns (request/response handling)
- Services: Business logic and data operations
- Database: Schema and query execution
- Components: UI rendering and user interaction

**Data Integrity**:
- Always enable foreign keys: `PRAGMA foreign_keys = ON`
- Use transactions for multi-step database operations
- ON DELETE CASCADE for dependent records
- Check constraints for enum values

**Security**:
- Never expose `.env` files or API keys in code
- Parameterized queries only (prevent SQL injection)
- Validate and sanitize all user input
- Limit file upload sizes (50MB max)
- Check file types before processing

**Performance**:
- Recipe list endpoint excludes ingredients/steps
- Image resize before upload/processing
- WebP format for all images (quality: 80)
- Cache-busting for updated images (`?v=timestamp`)

**Cost Management**:
- Token usage logged to ai_token_usage table
- Configurable model (gpt-4.1-mini cheaper than gpt-4o)
- Configurable detail level (low/high/auto)
- Image resize before OpenAI API call (reduce tokens)

### Database Design Patterns

**Normalized Structure**:
- Ingredients in separate table (not JSON array)
- Sections for ingredient grouping
- Steps in separate table with sequential numbering
- Tips in separate table for flexibility

**Original Text Preservation**:
- Store `original_text` for OCR-extracted ingredients
- Allows comparison between structured and raw data
- Enables manual correction of AI mistakes

**Metadata Tracking**:
- `extract_status` for AI import workflow state
- `extract_confidence` for quality assessment
- `extract_warnings` and `extract_missing_fields` for diagnostics
- `import_method` to distinguish manual vs. AI entry

### Error Handling

**API Responses**:
- 200: Success
- 201: Created
- 204: Deleted (no content)
- 400: Bad request (validation error)
- 404: Not found
- 500: Internal server error

**Error Format**:
```json
{
  "error": "Human-readable error message"
}
```

**Logging**:
- Console.error for backend errors
- Include context (operation, ID, reason)
- Don't expose sensitive data in logs

### Testing Strategy

**Current State**: Manual testing only

**Future Testing**:
- Use `:memory:` database for tests
- Mock OpenAI API calls (avoid costs)
- Test edge cases (empty fields, malformed input)
- Verify cascade deletes
- Test image upload/resize/crop

### Documentation Maintenance

**Keep in Sync**:
- `README.md`: User-facing setup and API reference
- `AGENTS.md`: High-level rules and conventions
- `CLAUDE.md`: Technical context and troubleshooting
- `docs/SDD.md`: This design document

**Update Triggers**:
- New API endpoint → Update all docs
- New database column → Update schema docs
- New environment variable → Update .env.example and docs
- Breaking changes → Highlight in all relevant docs

---

**Document Version**: 1.0
**Last Updated**: 2026-03-18
**Maintained By**: Development Team
