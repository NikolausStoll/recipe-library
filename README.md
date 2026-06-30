# Recipe Library

Recipe Library is a personal recipe-management workspace that keeps edits, imports, and cookbooks in one place. The Vue + Express app lets you add recipes manually, scrape websites, or import from photos, then polish the results before cooking.

## Features

- Multi-step recipe form with ingredients, steps, tips, tags, nutrition, and linked source metadata.
- Recipe detail view with cooking mode, favorites, “would cook again,” and “Needs review” badges for drafts.
- **Shopping list** (`/shopping`): add scaled ingredients from recipes, merge by category, check off in-store, print.
- **Meal plan** (`/plan`): rolling 7-day dinner plan, add/remove recipes, mark cooked → `recipe_history`, smart suggestions.
- Website imports that scrape JSON-LD/HTML, normalize via LLM, convert cups and imperial units (oz/lb → g), and dedupe sources by domain.
- Image/photo import backed by OpenAI vision, deferred uploads (`processImageLater`), optional 4-point crop, and Sharp/WebP resizing.
- Cookbook/source management with cover upload, cover cropping, and separate book vs. website listings.
- Tags, health-score, and time-estimate APIs that append structured AI usage to `ai_token_usage`.
- Cooking-mode layout for step-by-step guidance and ingredients panels.
- Responsive PWA shell (manifest + `sw.js`), top/bottom navigation, and consistent light/dark theming.

## Installation

### Prerequisites

- Node.js 20+
- `OPENAI_API_KEY` (required for AI extraction/import paths)

### Local development

```bash
npm run install:all
cp .env.example .env
# Add your OPENAI_API_KEY to .env
npm run dev
```

`npm run dev` starts the Express backend (`:8097`) and waits for it before launching the Vite frontend.

## Environment

Copy `.env.example` into `.env` in the workspace root. Supply `OPENAI_API_KEY` and only override `DB_PATH`, `UPLOAD_DIR`, or image-size values if you need to run outside the defaults. The example includes optional OpenAI tuning and crop-related variables.

## Useful commands

- `npm run install:all`
- `npm run dev`
- `npm run dev:frontend`
- `npm run dev:backend`
- `npm run build`
- `npm run start`
- `npm --prefix backend run test`
- `npm --prefix backend run evaluate-vision`
- `npm --prefix frontend run preview`

## Next

- Backend plan + shopping sync (multi-device)
- Historical plan calendar
- Further large-screen optimizations
