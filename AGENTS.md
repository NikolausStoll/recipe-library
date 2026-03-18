# Agent Instructions for Recipe Library

## Core Rules

- Maintain `README.md`, `AGENTS.md`, and `CLAUDE.md` in everything you do
- Use English for **everything**: code, comments, documentation, commit messages, and UI text
- Multi-language support may be added later, but until then, all UI text must be in English
- Keep documentation in sync with code changes

## Code Standards

### Style
- **Frontend**: Vue 3 Composition API with `<script setup>`, TypeScript, CSS custom properties
- **Backend**: ES modules, async/await, prepared statements, thin routes with service layer
- **Naming**: Descriptive names, camelCase for JS/TS, kebab-case for files/URLs
- **Comments**: Only when logic isn't self-evident, no redundant comments

### Architecture Principles
- Keep components/functions small and focused
- Services contain business logic, routes handle HTTP concerns
- Always use prepared statements for database queries
- Validate input at boundaries (API routes)
- Use transactions for multi-step database operations
- Enable foreign keys in SQLite

### Image Uploads
- Recipe images: stored in `data/uploads/recipe/`, WebP with `IMAGE_QUALITY` and `IMAGE_MAX_DIMENSION`, only downscale
- Source (book) covers: stored in `data/uploads/source/`, same WebP/downscale rules
- All image uploads support optional 4-point perspective crop (`points` in request body); use `cropPerspectiveBuffer` before resize

### Security
- Never expose `.env` files or API keys
- Validate and sanitize all user input
- Use parameterized queries (prevent SQL injection)
- Limit file upload sizes and types
- Check permissions before file operations

## AI Integration

- OpenAI vision API used for recipe extraction
- Token usage logged to `extract_usage` table
- Strict JSON schema validation (`RECIPE_JSON_SCHEMA`)
- Nutrition values estimated from ingredients (not extracted from image)
- Model configurable via `OPENAI_EXTRACT_MODEL` (default: `gpt-4.1-mini`)

## Development Workflow

### Before Making Changes
1. Read existing code to understand current implementation
2. Check database schema if data model changes are needed
3. Consider impact on API, frontend, and database
4. Update all three documentation files after changes

### Adding Features
- Start with backend (schema → service → route)
- Then frontend (API function → component → view)
- Update documentation
- Test manually with various inputs

### Modifying OpenAI Extraction
- Changes to `EXTRACT_PROMPT` or `RECIPE_JSON_SCHEMA` require testing
- Monitor token usage in `extract_usage` table
- Consider cost implications of prompt/schema changes

## Common Patterns

### Database Queries
```javascript
// Good: prepared statement
const stmt = db.prepare('SELECT * FROM recipes WHERE id = ?')
const recipe = stmt.get(id)

// Bad: string concatenation (SQL injection risk)
const recipe = db.prepare(`SELECT * FROM recipes WHERE id = ${id}`).get()
```

### API Routes
```javascript
// Good: thin route, validation, service call
router.post('/recipes', async (req, res) => {
  const { title } = req.body
  if (!title) return res.status(400).json({ error: 'Title required' })
  const recipe = await recipeService.createRecipe(req.body)
  res.json(recipe)
})
```

### Error Handling
```javascript
// Catch errors, return meaningful messages
try {
  const result = await someOperation()
  res.json(result)
} catch (err) {
  console.error('Operation failed:', err)
  res.status(500).json({ error: 'Operation failed' })
}
```

## Documentation Strategy

### README.md
- User-facing: setup, scripts, API reference
- Clear examples for common tasks
- Environment variable reference
- Keep concise and scannable

### AGENTS.md (this file)
- High-level rules and standards
- Quick reference for common patterns
- Project conventions and principles

### SDD.md
- Architectural and design decisions (components, data models, linking user stories to components)
- Keep synchronized with every significant change so design documentation matches implementation

### SDD.md
- Architectural and design decisions (components, data models, merging user stories)
- Update on every meaningful change alongside this AGENTS.md rule so the documented design stays aligned with the code
- Mention new workflows, API additions, or data-model shifts in this file as well

### CLAUDE.md
- Detailed technical context
- Architecture decisions
- Troubleshooting guides
- Implementation details

## Testing Approach

Currently manual. When adding tests:
- Use separate test database (`:memory:` recommended)
- Mock external APIs (OpenAI)
- Test edge cases and error paths
- Verify cascade deletes work correctly

## Maintenance

### Regular Tasks
- Review token usage in `extract_usage` table
- Monitor upload directory size
- Check for unused uploaded images
- Keep dependencies updated (npm audit)

### Before Deployment
- Test with production-like data
- Verify `.env.example` is up to date
- Check Docker build works
- Review database migrations

## Priorities

1. **Security**: Input validation, SQL injection prevention, secrets protection
2. **Data Integrity**: Foreign keys, cascades, transactions
3. **Cost Management**: Token usage tracking, image optimization
4. **User Experience**: Clear error messages, responsive UI, intuitive workflow
5. **Maintainability**: Documentation, code clarity, consistent patterns
