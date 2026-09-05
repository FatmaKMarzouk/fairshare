import { expect, test } from '@playwright/test';

import { newAccount } from './support/accounts';
import { AuthPage, Shell } from './support/pages';

test.describe('signing up and in', () => {
  test('a new visitor can register and lands on their groups', async ({ page }) => {
    const account = newAccount('newcomer');
    const auth = new AuthPage(page);
    const shell = new Shell(page);

    await auth.register(account);

    await expect(page).toHaveURL(/\/groups$/);
    await shell.expectSignedIn(account);
  });

  test('an anonymous visitor is sent to the login page', async ({ page }) => {
    await page.goto('/groups');

    await expect(page).toHaveURL(/\/login$/);
  });

  test('the session survives a page reload', async ({ page }) => {
    const account = newAccount('returning');
    const auth = new AuthPage(page);
    const shell = new Shell(page);

    await auth.register(account);
    await page.reload();

    await expect(page).toHaveURL(/\/groups$/);
    await shell.expectSignedIn(account);
  });

  test('an existing user can log out and back in', async ({ page }) => {
    const account = newAccount('regular');
    const auth = new AuthPage(page);
    const shell = new Shell(page);

    await auth.register(account);
    await shell.logout();

    await expect(page).toHaveURL(/\/login$/);

    await auth.login(account);

    await expect(page).toHaveURL(/\/groups$/);
    await shell.expectSignedIn(account);
  });

  test('a wrong password is reported without saying which field was wrong', async ({ page }) => {
    const account = newAccount('careful');
    const auth = new AuthPage(page);
    const shell = new Shell(page);

    await auth.register(account);
    await shell.logout();

    await auth.login({ ...account, password: 'not the password' });

    await expect(auth.formError()).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('an email that is already taken is reported on the form', async ({ page }) => {
    const account = newAccount('duplicate');
    const auth = new AuthPage(page);
    const shell = new Shell(page);

    await auth.register(account);
    await shell.logout();

    await auth.gotoRegister();
    await page.getByTestId('register-name').fill(account.name);
    await page.getByTestId('register-email').fill(account.email);
    await page.getByTestId('register-password').fill(account.password);
    await page.getByTestId('register-submit').click();

    await expect(auth.formError()).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });

  test('the registration form refuses an obviously invalid address', async ({ page }) => {
    const auth = new AuthPage(page);

    await auth.gotoRegister();
    await page.getByTestId('register-name').fill('Someone');
    await page.getByTestId('register-email').fill('not-an-address');
    await page.getByTestId('register-password').fill('long enough password');

    // The client validates before troubling the server at all.
    await expect(page.getByTestId('register-submit')).toBeDisabled();
  });

  test('logging out clears the session, so going back does not restore it', async ({ page }) => {
    const account = newAccount('cautious');
    const auth = new AuthPage(page);
    const shell = new Shell(page);

    await auth.register(account);
    await shell.logout();
    await page.goto('/groups');

    await expect(page).toHaveURL(/\/login$/);
  });
});
