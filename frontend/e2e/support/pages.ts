import { expect, Locator, Page } from '@playwright/test';

import { Account } from './accounts';

/**
 * Page objects.
 *
 * Every selector the suite relies on lives here, addressed by `data-testid`
 * rather than by text or CSS class. Copy changes and restyling then cannot
 * break the tests, while a genuine change to the interface breaks them in one
 * obvious place.
 */

export class AuthPage {
  constructor(private readonly page: Page) {}

  async gotoRegister(): Promise<void> {
    await this.page.goto('/register');
  }

  async gotoLogin(): Promise<void> {
    await this.page.goto('/login');
  }

  async register(account: Account): Promise<void> {
    await this.gotoRegister();
    await this.page.getByTestId('register-name').fill(account.name);
    await this.page.getByTestId('register-email').fill(account.email);
    await this.page.getByTestId('register-password').fill(account.password);
    await this.page.getByTestId('register-submit').click();
    await this.page.waitForURL('**/groups');
  }

  async login(account: Account): Promise<void> {
    await this.gotoLogin();
    await this.page.getByTestId('login-email').fill(account.email);
    await this.page.getByTestId('login-password').fill(account.password);
    await this.page.getByTestId('login-submit').click();
  }

  formError(): Locator {
    return this.page.getByTestId('form-error');
  }
}

export class GroupsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/groups');
  }

  async create(name: string, currency = 'CHF'): Promise<void> {
    await this.page.getByTestId('create-group-name').fill(name);
    await this.page.getByTestId('create-group-currency').fill(currency);
    await this.page.getByTestId('create-group-submit').click();
    await this.page.waitForURL(/\/groups\/[a-f0-9]{24}$/);
  }

  cards(): Locator {
    return this.page.getByTestId('group-card');
  }

  cardNamed(name: string): Locator {
    return this.cards().filter({ hasText: name });
  }

  empty(): Locator {
    return this.page.getByTestId('groups-empty');
  }
}

export class GroupPage {
  constructor(private readonly page: Page) {}

  title(): Locator {
    return this.page.getByTestId('group-name');
  }

  members(): Locator {
    return this.page.getByTestId('member-chip');
  }

  async addMember(email: string): Promise<void> {
    await this.page.getByTestId('add-member-email').fill(email);
    await this.page.getByTestId('add-member-submit').click();
  }

  memberError(): Locator {
    return this.page.getByTestId('add-member-error');
  }

  /**
   * Records an expense. `amount` is written the way a person would type it,
   * in major units, because converting that to cents is the client's job and
   * part of what these tests are checking.
   */
  async addExpense(options: {
    description: string;
    amount: string;
    paidBy?: string;
    splitMode?: 'EQUAL' | 'EXACT' | 'PERCENTAGE' | 'SHARES';
  }): Promise<void> {
    await this.page.getByTestId('expense-description').fill(options.description);
    await this.page.getByTestId('expense-amount').fill(options.amount);

    if (options.paidBy) {
      await this.page.getByTestId('expense-paid-by').selectOption({ label: options.paidBy });
    }
    if (options.splitMode) {
      await this.page.getByTestId('expense-split-mode').selectOption(options.splitMode);
    }

    await this.page.getByTestId('expense-submit').click();
  }

  expenseRows(): Locator {
    return this.page.getByTestId('expense-row');
  }

  expenseNamed(description: string): Locator {
    return this.expenseRows().filter({ hasText: description });
  }

  expenseError(): Locator {
    return this.page.getByTestId('expense-error');
  }

  async openTab(tab: 'expenses' | 'balances' | 'settle'): Promise<void> {
    await this.page.getByTestId(`tab-${tab}`).click();
  }

  balanceRows(): Locator {
    return this.page.getByTestId('balance-row');
  }

  balanceFor(name: string): Locator {
    return this.balanceRows().filter({ hasText: name });
  }

  transferRows(): Locator {
    return this.page.getByTestId('transfer-row');
  }

  settledNotice(): Locator {
    return this.page.getByTestId('settle-empty');
  }
}

export class Shell {
  constructor(private readonly page: Page) {}

  userName(): Locator {
    return this.page.getByTestId('nav-user-name');
  }

  async logout(): Promise<void> {
    await this.page.getByTestId('nav-logout').click();
    await this.page.waitForURL('**/login');
  }

  async expectSignedIn(account: Account): Promise<void> {
    await expect(this.userName()).toContainText(account.name);
  }
}
