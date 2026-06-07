# Recipe Library Add-on — Configuration

This document describes every Home Assistant add-on option defined in `config.yaml` and how it maps to the backend environment variables the container expects (the same semantics as the monorepo root `.env.example`). The container entrypoint (`docker/entrypoint.js`) reads `/data/options.json` (populated by HA from these options), sets `process.env`, and then launches `node backend/src/server.js`. If an option is missing from `options.json`, the entrypoint falls back to any pre-existing environment variable or the default listed here.

## Server & storage

| Add-on option | Environment variable | Default | Notes |
| ------------- | -------------------- | ------- | ----- |
| `port` | `PORT` | `8097` | HTTP listen/ingress port. |
| `db_path` | `DB_PATH` | `/data/recipe-library.db` | Local SQLite file; keep it under `/data` for persistence. |
| `static_dir` | `STATIC_DIR` | `/app/public` | Built frontend assets packaged with the container image. |
| `upload_dir` | `UPLOAD_DIR` | `/data/uploads` | Recipe/source images, thumbnails, and pending uploads. |

`dbPath`, `staticDir`, and `uploadDir` remain supported as legacy aliases inside the entrypoint.

## Image processing

| Add-on option | Environment variable | Default | Description |
| ------------- | -------------------- | ------- | ----------- |
| `image_quality` | `IMAGE_QUALITY` | `80` | WebP quality (1–100) for resized uploads. |
| `image_max_dimension` | `IMAGE_MAX_DIMENSION` | `2400` | Longest side cap for recipe/source images. |
| `thumbnail_max_dimension` | `THUMBNAIL_MAX_DIMENSION` | `600` | Longest side for generated thumbnails. |
| `text_image_max_dimension` | `TEXT_IMAGE_MAX_DIMENSION` | `1400` | Longest side for OCR/vision uploads before sending to OpenAI. |

The container image installs `opencv-python-headless` + `numpy` (see `backend/requirements.txt`), so 4-point perspective crop works automatically. If you encounter `ModuleNotFoundError: No module named 'cv2'`, rebuild the add-on/image from an up-to-date `Dockerfile`.

## Recipe URL fetch

Used by `POST /api/recipes/extract-from-url` / `POST /api/recipes/import-from-url`.

| Add-on option | Environment variable | Default | Description |
| ------------- | -------------------- | ------- | ----------- |
| `recipe_url_fetch_timeout_ms` | `RECIPE_URL_FETCH_TIMEOUT_MS` | `25000` | Timeout in milliseconds for HTTP GET. |
| `recipe_url_max_bytes` | `RECIPE_URL_MAX_BYTES` | `2000000` | Maximum response size (bytes). |
| `recipe_url_user_agent` | `RECIPE_URL_USER_AGENT` | `RecipeLibrary/1.0` | Outbound User-Agent header. |

## OpenAI — shared & vision

| Add-on option | Environment variable | Default | Description |
| ------------- | -------------------- | ------- | ----------- |
| `openai_api_key` | `OPENAI_API_KEY` | *(empty)* | **Required** for every AI-powered feature (vision, URL normalize, nutrition, health, time, tags). Leave empty only if you use the app entirely manually. |
| `openai_extract_model` | `OPENAI_EXTRACT_MODEL` | `gpt-4.1-mini` | Model for `POST /api/recipes/:id/extract-from-images`. |
| `openai_extract_detail` | `OPENAI_EXTRACT_DETAIL` | `high` | Vision detail level (`low`|`high`|`auto`). |

## OpenAI — normalization & helper APIs

| Add-on option | Environment variable | Default | Description |
| ------------- | -------------------- | ------- | ----------- |
| `openai_normalize_model_primary` | `OPENAI_NORMALIZE_MODEL_PRIMARY` | `gpt-4o-mini` | Model for `.normalizeRecipeWithLLM`. |
| `openai_normalize_temperature` | `OPENAI_NORMALIZE_TEMPERATURE` | `0.2` | Temperature (0–0.3 recommended). |
| `openai_nutrition_model` | `OPENAI_NUTRITION_MODEL` | `gpt-4o-mini` | Nutrition estimation model. |
| `openai_nutrition_model_temperature` | `OPENAI_NUTRITION_MODEL_TEMPERATURE` | `0.2` | Temperature (clamped 0–0.3). |
| `openai_health_score_model` | `OPENAI_HEALTH_SCORE_MODEL` | `gpt-4o-mini` | Health score estimation model. |
| `openai_health_score_temperature` | `OPENAI_HEALTH_SCORE_TEMPERATURE` | `0.2` | Temperature (clamped 0–0.3). |
| `openai_time_estimate_model` | `OPENAI_TIME_ESTIMATE_MODEL` | `gpt-4o-mini` | Time estimate model. |
| `openai_time_estimate_temperature` | `OPENAI_TIME_ESTIMATE_TEMPERATURE` | `0.2` | Temperature (clamped 0–0.3). |
| `openai_recipe_tag_model` | `OPENAI_RECIPE_TAG_MODEL` | `gpt-4o-mini` | Controlled vocabulary tagging. |
| `openai_recipe_tag_temperature` | `OPENAI_RECIPE_TAG_TEMPERATURE` | `0.2` | Temperature (clamped). |

Cup conversion, tagging, and the other AI helpers log token usage in `ai_token_usage`; the container mirrors the upstream `logAiTokenUsage` calls.

## Environment & naming conventions

- Add-on options use snake_case in `config.yaml` (e.g. `openai_api_key`).
- Environment variables use UPPER_SNAKE_CASE (e.g. `OPENAI_API_KEY`).
- `docker/entrypoint.js` keeps the canonical `OPTION_MAP` that pairs every option with its environment name (the same map the HA UI consults).

## Persistence & backup recommendations

- Mount HA’s `/data` volume so `db_path` and `upload_dir` remain untouched during updates. That keeps recipes, cookbooks, uploads, and pending crops alive.
- Back up `recipe-library.db` alongside `/data/uploads` for a complete snapshot.

## Further reading

- Application API and features: [../README.md](../README.md)
- Agent/developer context: [../CLAUDE.md](../CLAUDE.md)
