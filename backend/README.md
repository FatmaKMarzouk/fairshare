# FairShare API

Express + TypeScript service backing the FairShare client.

## Layout

```
src/
├── domain/      pure logic: money, split calculation, debt simplification
├── models/      Mongoose schemas
├── services/    use cases, the only layer that talks to both domain and models
├── routes/      HTTP verbs, status codes, nothing else
├── middleware/  auth, validation, error translation
├── config.ts    environment parsing, fails fast on bad input
├── app.ts       builds the Express app (no listening, so tests can import it)
└── server.ts    connects to Mongo and listens
```

`app.ts` deliberately does not call `listen`. Integration tests import the app
directly and drive it through supertest, so nothing binds a port.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | port the HTTP server binds |
| `NODE_ENV` | `development` | `production` tightens logging and error detail |
| `MONGO_URL` | — | **required**; connection string for the database |
| `JWT_SECRET` | — | **required**; secret used to sign tokens |
| `JWT_EXPIRES_IN` | `7d` | token lifetime |
| `CORS_ORIGIN` | `http://localhost:4200` | comma separated list of permitted browser origins |

Configuration is parsed once at startup and validated; a missing `JWT_SECRET` or
`MONGO_URL` stops the process immediately rather than failing on the first
request.

Running through `docker compose` supplies all of these, so no local environment
file is needed.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | watch mode |
| `npm run build` | compile to `dist/` |
| `npm start` | run the compiled server |
| `npm test` | unit + integration |
| `npm run test:unit` | domain engines only, needs nothing running |
| `npm run test:integration` | API tests |
| `npm run test:coverage` | with coverage thresholds enforced |
| `npm run lint` | ESLint |
| `npm run typecheck` | compiler only, no output |

## Tests and the database

Integration tests need a MongoDB. They resolve one in this order:

1. `TEST_MONGO_URL`, if set — used as-is. This is what CI uses, pointing at a
   MongoDB service container.
2. Otherwise an in-process `mongodb-memory-server` instance is started.

That keeps `npm test` working with nothing installed locally, while letting CI
use a real server rather than downloading a binary on every run.

Each test file gets a clean database; collections are dropped between tests.
