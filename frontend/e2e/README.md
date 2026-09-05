# End-to-end contract

These specs were written before the Angular application existed. They are the
brief the interface has to satisfy, not a description of what it happens to do.

They run against the containerised stack, so what is verified is the built
bundle served by nginx talking to the real API and a real database — not a dev
server with mocks.

```bash
docker compose up -d --build
npx playwright test
```

## Selectors

Everything is addressed by `data-testid`. Nothing keys off CSS classes, DOM
structure or visible copy, so the interface can be restyled or reworded freely;
only a genuine change in what the interface *offers* should break these tests.

### Shell

| Test id | Element |
|---|---|
| `nav-user-name` | signed-in user's name |
| `nav-logout` | log out control |

### Register and login

| Test id | Element |
|---|---|
| `register-name`, `register-email`, `register-password` | registration fields |
| `register-submit` | disabled until the form is valid |
| `login-email`, `login-password`, `login-submit` | login fields |
| `form-error` | server-side failure, shown on the form itself |

### Group list

| Test id | Element |
|---|---|
| `groups-empty` | shown only when the user has no groups |
| `group-card` | one per group, containing its name |
| `create-group-name`, `create-group-currency`, `create-group-submit` | creation form |

### Group detail

| Test id | Element |
|---|---|
| `group-name` | heading |
| `member-chip` | one per member, containing their name |
| `add-member-email`, `add-member-submit` | add a member by address |
| `add-member-error` | shown when the address is not registered |
| `tab-expenses`, `tab-balances`, `tab-settle` | the three views |

### Expenses

| Test id | Element |
|---|---|
| `expense-description`, `expense-amount` | amount is typed in major units |
| `expense-paid-by` | select, options labelled with member names |
| `expense-split-mode` | select, values `EQUAL`, `EXACT`, `PERCENTAGE`, `SHARES` |
| `expense-submit` | disabled until the form is valid |
| `expense-row` | one per expense, newest first |
| `expense-delete` | inside a row |
| `expense-error` | server-side rejection |

### Balances and settlement

| Test id | Element | Notes |
|---|---|---|
| `balance-row` | one per member | carries `data-net-minor`, the exact signed cent value |
| `transfer-row` | one per payment in the plan | names both parties and the amount |
| `settle-empty` | shown only when nobody owes anything | |

`data-net-minor` exists so the tests can assert on exact integer cents rather
than parsing formatted currency, which would make them dependent on locale and
on how the amount happens to be rendered.

## Conventions

Each test creates its own accounts, with addresses made unique at runtime. The
suite therefore runs repeatedly against a database that is never reset, and a
failed run leaves nothing behind that breaks the next one.

Where a test needs a second person, it registers them in a separate browser
context. Sharing a context would share a session, which is precisely what those
tests are checking is not the case.
