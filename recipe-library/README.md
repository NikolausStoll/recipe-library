# Recipe Library — Home Assistant Add-on

This folder holds the Home Assistant add-on metadata and docs for [Recipe Library](https://github.com/NikolausStoll/recipe-library), the self-hosted recipe workspace (Vue frontend + Node API + SQLite). The container exposes the same Vue UI + `/api` routes as the upstream project but packaged for HA with persistent `/data`.

## Features

- Full recipe library view: list, detail, favorites, “would cook again”, cooking mode, and draft badges.
- Shopping list and 7-day meal plan (frontend `localStorage`).
- Multi-step recipe editing with ingredients, steps, tips, tags, nutrition, and source metadata.
- AI-assisted imports (URL + image/photo) that scrape JSON-LD/HTML, call OpenAI for normalization, imperial/cup conversion, tagging, nutrition, health score, and time estimates, and log usage.
- Source management (cookbooks and websites) with cover upload/crop, deferred processing, and per-domain deduplication.
- Responsive PWA shell with top/bottom navigation, search/chips, and ingress-friendly UIs.
- Image handling via Sharp + perspective crop; uploads stored under `/data/uploads` with `image_processing_pending` support.

## Add-on specifics

- **Port**: 8097 by default; can be changed via the `port` option.
- **Ingress**: enabled so the UI appears in the HA sidebar when you use “Open web UI.”
- **Persistent storage**: bind `/data` for the SQLite database (`recipe-library.db`) and all uploaded media.
- **Environment parity**: every option becomes the equivalent environment variable the downstream app expects (see `DOCS.md` for the full mapping).

## Configuration & quick start

1. Add the Recipe Library repository (or your local copy) to Home Assistant and install the add-on.
2. In the add-on **Configuration** tab, supply at least `openai_api_key` if you want AI imports (images, URL normalization, nutrition, tags, etc.). Adjust `db_path`, `upload_dir`, or port if you use a custom storage layout.
3. Start the add-on, then click **Open web UI** (or use ingress) to begin browsing, editing, or importing recipes.

## Storage & backup guidance

- `db_path` and `upload_dir` default to `/data/recipe-library.db` and `/data/uploads`. Keep those directories mounted to preserve recipes, images, and pending uploads across updates.
- Back up the `.db` file together with `/data/uploads` to capture recipes, cover photos, and AI extraction history.

## Documentation

- **`DOCS.md`** — Detailed option ↔ environment mapping plus notes on OpenAI, cropping, and persistence.
- **`config.yaml`** — Add-on manifest, defaults, and UI schema used by Home Assistant.
- **`docker/entrypoint.js`** — Reads `/data/options.json`, maps options to env vars, and starts the Node server.
