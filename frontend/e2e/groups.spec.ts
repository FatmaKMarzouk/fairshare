import { expect, test } from '@playwright/test';

import { newAccount } from './support/accounts';
import { AuthPage, GroupPage, GroupsPage, Shell } from './support/pages';

test.describe('groups', () => {
  test('a new account has no groups and is told so', async ({ page }) => {
    const auth = new AuthPage(page);
    const groups = new GroupsPage(page);

    await auth.register(newAccount('empty'));

    await expect(groups.empty()).toBeVisible();
    await expect(groups.cards()).toHaveCount(0);
  });

  test('creating a group opens it, with the creator already a member', async ({ page }) => {
    const account = newAccount('founder');
    const auth = new AuthPage(page);
    const groups = new GroupsPage(page);
    const group = new GroupPage(page);

    await auth.register(account);
    await groups.create('Ski trip');

    await expect(group.title()).toContainText('Ski trip');
    await expect(group.members()).toHaveCount(1);
    await expect(group.members().first()).toContainText(account.name);
  });

  test('a created group appears in the list afterwards', async ({ page }) => {
    const auth = new AuthPage(page);
    const groups = new GroupsPage(page);

    await auth.register(newAccount('lister'));
    await groups.create('Flat share');
    await groups.goto();

    await expect(groups.cardNamed('Flat share')).toBeVisible();
    await expect(groups.empty()).toBeHidden();
  });

  test('a member added by email can see the group', async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const friendContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const friendPage = await friendContext.newPage();

    const owner = newAccount('owner');
    const friend = newAccount('friend');

    // The friend has to exist before they can be added.
    await new AuthPage(friendPage).register(friend);

    await new AuthPage(ownerPage).register(owner);
    await new GroupsPage(ownerPage).create('Shared flat');
    await new GroupPage(ownerPage).addMember(friend.email);

    await expect(new GroupPage(ownerPage).members()).toHaveCount(2);

    await new GroupsPage(friendPage).goto();
    await expect(new GroupsPage(friendPage).cardNamed('Shared flat')).toBeVisible();

    await ownerContext.close();
    await friendContext.close();
  });

  test('adding an unknown email address is reported, not silently ignored', async ({ page }) => {
    const auth = new AuthPage(page);
    const groups = new GroupsPage(page);
    const group = new GroupPage(page);

    await auth.register(newAccount('inviter'));
    await groups.create('Book club');
    await group.addMember('definitely.nobody@example.test');

    await expect(group.memberError()).toBeVisible();
    await expect(group.members()).toHaveCount(1);
  });

  test('one account cannot see another account groups', async ({ browser }) => {
    const firstContext = await browser.newContext();
    const secondContext = await browser.newContext();
    const firstPage = await firstContext.newPage();
    const secondPage = await secondContext.newPage();

    await new AuthPage(firstPage).register(newAccount('private'));
    await new GroupsPage(firstPage).create('Secret plans');

    await new AuthPage(secondPage).register(newAccount('nosy'));
    await new GroupsPage(secondPage).goto();

    await expect(new GroupsPage(secondPage).cardNamed('Secret plans')).toHaveCount(0);
    await expect(new GroupsPage(secondPage).empty()).toBeVisible();

    await firstContext.close();
    await secondContext.close();
  });
});
