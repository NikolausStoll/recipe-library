# Backend tests

Run all tests:

```bash
npm --prefix backend run test
```

From the repo root:

```bash
npm test
```

## Conventions

- Tests live under `backend/tests/`, mirroring `src/` layout (`constants/`, `services/`, `routes/`, `utils/`).
- Shared helpers are in `tests/helpers/`.
- Database tests set `process.env.DB_PATH = ':memory:'` **before** importing `../../src/db/index.js`.
- Call `initDb()` in `before()` to create schema.
- Prefer testing exported pure functions and public service APIs without OpenAI calls.
- Disable optional LLM stages with env flags when needed, e.g. `AI_CUP_CONVERSION_ENABLED=false`.

## Suites (overview)

| File | Focus |
|------|--------|
| `constants/ingredientCategories.test.js` | Category sanitization |
| `constants/ingredientParsingPrompt.test.js` | Shared LLM parsing prompt blocks |
| `services/cupConversionService.test.js` | Cup detection, merge, LLM failure fallback |
| `services/extractRecipeService.test.js` | Vision prompt, schema, token logging |
| `services/recipeHtmlEnrichment.test.js` | HTML/WPRM scraping |
| `services/recipeImportPipelineService.test.js` | Post-import pipeline (no OpenAI) |
| `services/recipeNormalizationService.test.js` | Normalization payload + tips |
| `services/recipeService.test.js` | DB persistence, times, parsed recipe |
| `services/recipeSourceLink.test.js` | `original_url` → website source |
| `services/recipeTagPersistence.test.js` | Tag storage |
| `services/recipeTagValidation.test.js` | Tag sanitization |
| `services/recipeUrlExtractService.test.js` | URL scrape merge |
| `routes/routes.smoke.test.js` | Health + extract route smoke |
| `utils/extractUsagePricing.test.js` | Admin pricing helpers |
| `utils/normalizeDomain.test.js` | Domain normalization |
| `utils/openaiChatParams.test.js` | Temperature param rules |

## Helpers

- `tests/helpers/memoryDb.js` — `setupMemoryDb()` / `teardownMemoryDb()` for in-memory SQLite.
