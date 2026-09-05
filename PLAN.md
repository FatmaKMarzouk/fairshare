# FairShare — Implementation Plan

> Shared-expense tracker with a debt-simplification settlement engine.
> Angular 18 · Node 18 + TypeScript · Express · MongoDB · Docker · GitHub Actions

---

## 1. Why this project

Splitting a bill is trivial. Splitting *many* bills across *many* people and then
working out the **minimum number of transfers** that settles everyone up is not —
it is a graph problem with a genuinely interesting invariant: money is conserved
to the cent, and nobody should have to make more than `n-1` payments.

That gives the project a real algorithmic core worth unit-testing, rather than a
CRUD app with tests bolted on.

## 2. Architecture

```
                 ┌──────────────────────────────┐
   browser  ───▶ │  nginx  (frontend container) │
                 │   · serves Angular bundle    │
                 │   · proxies /api  ───────────┼──┐
                 └──────────────────────────────┘  │
                                                   ▼
                              ┌────────────────────────────────┐
                              │  api  (backend container)      │
                              │   · Express + TypeScript       │
                              │   · JWT auth                   │
                              │   · pure domain engines        │
                              └───────────────┬────────────────┘
                                              ▼
                                   ┌─────────────────────┐
                                   │  mongo  (container) │
                                   └─────────────────────┘
```

Everything runs via `docker compose up`. **No local Node/Mongo install is required
to run this project.**

### The two pure engines

Isolated from Express, from Mongo, from everything. No I/O, no dates, no
randomness — which is exactly why they are the easiest part of the system to
trust.

| Engine | Input | Output | Hard invariant |
|---|---|---|---|
| `computeSplit` | amount + split mode + participants | per-person share | shares sum **exactly** to the amount — no cent created or destroyed |
| `simplifyDebts` | net balance per person | list of transfers | everyone lands on zero, in **at most `n-1`** transfers |

### Money

All monetary values are **integers in minor units** (cents). Floating-point
currency is the single most common bug class in this domain; `0.1 + 0.2 !== 0.3`
has no place in a ledger. The API accepts and returns integer cents; only the
Angular layer formats them for humans.

### Split modes

| Mode | Participant value means | Remainder handling |
|---|---|---|
| `EQUAL` | — | leftover cents go to the first participants in a deterministic order |
| `EXACT` | exact cents owed | must sum to the total, else `422` |
| `PERCENTAGE` | basis points (10000 = 100%) | largest-remainder method |
| `SHARES` | relative weight | largest-remainder method |

## 3. Method: contract before code

Tests are written **first, and committed while still failing**, as an executable
specification. Implementation then moves them to green without editing them.

The git history is the evidence: each `test(...)` commit lands red, and the
`feat(...)` commit that follows turns it green. The tests are not a
rationalisation written after the fact.

- **Backend** — Jest, with `mongodb-memory-server` so integration tests need no
  running database, and `supertest` driving the real Express app.
- **Frontend** — Playwright against the full Docker stack.

## 4. Subtasks

Each row is one commit, pushed as it lands.

| # | Subtask | Commit | State after |
|---|---|---|---|
| 01 | Repo foundation — README, this plan, licence, editor + git config | `chore: project foundation` | — |
| 02 | Backend toolchain — TypeScript, ESLint, Jest, package manifest | `chore(backend): toolchain` | — |
| 03 | **Contract** — domain types + unit tests for both engines | `test(backend): domain contract` | 🔴 red |
| 04 | **Contract** — REST API integration tests | `test(backend): api contract` | 🔴 red |
| 05 | **Contract** — Playwright end-to-end specs | `test(e2e): frontend contract` | 🔴 red |
| 06 | Domain engines implemented | `feat(backend): split and settlement engines` | 🟢 03 green |
| 07 | Mongoose models, auth, services, routes | `feat(backend): rest api` | 🟢 04 green |
| 08 | Backend container + Mongo compose service | `build: dockerize backend` | — |
| 09 | Angular application | `feat(frontend): angular client` | — |
| 10 | Frontend container, nginx, full compose stack | `build: dockerize frontend` | 🟢 05 green |
| 11 | CI/CD — lint, unit, integration, e2e, image build | `ci: github actions pipeline` | — |
| 12 | Full validation run + documented results | `docs: validation report` | ✅ all green |

## 5. API contract

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
| `GET` | `/health` | liveness probe |

Errors are uniform: `{ "error": { "code": "...", "message": "...", "details": [...] } }`.

## 6. Definition of done

- [ ] `docker compose up` yields a working app with zero host dependencies beyond Docker
- [ ] Backend unit + integration tests pass, with meaningful coverage of both engines
- [ ] Playwright specs pass against the containerised stack
- [ ] CI runs every check on push and pull request
- [ ] README explains the design decisions, not just the commands
