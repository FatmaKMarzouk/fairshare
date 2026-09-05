/**
 * Runs before every test file.
 *
 * Unit tests need nothing from here; integration tests pull their database
 * helpers from `tests/helpers/db.ts` explicitly rather than through global
 * side effects, so that reading a test file tells you what it depends on.
 */

// Keep test output deterministic regardless of the machine's locale.
process.env.TZ = 'UTC';
