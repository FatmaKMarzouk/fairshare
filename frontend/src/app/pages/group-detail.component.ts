import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { BalanceListComponent } from '../components/balance-list.component';
import { ExpenseFormComponent } from '../components/expense-form.component';
import { ExpenseListComponent } from '../components/expense-list.component';
import { MemberListComponent } from '../components/member-list.component';
import { SettlementListComponent } from '../components/settlement-list.component';
import { ApiService, describeError, ExpenseDraft } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { Balance, Expense, Group, Transfer } from '../core/models';

type Tab = 'expenses' | 'balances' | 'settle';

@Component({
  selector: 'fs-group-detail',
  standalone: true,
  imports: [
    MemberListComponent,
    ExpenseFormComponent,
    ExpenseListComponent,
    BalanceListComponent,
    SettlementListComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (group(); as current) {
      <div class="stack">
        <div>
          <h1 data-testid="group-name">{{ current.name }}</h1>
          <p class="muted sub">{{ current.currency }}</p>
        </div>

        <section class="card pad">
          <h2 class="section-title">Members</h2>
          <fs-member-list
            [members]="current.members"
            [error]="memberError()"
            [busy]="busy()"
            (added)="addMember($event)"
          />
        </section>

        <nav class="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            class="tab"
            [class.active]="tab() === 'expenses'"
            [attr.aria-selected]="tab() === 'expenses'"
            data-testid="tab-expenses"
            (click)="tab.set('expenses')"
          >
            Expenses
          </button>
          <button
            type="button"
            role="tab"
            class="tab"
            [class.active]="tab() === 'balances'"
            [attr.aria-selected]="tab() === 'balances'"
            data-testid="tab-balances"
            (click)="tab.set('balances')"
          >
            Balances
          </button>
          <button
            type="button"
            role="tab"
            class="tab"
            [class.active]="tab() === 'settle'"
            [attr.aria-selected]="tab() === 'settle'"
            data-testid="tab-settle"
            (click)="tab.set('settle')"
          >
            Settle up
          </button>
        </nav>

        @switch (tab()) {
          @case ('expenses') {
            <section class="card pad">
              <h2 class="section-title">Add an expense</h2>
              <fs-expense-form
                [members]="current.members"
                [currency]="current.currency"
                [defaultPayerId]="auth.user()?.id ?? null"
                [error]="expenseError()"
                [busy]="busy()"
                (submitted)="addExpense($event)"
              />
            </section>

            <section class="card pad">
              <h2 class="section-title">Recorded</h2>
              <fs-expense-list
                [expenses]="expenses()"
                [members]="current.members"
                [currency]="current.currency"
                (removed)="removeExpense($event)"
              />
            </section>
          }

          @case ('balances') {
            <section class="card pad">
              <h2 class="section-title">Where everyone stands</h2>
              <fs-balance-list [balances]="balances()" [currency]="current.currency" />
            </section>
          }

          @case ('settle') {
            <section class="card pad">
              <h2 class="section-title">Settle up</h2>
              <fs-settlement-list [transfers]="transfers()" [currency]="current.currency" />
            </section>
          }
        }
      </div>
    } @else if (loadError()) {
      <div class="card pad stack">
        <p class="error">{{ loadError() }}</p>
        <div>
          <button type="button" class="secondary" (click)="backToGroups()">
            Back to your groups
          </button>
        </div>
      </div>
    } @else {
      <p class="empty">Loading…</p>
    }
  `,
  styles: [
    `
      .sub {
        margin-top: 2px;
        font-size: 0.82rem;
        letter-spacing: 0.04em;
      }

      .pad {
        padding: 18px;
      }

      .section-title {
        margin-bottom: 12px;
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-muted);
      }

      .tabs {
        display: flex;
        gap: 4px;
        padding: 4px;
        background: var(--surface-sunken);
        border: 1px solid var(--border);
        border-radius: var(--radius);
      }

      .tab {
        flex: 1 1 0;
        background: transparent;
        border: none;
        color: var(--text-muted);
        font-size: 0.87rem;
        padding: 7px 12px;
        border-radius: var(--radius-sm);
      }

      .tab:hover:not(.active) {
        background: var(--surface);
        color: var(--text);
      }

      .tab.active {
        background: var(--surface);
        color: var(--text);
        font-weight: 500;
        box-shadow: var(--shadow);
      }
    `,
  ],
})
export class GroupDetailComponent implements OnInit {
  /** Bound from the route parameter by withComponentInputBinding. */
  readonly id = input.required<string>();

  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  protected readonly group = signal<Group | null>(null);
  protected readonly expenses = signal<Expense[]>([]);
  protected readonly balances = signal<Balance[]>([]);
  protected readonly transfers = signal<Transfer[]>([]);

  protected readonly tab = signal<Tab>('expenses');
  protected readonly busy = signal(false);
  protected readonly memberError = signal<string | null>(null);
  protected readonly expenseError = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  /**
   * Reloads everything after any change.
   *
   * Adding one expense moves the balances and can change the whole settlement
   * plan, so patching state locally would mean reimplementing the settlement
   * algorithm in the browser to stay consistent with it. One round trip is the
   * cheaper correctness.
   */
  private load(): void {
    const groupId = this.id();

    forkJoin({
      group: this.api.getGroup(groupId),
      expenses: this.api.listExpenses(groupId),
      balances: this.api.getBalances(groupId),
      settlement: this.api.getSettlement(groupId),
    }).subscribe({
      next: (result) => {
        this.group.set(result.group);
        this.expenses.set(result.expenses.expenses);
        this.balances.set(result.balances.balances);
        this.transfers.set(result.settlement.transfers);
        this.busy.set(false);
      },
      error: (failure: unknown) => {
        this.busy.set(false);

        if (this.group()) {
          // A refresh failed but there is still something on screen; keep it.
          this.expenseError.set(describeError(failure, 'Could not refresh the group'));
          return;
        }

        this.loadError.set(describeError(failure, 'Could not load this group'));
      },
    });
  }

  protected addMember(email: string): void {
    this.busy.set(true);
    this.memberError.set(null);

    this.api.addMember(this.id(), email).subscribe({
      next: () => this.load(),
      error: (failure: unknown) => {
        this.busy.set(false);
        this.memberError.set(describeError(failure, 'Could not add that person'));
      },
    });
  }

  protected addExpense(draft: ExpenseDraft): void {
    this.busy.set(true);
    this.expenseError.set(null);

    this.api.addExpense(this.id(), draft).subscribe({
      next: () => this.load(),
      error: (failure: unknown) => {
        this.busy.set(false);
        this.expenseError.set(describeError(failure, 'Could not record that expense'));
      },
    });
  }

  protected removeExpense(expenseId: string): void {
    this.busy.set(true);
    this.expenseError.set(null);

    this.api.deleteExpense(expenseId).subscribe({
      next: () => this.load(),
      error: (failure: unknown) => {
        this.busy.set(false);
        this.expenseError.set(describeError(failure, 'Could not delete that expense'));
      },
    });
  }

  /** Used by the template's error branch when the group cannot be reached. */
  protected backToGroups(): void {
    void this.router.navigate(['/groups']);
  }
}
