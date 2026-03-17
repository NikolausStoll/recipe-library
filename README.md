# Recipe Library

Monorepo: Vue 3 + Vite frontend, Node.js + Express backend, SQLite (better-sqlite3).

## Structure

- `frontend/` – Vue 3 + Vite, Vue Router. App layout: header, nav (Dashboard, Recipes, Import, Shopping), content area. **Recipes**: manual recipe entry; **Import**: two-step flow – (1) upload photo of recipe image, (2) upload one or more photos of recipe text; step 2 sends images to OpenAI for structured extraction (title, intro, ingredients, steps); token usage is logged and shown. All styles use CSS custom properties for **light/dark mode**.
- `backend/` – Express, routes under `src/routes/`, services under `src/services/` (incl. **extractRecipeService**: OpenAI vision + JSON schema for recipe extraction; token usage stored in `extract_usage`), DB under `src/db/`.
- Tables: **recipe_sources** (type: book|url|manual|other, name, subtitle, author, year, image_path, …; für Bücher mit Cover und Metadaten), **recipes** (source_id → recipe_sources; status, import_method, extract_status, image_path, **parsed_recipe_json**; source_type wird aus der verknüpften Source abgeleitet), `ingredients`, `recipe_steps`, `extract_usage` (recipe_id, prompt_tokens, …).

## Scripts (from project root)

| Command | Description |
|--------|-------------|
| `npm run install:all` | Install dependencies (root + workspaces) |
| `npm run dev` | Start frontend and backend in parallel |
| `npm run dev:frontend` | Frontend only (Vite) |
| `npm run dev:backend` | Backend only (Express, port 8097) |
| `npm run build` | Build frontend for production |
| `npm run start` | Start backend (after build) |

## Environment

The `.env` file lives in the **project root**. Relevant keys: `DB_PATH`, `UPLOAD_DIR`, `IMAGE_MAX_DIMENSION`, `IMAGE_QUALITY`, `OPENAI_API_KEY` (required for step 2 of import; recipe text extraction), optional `OPENAI_EXTRACT_MODEL` (default: gpt-4o).

**Perspective crop (optional):** The 4-point crop uses `backend/scripts/crop_perspective.py` (Python 3 + opencv-python + numpy). Install with `pip install opencv-python-headless numpy`. Optional env: `CROP_PYTHON` (e.g. `python3`).

## Run locally with Docker

Create `.env` (see `.env.example`), then:

```bash
./run-local.sh
```

App: http://localhost:8097

## API

- `GET /api/health` – Health check
- `GET /api/recipes` – List all recipes (no ingredients/steps)
- `GET /api/recipes/:id` – Get one recipe with ingredients and steps
- `POST /api/recipes` – Create recipe (stored as **draft**; body: `title` required; optional: `description`, `servings`, source fields; `ingredients[]`, `recipe_steps[]`)
- `PUT /api/recipes/:id` – Update recipe (body: optional recipe fields, `status` (draft | confirmed), source fields, `ingredients[]`, `recipe_steps[]` replace existing)
- `DELETE /api/recipes/:id` – Delete recipe (cascades to ingredients and steps)
- `POST /api/upload` – **Step 1**: Upload recipe image (multipart field `image`). Creates a draft recipe with `image_path`, returns `{ url, recipe }`. Image resized to longest side ≤ `IMAGE_MAX_DIMENSION`, saved as WebP.
- `POST /api/recipes/:id/extract-from-images` – **Step 2**: Extract recipe text from image(s) via OpenAI (multipart field `images`, one or more files). Returns `{ recipe, usage?: { prompt_tokens, completion_tokens, total_tokens } }`; usage is logged to `extract_usage` table.
- **Sources (e.g. books):** `GET /api/sources` – List sources. `GET /api/sources/:id` – One source. `POST /api/sources` – Create (body: `type`, `name`, `subtitle?`, `author?`, `year?`, …). `PUT /api/sources/:id` – Update. `DELETE /api/sources/:id` – Delete (fails if recipes reference it). `POST /api/sources/:id/cover` – Upload book cover (multipart `image`, optional `points` for 4-point crop; resize to 2400px, WebP).
- `GET /uploads/*` – Serve uploaded images.
