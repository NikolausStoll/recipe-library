/**
 * Shared in-memory DB setup for backend tests.
 * Set DB_PATH before importing db-dependent modules (see tests/services/recipeSourceLink.test.js).
 */

/**
 * @returns {Promise<import('../../src/db/index.js')>}
 */
export async function setupMemoryDb() {
  process.env.DB_PATH = ':memory:'
  const dbModule = await import('../../src/db/index.js')
  dbModule.initDb()
  return dbModule
}

export function teardownMemoryDb() {
  delete process.env.DB_PATH
}
