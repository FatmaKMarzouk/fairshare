import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Expense, User } from '../core/models';
import { formatAmount } from '../core/money';

@Component({
  selector: 'fs-expense-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (expenses().length === 0) {
      <p class="empty" data-testid="expenses-empty">
        Nothing recorded yet. Add the first expense above.
      </p>
    } @else {
      <ul class="list">
        @for (expense of expenses(); track expense.id) {
          <li class="item" data-testid="expense-row">
            <div class="main">
              <span class="what">{{ expense.description }}</span>
              <span class="muted who">
                {{ nameOf(expense.paidBy) }} paid · split
                {{ modeLabel(expense.splitMode) }} between
                {{ expense.shares.length }}
              </span>
            </div>

            <span class="amount total">{{ currency() }} {{ format(expense.amountMinor) }}</span>

            <button
              type="button"
              class="quiet remove"
              data-testid="expense-delete"
              [attr.aria-label]="'Delete ' + expense.description"
              (click)="removed.emit(expense.id)"
            >
              ✕
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: [
    `
      .list {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 0;
        border-bottom: 1px solid var(--border);
      }

      .item:last-child {
        border-bottom: none;
      }

      .main {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .what {
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .who {
        font-size: 0.79rem;
      }

      .total {
        font-weight: 600;
        white-space: nowrap;
      }

      .remove {
        font-size: 0.8rem;
        line-height: 1;
      }
    `,
  ],
})
export class ExpenseListComponent {
  readonly expenses = input.required<Expense[]>();
  readonly members = input.required<User[]>();
  readonly currency = input.required<string>();

  readonly removed = output<string>();

  protected format(minor: number): string {
    return formatAmount(minor);
  }

  protected nameOf(userId: string): string {
    return this.members().find((member) => member.id === userId)?.name ?? 'Someone';
  }

  protected modeLabel(mode: Expense['splitMode']): string {
    switch (mode) {
      case 'EQUAL':
        return 'equally';
      case 'EXACT':
        return 'by amount';
      case 'PERCENTAGE':
        return 'by percentage';
      case 'SHARES':
        return 'by shares';
    }
  }
}
