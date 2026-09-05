import { expect, Page, test } from '@playwright/test';

import { Account, newAccount } from './support/accounts';
import { AuthPage, GroupPage, GroupsPage } from './support/pages';

async function registerElsewhere(
  browser: { newContext(): Promise<{ newPage(): Promise<Page>; close(): Promise<void> }> },
  account: Account,
): Promise<void> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await new AuthPage(page).register(account);
  await context.close();
}

test.describe('balances and settling up', () => {
  test('a group with no expenses shows everyone at zero and nothing to settle', async ({
    page,
    browser,
  }) => {
    const friend = newAccount('quiet');
    await registerElsewhere(browser, friend);

    await new AuthPage(page).register(newAccount('starter'));
    await new GroupsPage(page).create('Nothing spent');
    const group = new GroupPage(page);
    await group.addMember(friend.email);

    await group.openTab('balances');
    await expect(group.balanceRows()).toHaveCount(2);

    await group.openTab('settle');
    await expect(group.settledNotice()).toBeVisible();
    await expect(group.transferRows()).toHaveCount(0);
  });

  test('one person paying for three produces two debts and two transfers', async ({
    page,
    browser,
  }) => {
    const bob = newAccount('bob');
    const carol = newAccount('carol');
    await registerElsewhere(browser, bob);
    await registerElsewhere(browser, carol);

    const alice = newAccount('alice');
    await new AuthPage(page).register(alice);
    await new GroupsPage(page).create('Dinner');
    const group = new GroupPage(page);
    await group.addMember(bob.email);
    await group.addMember(carol.email);

    await group.addExpense({ description: 'Restaurant', amount: '30.00' });

    await group.openTab('balances');
    await expect(group.balanceFor(alice.name)).toHaveAttribute('data-net-minor', '2000');
    await expect(group.balanceFor(bob.name)).toHaveAttribute('data-net-minor', '-1000');
    await expect(group.balanceFor(carol.name)).toHaveAttribute('data-net-minor', '-1000');

    await group.openTab('settle');
    await expect(group.transferRows()).toHaveCount(2);
    await expect(group.settledNotice()).toBeHidden();

    // Both debtors pay the person who is owed, directly.
    for (const row of await group.transferRows().all()) {
      await expect(row).toContainText(alice.name);
      await expect(row).toContainText('10.00');
    }
  });

  test('offsetting expenses cancel out and need no transfer at all', async ({ page, browser }) => {
    const friend = newAccount('evens');
    await registerElsewhere(browser, friend);

    const owner = newAccount('balanced');
    await new AuthPage(page).register(owner);
    await new GroupsPage(page).create('Even split');
    const group = new GroupPage(page);
    await group.addMember(friend.email);

    // Each pays the same amount for the pair, so nobody ends up owing anybody.
    await group.addExpense({ description: 'Owner paid', amount: '20.00' });
    await group.addExpense({
      description: 'Friend paid',
      amount: '20.00',
      paidBy: friend.name,
    });

    await group.openTab('balances');
    const nets = await group
      .balanceRows()
      .evaluateAll((rows) => rows.map((row) => Number(row.getAttribute('data-net-minor'))));
    expect(nets.every((net) => net === 0)).toBe(true);

    await group.openTab('settle');
    await expect(group.settledNotice()).toBeVisible();
    await expect(group.transferRows()).toHaveCount(0);
  });

  test('a settlement plan never asks for more transfers than members less one', async ({
    page,
    browser,
  }) => {
    const others = [newAccount('m1'), newAccount('m2'), newAccount('m3')];
    for (const account of others) {
      await registerElsewhere(browser, account);
    }

    await new AuthPage(page).register(newAccount('host'));
    await new GroupsPage(page).create('Four people');
    const group = new GroupPage(page);
    for (const account of others) {
      await group.addMember(account.email);
    }

    await group.addExpense({ description: 'Rent', amount: '100.00' });
    await group.addExpense({ description: 'Power', amount: '40.00', paidBy: others[0].name });
    await group.addExpense({ description: 'Water', amount: '13.33', paidBy: others[1].name });

    await group.openTab('settle');

    const transfers = await group.transferRows().count();
    expect(transfers).toBeLessThanOrEqual(3);
    expect(transfers).toBeGreaterThan(0);
  });

  test('balances update as soon as an expense is added', async ({ page, browser }) => {
    const friend = newAccount('watcher');
    await registerElsewhere(browser, friend);

    const owner = newAccount('spender');
    await new AuthPage(page).register(owner);
    await new GroupsPage(page).create('Live updates');
    const group = new GroupPage(page);
    await group.addMember(friend.email);

    await group.openTab('balances');
    await expect(group.balanceFor(owner.name)).toHaveAttribute('data-net-minor', '0');

    await group.openTab('expenses');
    await group.addExpense({ description: 'Coffee', amount: '9.00' });

    await group.openTab('balances');
    await expect(group.balanceFor(owner.name)).toHaveAttribute('data-net-minor', '450');
    await expect(group.balanceFor(friend.name)).toHaveAttribute('data-net-minor', '-450');
  });
});
