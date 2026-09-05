# FairShare

Shared-expense tracker for groups — record who paid for what, then get the
**minimum set of transfers** that settles everybody up.

Angular 18 · Node 18 + TypeScript · Express · MongoDB · Docker · GitHub Actions

---

## Quick start

The only requirement is Docker. No Node, no Angular CLI, no MongoDB on your machine.

```bash
docker compose up --build
```

| | |
|---|---|
| App | `http://localhost:4200` |
| API | `http://localhost:3000/api` |
| Health | `http://localhost:3000/health` |

To stop and wipe the database volume:

```bash
docker compose down -v
```

## What it does

You and three friends share a flat. Over a month, one of you buys groceries, another
covers the internet bill, a third pays for a shared taxi split unevenly because two
people got out early. At the end of the month everybody owes everybody a little.

FairShare records each expense against a group, tracks the running net position of
every member, and then reduces the tangle of mutual debts to the **fewest possible
payments** — so four people with six outstanding debts between them settle up in
three transfers, not six.

### Split modes

| Mode | Use it when |
|---|---|
| **Equal** | dinner, split down the middle |
| **Exact** | receipts where each line belongs to a specific person |
| **Percentage** | rent split 40/35/25 |
| **Shares** | a taxi where one person rode twice as far |

## Design decisions

### Money is integers, never floats

Every monetary value in the system — API payloads, database documents, domain
logic — is an **integer count of minor units** (cents). Binary floating point
cannot represent one tenth exactly; that is fine in a graphics pipeline and
unacceptable in a ledger. Formatting into a human-readable amount happens once,
in the Angular presentation layer, and nowhere else.

### Splits conserve every cent

Splitting ten francs three ways cannot produce three shares of three-thirty-three —
that loses a cent. `computeSplit` allocates the remainder deterministically using
the largest-remainder method, and its central invariant is enforced by tests:

> the shares always sum to exactly the amount that was split

### Settlement is a graph reduction, not a list of IOUs

Recording "A owes B five, B owes C five" and asking people to make both payments is
the naive approach. FairShare nets everyone down to a single balance, then greedily
matches the largest debtor against the largest creditor. That settles the group in
**at most `n-1` transfers** for `n` people, and the test suite asserts both the
transfer bound and that every member lands exactly on zero.

### The domain core is pure

`computeSplit` and `simplifyDebts` are ordinary functions of their inputs. No
database, no HTTP, no clock, no randomness. They are covered by fast unit tests
that need nothing running, and the Express and Mongoose layers around them stay
thin enough to be uninteresting — which is the point.

## Testing

Tests were written **before** the implementation and committed while still failing,
as an executable specification. The git history shows each `test(...)` commit
landing red and the `feat(...)` commit that follows turning it green.

| Layer | Tool | Needs |
|---|---|---|
| Domain engines | Jest | nothing |
| REST API | Jest + supertest + `mongodb-memory-server` | nothing |
| End-to-end | Playwright | the Docker stack |

```bash
# backend unit + integration
docker compose run --rm api npm test

# end-to-end, against the running stack
docker compose up -d
npx playwright test
```

## Project layout

```
fairshare/
├── backend/            Express + TypeScript API
│   ├── src/
│   │   ├── domain/     pure engines — split, settlement, money
│   │   ├── models/     Mongoose schemas
│   │   ├── services/   use cases
│   │   ├── routes/     HTTP layer
│   │   └── app.ts      composition root
│   └── tests/
│       ├── unit/       domain engines
│       └── integration/ API via supertest
├── frontend/           Angular 18, standalone components
│   ├── src/app/
│   └── e2e/            Playwright specs
├── .github/            CI pipeline definition
├── docker-compose.yml
└── PLAN.md             the build plan, subtask by subtask
```

## API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | create account, returns JWT |
| `POST` | `/api/auth/login` | exchange credentials for JWT |
| `GET` | `/api/auth/me` | current user |
| `GET` | `/api/groups` | groups the caller belongs to |
| `POST` | `/api/groups` | create a group |
| `GET` | `/api/groups/:id` | group detail with members |
| `POST` | `/api/groups/:id/members` | add a member by email |
| `GET` | `/api/groups/:id/expenses` | list expenses |
| `POST` | `/api/groups/:id/expenses` | record an expense |
| `DELETE` | `/api/expenses/:id` | remove an expense |
| `GET` | `/api/groups/:id/balances` | net position per member |
| `GET` | `/api/groups/:id/settlement` | minimal transfer plan |

Errors are uniform:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "...", "details": [] } }
```

## Licence

MIT
