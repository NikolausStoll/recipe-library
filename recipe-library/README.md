# Recipe Library — Home Assistant Add-on

This directory contains the **Home Assistant add-on** metadata for [Recipe Library](https://github.com/NikolausStoll/recipe-library): a self-hosted recipe app (Vue frontend + Node.js API + SQLite).

## What you get

- Web UI and API on port **8097** (configurable)
- Ingress support for access via the Home Assistant sidebar
- Persistent **`/data`** volume for the SQLite database and uploaded images
- All runtime settings exposed as **add-on options** (mapped to the same environment variables as the main project’s `.env.example`)

## Documentation

- **[DOCS.md](./DOCS.md)** — Option reference, environment mapping, data paths, and OpenAI-related settings

## Main repository

Development, issues, and the full application source live in the monorepo root:

- [../README.md](../README.md)

## Files in this folder

| File        | Purpose                                      |
| ----------- | -------------------------------------------- |
| `config.yaml` | Add-on manifest, default options, UI schema |
| `icon.png`  | Add-on icon in the Home Assistant UI         |
| `DOCS.md`   | Detailed configuration reference             |
| `README.md` | This file                                    |

## Quick start

1. Install the add-on (repository or local copy as required by your setup).
2. Open the add-on **Configuration** tab and set at least **`openai_api_key`** if you use AI import (image extraction, URL import, nutrition, tags, etc.).
3. Start the add-on and open the web UI or use **Open web UI** / Ingress.

For every option, see [DOCS.md](./DOCS.md).
