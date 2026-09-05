# Validation

What was run, and what it reported. Every figure below comes from an actual run
against the containerised stack, not from an estimate.

## Totals

| Suite | Tests | Result |
|---|---|---|
| Backend unit — domain engines | 108 | pass |
| Backend integration — REST API | 70 | pass |
| End-to-end — Playwright | 26 | pass |
| **Total** | **204** | **pass** |

Lint and the type checker are clean on both projects, and both production
builds succeed.

## Coverage

Thresholds are enforced only where they mean something. The domain engines are
held to 100 percent; the plumbing around them is measured but not gated, since
a percentage there mostly counts how much plumbing there is.

| Area | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `src/domain` | 100 | 100 | 100 | 100 |
| Whole backend | 96.4 | 79.6 | 95.4 | 96.3 |

## End-to-end stability

The suite was run three times in a row against the same stack, with no reset
between runs. Twenty-six passes each time. Each test creates its own accounts,
so a database that is never cleaned does not accumulate anything that breaks a
later run.

## What the contract caught

The tests were written before the code and committed while failing, so the
value of that is worth stating concretely. These are bugs the suites found, not
hypotheticals.

**A test that never ran.** `money.test.ts` had a type error, so ts-jest never
compiled it. Jest reported the other two unit files as passing and said nothing
about the third. Thirty-five cases were silently absent from every run until the
implementation commit. Worth remembering: a green suite is only evidence about
the tests that were actually executed.

**A circular dependency, visible only on a real page load.** `AuthService`
confirmed a stored token from inside its own constructor, and the HTTP
interceptor injected `AuthService` to read that token. Nothing went wrong until
a browser loaded the app with a session already in localStorage — then the
injector was asked for a service it had not finished building. Eight end-to-end
tests failed together; no unit test would have been looking.

**A form that appeared to work and sent nothing.** The expense form used
`ngSubmit` without importing a forms module, so nothing was listening and the
browser submitted the form natively. The page reloaded, the fields cleared, and
the result looked exactly like a successful save. The API log was empty. Only a
test asserting the expense afterwards catches this.

**A contract that contradicted itself.** One settlement test asserted exact
object equality on transfers while its neighbour required participant names on
those same objects. Both could not hold. Resolved in favour of the richer shape,
and recorded in the commit rather than quietly edited.

**A race in a test, not in the code.** The page object returned as soon as it
clicked submit, so a test adding two expenses could start the second before the
first had landed. It passed most of the time. Fixed by having the page object
wait for the expense to appear, which is what "add an expense" should mean.

## Reproducing

```bash
docker compose up -d --build

# backend, inside the container
docker compose run --rm api npm test

# end-to-end, against the running stack
npx playwright test
```

The backend suite needs nothing installed: it starts its own MongoDB in process
unless `TEST_MONGO_URL` points it at one.
