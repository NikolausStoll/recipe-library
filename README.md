# Recipe Library

A full-stack recipe management application with AI-powered recipe extraction from images.

**Stack**: Vue 3 + Vite + TypeScript frontend, Node.js + Express backend, SQLite database (better-sqlite3), OpenAI gpt-4.1-mini vision API.

## Features

- **Manual Recipe Entry**: Full-featured recipe form with ingredients, steps, tips, nutrition
- **AI Recipe Import**: Two-step overlay workflow
  1. Optional: Upload recipe photo
  2. Upload recipe text image(s) → OpenAI vision extraction with structured JSON schema
- **Recipe URL scrape**: `POST /api/recipes/extract-from-url` fetches HTML and extracts raw fields (JSON-LD + HTML heuristics). Optional `normalize: true` chains OpenAI (`gpt-4o-mini`, fallback `gpt-4.1-mini`) to structured JSON matching the vision-extract schema (German, metric-friendly units)
- **Recipe URL import (full flow)**: `POST /api/recipes/import-from-url` creates a draft recipe, scrapes + normalizes with OpenAI, writes each LLM call to `ai_token_usage` (with `model` and `usage_kind`), then returns the recipe for editing in the UI
- **Book Source Management**: Track recipes from cookbooks with metadata and cover images
- **4-Point Perspective Crop**: Optional Python-based image perspective correction
- **Admin · Extract usage**: Table of OpenAI token usage with per-request cost estimate (¢) for supported models
- **Light/Dark Mode**: CSS custom properties for full theme support
- **Token Usage Tracking**: Monitor OpenAI API costs via `ai_token_usage` table

## Project Structure

```
recipe-library/
├── frontend/          # Vue 3 + Vite + TypeScript
│   ├── src/
│   │   ├── views/           # Dashboard, Recipes, Sources, Shopping
│   │   ├── components/      # RecipeForm, RecipeImportOverlay
│   │   ├── layouts/         # AppLayout (header + nav)
│   │   ├── router/          # Vue Router configuration
│   │   └── api/             # API client functions
│   └── package.json
├── backend/           # Node.js + Express + SQLite
│   ├── src/
│   │   ├── routes/          # API route handlers
│   │   ├── services/        # Business logic (extract, recipe, source, image)
│   │   ├── db/              # Database schema and initialization
│   │   └── server.js        # Express app entry point
│   ├── scripts/             # Utility scripts (crop_perspective.py, evaluate-vision-quality.js)
│   ├── requirements.txt     # Python dependencies (opencv, numpy)
│   └── package.json
├── .env.example       # Environment variables template
├── Dockerfile         # Multi-stage production build
├── run-local.sh       # Docker local development script
└── package.json       # Root workspace configuration
```

### Database Schema

- **recipe_sources**: Book/URL/manual sources (type, name, author, year, image_path)
- **recipes**: Main recipe table (title, description, servings, nutrition, extract metadata, status: draft|confirmed)
- **recipe_ingredient_sections**: Ingredient groupings with headings
- **ingredients**: Individual ingredients (amount, unit, ingredient, additional_info, optional **category** – must be one of the canonical keys in `backend/src/constants/ingredientCategories.js`; the recipe form uses German labels mapped to those keys)
- **recipe_steps**: Preparation steps
- **recipe_tips**: Cooking tips and variations
- **ai_token_usage**: OpenAI token usage log (`response_json`, optional `request_json` for JSON-in requests, `model`, `usage_kind`)

## Quick Start

### Local Development

```bash
# 1. Install dependencies
npm run install:all

# 2. Create .env file (see Environment section below)
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# 3. Start development servers
npm run dev
```

App available at [http://localhost:8097](http://localhost:8097)

### Docker (Recommended for Production)

```bash
# Create .env file
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Build and run
./run-local.sh
```

App available at [http://localhost:8097](http://localhost:8097)

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run install:all` | Install all dependencies (root + workspaces) |
| `npm run dev` | Start frontend (Vite) and backend (Express) in parallel |
| `npm run dev:frontend` | Start frontend only (Vite dev server) |
| `npm run dev:backend` | Start backend only (Express on port 8097) |
| `npm run build` | Build frontend for production |
| `npm run start` | Start production server (requires built frontend) |

## Environment Variables

Create a `.env` file in the **project root** based on [.env.example](.env.example):

### Required
- `OPENAI_API_KEY` – OpenAI API key for recipe extraction (**required** for AI import feature)

### Optional
- `DB_PATH` – SQLite database path (default: `recipe-library.db`)
- `UPLOAD_DIR` – Base directory for uploads (default: `data/uploads`); recipe images in `UPLOAD_DIR/recipe/`, source covers in `UPLOAD_DIR/source/`
- `STATIC_DIR` – Static files directory (default: `/app/public`)
- `IMAGE_QUALITY` – WebP quality 0–100 for recipe and source images (default: `80`)
- `IMAGE_MAX_DIMENSION` – Max longest-side dimension for recipe and source images; images are only downscaled, never upscaled (default: `2400`)
- `THUMBNAIL_MAX_DIMENSION` – Max longest-side dimension for thumbnails shown on overview lists (default: `600`)
- `TEXT_IMAGE_MAX_DIMENSION` – Max dimension for OpenAI text images (default: `1400`)
- `OPENAI_EXTRACT_MODEL` – OpenAI model for extraction (default: `gpt-4.1-mini`)
- `OPENAI_EXTRACT_DETAIL` – Vision API detail level: `low` | `high` | `auto` (default: `high`)
- `OPENAI_NUTRITION_MODEL` – Model for nutrition estimation (default: `gpt-4o-mini`)
- `OPENAI_HEALTH_SCORE_MODEL` – Model for health score estimation (`POST .../estimate-health-score`, default: `gpt-4o-mini`)
- `OPENAI_HEALTH_SCORE_TEMPERATURE` – Optional, clamped 0–0.3 (default: `0.2`)
- `OPENAI_TIME_ESTIMATE_MODEL` – Model for prep/cook time estimate (`POST .../estimate-times`, default: `gpt-4o-mini`)
- `OPENAI_TIME_ESTIMATE_TEMPERATURE` – Optional, clamped 0–0.3 (default: `0.2`)
- `CROP_PYTHON` – Python executable path for perspective crop (optional)
- `RECIPE_URL_FETCH_TIMEOUT_MS` – Max wait for URL fetch (default: `25000`)
- `RECIPE_URL_MAX_BYTES` – Max HTML response size for URL extraction (default: `2000000`)
- `RECIPE_URL_USER_AGENT` – `User-Agent` header for URL fetch (optional)
- `OPENAI_NORMALIZE_MODEL_PRIMARY` – URL normalization LLM (default: `gpt-4o-mini`)
- `OPENAI_NORMALIZE_MODEL_FALLBACK` – Retry model when quality heuristics fail (default: `gpt-4.1-mini`)
- `OPENAI_NORMALIZE_TEMPERATURE` – 0–0.3 (default: `0.2`)

### Python Setup (Optional 4-Point Crop)

The perspective crop feature requires Python 3 with OpenCV and NumPy:

```bash
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
```

The backend automatically uses `backend/venv/bin/python3` if available. Otherwise, set `CROP_PYTHON` in `.env`.

## Technology Stack

### Frontend
- **Vue 3** – Composition API with `<script setup>`
- **TypeScript** – Type-safe component development
- **Vite** – Fast development server and build tool
- **Vue Router** – Client-side routing
- **CSS Custom Properties** – Theme-able light/dark mode

### Backend
- **Node.js 20+** – JavaScript runtime
- **Express** – Web framework
- **better-sqlite3** – Fast, synchronous SQLite driver
- **Sharp** – High-performance image processing
- **Multer** – File upload handling
- **OpenAI SDK** – gpt-4.1-mini vision API integration

### Optional
- **Python 3** – For perspective crop feature
- **OpenCV** – Computer vision (4-point crop)
- **NumPy** – Numerical computing

## API Reference

### Health Check
- **`GET /api/health`** – Server health status

### Admin
- **`GET /api/admin/extract-usage`** – All `ai_token_usage` rows with joined recipe title, token counts, `response_json`, optional **`request_json`** (input JSON for URL normalization calls), `model`, `usage_kind`, plus estimated **`cost_usd`** / **`cost_cents`** (US cents) from built-in pricing for `gpt-4o-mini` and `gpt-4.1-mini` only; other models return `cost_cents: null`. Used by **Admin → AI token usage** in the web UI.

### Recipes

#### List & Retrieve
- **`GET /api/recipes`** – List all recipes (excludes ingredients/steps for performance)
  - Response: `[{ id, title, subtitle, image_path, status, favorite, would_cook_again, ... }]`

- **`GET /api/recipes/:id`** – Get single recipe with full details
  - Response: `{ id, title, ..., favorite, would_cook_again, ingredients: [...], recipe_steps: [...], recipe_tips: [...] }`

#### Favorites
- **`POST /api/recipes/:id/favorite`** – Mark/unmark a recipe as favorite
  - Body: `{ favorite: boolean }`
  - Response: `{ recipe: { ..., favorite } }`

- **`GET /api/recipes/with-ingredients?favorite=1`** – List recipes including flattened ingredients for filtering
  - When `favorite=1`, returns only favorite recipes
  - Response: `[{ ..., ingredients: [...], favorite }]`

#### Create & Update
- **`POST /api/recipes`** – Create new recipe (stored as `draft`)
  - Body: `{ title: string (required), description?, servings?, ingredients?, recipe_steps?, ... }`
  - Response: `{ id, title, status: 'draft', ... }`

- **`PUT /api/recipes/:id`** – Update existing recipe
  - Body: Any recipe fields, `ingredients[]`, `recipe_steps[]` (replace existing)
  - Ingredients are **replaced** (sections and ingredient rows deleted and re-inserted; IDs change). When each line includes `section_id` from `GET`, sections are grouped in list order by that id so multiple sections are not collapsed. Without `section_id`, grouping follows consecutive `section_heading` changes.
  - Set `would_cook_again` to one of `yes` | `maybe` | `no`
  - Set `status: 'confirmed'` to mark as final
  - Response: Updated recipe object

- **`DELETE /api/recipes/:id`** – Delete recipe
  - Cascades to ingredients, steps, tips, sections, `recipe_health_scores`, history

#### AI helpers (structured recipe only; not part of OCR/URL extract)
- **`POST /api/recipes/:id/estimate-nutrition`** – Estimate kcal/macros from structured ingredients (persists `nutrition_*` on the recipe)
- **`POST /api/recipes/:id/estimate-health-score`** – Practical **health score** (0–100), summary, positives, concerns, tips, confidence (0–1). **Persists** the latest estimate in `recipe_health_scores` (one row per recipe); **model** and **token usage** are appended to `ai_token_usage` with `usage_kind: health_score`. `GET /api/recipes/:id` includes `health_score` (estimate fields only; not model/tokens from DB). Not medical advice.
- **`POST /api/recipes/:id/estimate-times`** – Separate OpenAI call (`gpt-4o-mini` by default) for **prep** and **cook** minutes + per-field confidence. Updates `prep_time_min` / `cook_time_min` and sets `prep_time_source` / `cook_time_source` to `estimated` when applied. If times came from URL scrape or image extract (`original`), returns **409** with suggested values until the client sends `replace_prep_if_original` and/or `replace_cook_if_original: true`. Logged to `ai_token_usage` with `usage_kind: recipe_time_estimate`.
  - Response (HTTP 200): `{ estimate, model, tokenUsage }` — successful estimate only. On failure (missing API key, model error, invalid output): **HTTP 503** (no key) or **502** with `{ error: string }`; nothing is written to `recipe_health_scores`.
- **`POST /api/recipes/estimate-health-score`** – Same model as by id, but with a structured recipe in the body (no DB id, no persist). Same **200** vs **502**/**503** behavior as above.
  - Body: `{ recipe: object }` — same fields as a full recipe payload (title, ingredients, recipe_steps, tips, optional nutrition_* , …)

#### URL (raw extraction, no LLM)
- **`POST /api/recipes/extract-from-url`** – Fetch a public recipe page and return raw extracted fields
  - Body: `{ url: string, normalize?: boolean }` (http/https only; localhost and private IPs are rejected). Set `normalize: true` to run LLM normalization after scraping (requires `OPENAI_API_KEY`).
  - Parses `application/ld+json` for schema.org `Recipe`, then fills gaps from HTML heuristics (e.g. WP Recipe Maker, common heading + list patterns)
  - Response (scrape only): `{ source, warnings, fetched_url, recipe }` with stable empty fields when nothing is found
  - Response (with `normalize: true`): same fields plus `structured` (same shape as vision extract: `status`, `confidence`, `warnings`, `missingFields`, `recipe`), `normalize_model`, `normalize_usage`. Uses `gpt-4o-mini` first; retries with `gpt-4.1-mini` if heuristics mark the first pass as low quality. No DB write; no nutrition in this step

- **`POST /api/recipes/import-from-url`** – End-to-end URL import (same as app “Import from URL”)
  - Body: `{ url: string }` (requires `OPENAI_API_KEY`)
  - Creates a draft recipe (`import_method: url`), scrapes the page, normalizes with OpenAI; **each** LLM request is appended to `ai_token_usage` with `model` and `usage_kind: url_recipe_normalize` (fallback retry = second row)
  - Response: `{ recipe, scrape: { source, warnings, fetched_url } }` with HTTP 201

### AI Import (Two-Step Process)

#### Step 1: Upload Recipe Photo (Optional)
- **`POST /api/upload`** – Upload recipe image
  - Body: `multipart/form-data` with `image` field, optional `points` (JSON array of 4 `{x,y}` for 4-point perspective crop)
  - Creates draft recipe with `image_path`
  - Image: optional 4-point crop, then resize only down (longest side ≤ `IMAGE_MAX_DIMENSION`), saved as WebP in `data/uploads/recipe/`
  - Response: `{ url: string, recipe: { id, image_path, ... } }`

#### Step 2: Extract Recipe from Text Images
- **`POST /api/recipes/:id/extract-from-images`** – AI extraction via OpenAI
  - Body: `multipart/form-data` with `images` field (one or more text images)
  - Images resized to `TEXT_IMAGE_MAX_DIMENSION` before sending to OpenAI
  - Response: `{ recipe: { status, confidence, warnings, missingFields, recipe: {...} }, usage?: { prompt_tokens, completion_tokens, total_tokens } }`
  - Token usage logged to `ai_token_usage` table

### Sources (Cookbooks, URLs, etc.)

- **`GET /api/sources`** – List all sources
  - Response: `[{ id, type, name, author, year, image_path, ... }]`

- **`GET /api/sources/:id`** – Get single source
  - Response: `{ id, type, name, ... }`

- **`POST /api/sources`** – Create new source
  - Body: `{ type: 'book'|'url'|'manual'|'other', name: string (required), subtitle?, author?, year?, ... }`
  - Response: Created source object

- **`PUT /api/sources/:id`** – Update source
  - Body: Any source fields
  - Response: Updated source object

- **`DELETE /api/sources/:id`** – Delete source
  - Fails if recipes reference this source (foreign key constraint)

- **`POST /api/sources/:id/cover`** – Upload book cover image
  - Body: `multipart/form-data` with `image` field, optional `points` (JSON array of 4 `{x,y}` for 4-point crop)
  - Image: optional 4-point crop, then resize only down (longest side ≤ `IMAGE_MAX_DIMENSION`), saved as WebP in `data/uploads/source/`
  - Response: `{ source, url }`

- **`POST /api/recipes/:id/image`** – Upload or replace recipe image
  - Body: `multipart/form-data` with `image` field, optional `points` (JSON array of 4 `{x,y}` for 4-point crop)
  - Image: optional 4-point crop, then resize only down, saved as WebP in `data/uploads/recipe/`
  - Response: `{ recipe, url }`

### Static Files
- **`GET /uploads/*`** – Serve uploaded images; recipe images under `/uploads/recipe/`, source covers under `/uploads/source/`

## Development

### Project Layout
- **Monorepo**: Single repository with `frontend` and `backend` workspaces
- **ES Modules**: Both frontend and backend use `import`/`export` (not CommonJS)
- **Database**: SQLite with better-sqlite3 (synchronous API)
- **Image Processing**: Sharp for resize/format conversion, optional OpenCV for perspective crop

### Adding Features

1. **Database Changes**: Update schema in `backend/src/db/index.js`, add migration if needed
2. **Backend**: Service layer (`backend/src/services/`) → Route handler (`backend/src/routes/`)
3. **Frontend**: API function (`frontend/src/api/`) → Component → View
4. **Documentation**: Update README.md, AGENTS.md, CLAUDE.md

### Code Style
- **English Only**: All code, comments, UI text, and documentation in English
- **TypeScript**: Use for all new frontend code
- **Composition API**: Prefer `<script setup>` syntax in Vue components
- **Prepared Statements**: Always use for database queries (SQL injection prevention)
- **Error Handling**: Catch errors at route level, return meaningful messages

## Deployment

### Docker Production

```bash
# Build image
docker build -t recipe-library .

# Run with persistent data
docker run -d \
  --name recipe-library \
  -p 8097:8097 \
  --env-file .env \
  -v $(pwd)/data:/data \
  recipe-library
```

### Manual Deployment

```bash
# 1. Install dependencies
npm run install:all

# 2. Build frontend
npm run build

# 3. Set environment variables
export DB_PATH=/path/to/recipe-library.db
export UPLOAD_DIR=/path/to/uploads
export OPENAI_API_KEY=sk-...

# 4. Start server
npm run start
```

### Requirements
- Node.js 20+
- OpenAI API key (for AI import feature)
- Python 3 + OpenCV (optional, for perspective crop)
- Writable directory for uploads and database

## Troubleshooting

### OpenAI API Errors

**Problem**: Recipe extraction fails with API error

**Solutions**:
- Verify `OPENAI_API_KEY` is set correctly in `.env`
- Check OpenAI account has credits/active subscription
- Review `ai_token_usage` table for error details
- Ensure images don't exceed OpenAI size limits (currently 20MB per image)
- Try different `OPENAI_EXTRACT_MODEL` (e.g., `gpt-4o` vs `gpt-4o-mini` vs `gpt-4.1-mini`)

### Database Errors

**Problem**: Foreign key constraint violation

**Solutions**:
- Check `PRAGMA foreign_keys = ON` is set (automatic in `initDb()`)
- Cannot delete source if recipes reference it – delete recipes first
- Use transactions for multi-step operations

**Problem**: Database locked

**Solutions**:
- SQLite doesn't handle concurrent writes well – use connection pooling or queue
- Check no other process has the database open
- For `:memory:` database, data is lost on restart (use file path)

### Image Upload Issues

**Problem**: Upload fails or image not displayed

**Solutions**:
- Check `UPLOAD_DIR` exists and is writable
- Verify Sharp can process the image format (supports JPEG, PNG, WebP, TIFF, GIF, SVG)
- Check image file size isn't too large
- Ensure `IMAGE_MAX_DIMENSION` setting is reasonable (default: 2400px)

**Problem**: Perspective crop fails

**Solutions**:
- Ensure Python venv is set up: `cd backend && python3 -m venv venv && ./venv/bin/pip install -r requirements.txt`
- Set `CROP_PYTHON` in `.env` if not using venv
- Verify opencv-python and numpy are installed
- Check 4 points are provided in correct format

### Performance

**Problem**: Slow recipe list loading

**Solutions**:
- Recipe list endpoint excludes ingredients/steps by design
- Add database indexes if filtering/sorting by custom fields
- Consider pagination for large recipe collections

**Problem**: High OpenAI costs

**Solutions**:
- Monitor `ai_token_usage` table regularly
- Use `gpt-4.1-mini` instead of pricier models like `gpt-4o` (set `OPENAI_EXTRACT_MODEL`)
- Reduce `TEXT_IMAGE_MAX_DIMENSION` to lower token usage
- Set `OPENAI_EXTRACT_DETAIL=low` for lower quality but cheaper extraction

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make changes and test thoroughly
4. Update documentation (README.md, AGENTS.md, CLAUDE.md)
5. Commit with descriptive messages: `git commit -m "Add feature description"`
6. Push and create a pull request

## License

[Add your license here]

## Support

For issues, questions, or feature requests, please open an issue on the repository.
