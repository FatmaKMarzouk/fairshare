import { expect, Page, test } from '@playwright/test';

import { Account, newAccount } from './support/accounts';
import { AuthPage, GroupPage, GroupsPage } from './support/pages';

/**
 * Sets up an account with a group, plus optional extra members who each need a
 * real account of their own first.
 */
async function setUpGroup(
  page: Page,
  browser: { newContext(): Promise<{ newPage(): Promise<Page>; close(): Promise<void> }> },
  options: { name: string; friends?: number } = { name: 'Flat share' },
): Promise<{ owner: Account; friends: Account[] }> {
  const friends: Account[] = [];

  for (let index = 0; index < (options.friends ?? 0); index += 1) {
    const friend = newAccount(`housemate${index}`);
    const context = await browser.newContext();
    const friendPage = await context.newPage();
    await new AuthPage(friendPage).register(friend);
    await context.close();
    friends.push(friend);
  }

  const owner = newAccount('payer');
  await new AuthPage(page).register(owner);
  await new GroupsPage(page).create(options.name);

  const group = new GroupPage(page);
  for (const friend of friends) {
    await group.addMember(friend.email);
  }

  return { owner, friends };
}

test.describe('recording expenses', () => {
  test('an expense typed in major units is recorded and listed', async ({ page, browser }) => {
    await setUpGroup(page, browser, { name: 'Groceries group', friends: 1 });
    const group = new GroupPage(page);

    await group.addExpense({ description: 'Weekly shop', amount: '30.00' });

    await expect(group.expenseNamed('Weekly shop')).toBeVisible();
    // Thirty francs, formatted back out of the cents the API stores.
    await expect(group.expenseNamed('Weekly shop')).toContainText('30.00');
  });

  test('an amount with an odd cent is not silently rounded away', async ({ page, browser }) => {
    await setUpGroup(page, browser, { name: 'Odd cents', friends: 2 });
    const group = new GroupPage(page);

    await group.addExpense({ description: 'Taxi', amount: '10.01' });

    await expect(group.expenseNamed('Taxi')).toContainText('10.01');

    await group.openTab('balances');
    const total = await group
      .balanceRows()
      .evaluateAll((rows) =>
        rows
          .map((row) => Number(row.getAttribute('data-net-minor')))
          .reduce((sum, value) => sum + value, 0),
      );

    // Whatever the rounding, the group as a whole must still net to zero.
    expect(total).toBe(0);
  });

  test('a newly added expense appears at the top of the list', async ({ page, browser }) => {
    await setUpGroup(page, browser, { name: 'Ordering', friends: 1 });
    const group = new GroupPage(page);

    await group.addExpense({ description: 'First thing', amount: '10.00' });
    await expect(group.expenseNamed('First thing')).toBeVisible();

    await group.addExpense({ description: 'Second thing', amount: '20.00' });
    await expect(group.expenseNamed('Second thing')).toBeVisible();

    await expect(group.expenseRows().first()).toContainText('Second thing');
  });

  test('the form refuses to submit an empty description', async ({ page, browser }) => {
    await setUpGroup(page, browser, { name: 'Validation', friends: 1 });

    await page.getByTestId('expense-amount').fill('10.00');

    await expect(page.getByTestId('expense-submit')).toBeDisabled();
  });

  test('the form refuses an amount of zero', async ({ page, browser }) => {
    await setUpGroup(page, browser, { name: 'Zero', friends: 1 });

    await page.getByTestId('expense-description').fill('Nothing at all');
    await page.getByTestId('expense-amount').fill('0');

    await expect(page.getByTestId('expense-submit')).toBeDisabled();
  });

  test('deleting an expense removes it and restores the balances', async ({ page, browser }) => {
    await setUpGroup(page, browser, { name: 'Deletions', friends: 1 });
    const group = new GroupPage(page);

    await group.addExpense({ description: 'Mistake', amount: '50.00' });
    await expect(group.expenseNamed('Mistake')).toBeVisible();

    await group.expenseNamed('Mistake').getByTestId('expense-delete').click();

    await expect(group.expenseNamed('Mistake')).toHaveCount(0);

    await group.openTab('balances');
    const nets = await group
      .balanceRows()
      .evaluateAll((rows) => rows.map((row) => Number(row.getAttribute('data-net-minor'))));

    expect(nets.every((net) => net === 0)).toBe(true);
  });

  test('every member sees an expense another member recorded', async ({ page, browser }) => {
    const friend = newAccount('observer');
    const friendContext = await browser.newContext();
    const friendPage = await friendContext.newPage();
    await new AuthPage(friendPage).register(friend);

    await new AuthPage(page).register(newAccount('recorder'));
    await new GroupsPage(page).create('Shared visibility');
    const group = new GroupPage(page);
    await group.addMember(friend.email);
    await group.addExpense({ description: 'Internet bill', amount: '60.00' });

    const groupUrl = page.url();
    await friendPage.goto(groupUrl);

    await expect(new GroupPage(friendPage).expenseNamed('Internet bill')).toBeVisible();

    await friendContext.close();
  });
});
