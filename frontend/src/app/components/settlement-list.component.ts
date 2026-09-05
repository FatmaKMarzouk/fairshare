import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Transfer } from '../core/models';
import { formatAmount } from '../core/money';

@Component({
  selector: 'fs-settlement-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (transfers().length === 0) {
      <p class="empty" data-testid="settle-empty">
        Everyone is square. Nothing to pay.
      </p>
    } @else {
      <p class="muted intro">
        {{ transfers().length }}
        {{ transfers().length === 1 ? 'payment settles' : 'payments settle' }} the whole group.
      </p>

      <ul class="list">
        @for (transfer of transfers(); track $index) {
          <li class="item" data-testid="transfer-row">
            <span class="from">{{ transfer.fromName }}</span>
            <span class="arrow" aria-label="pays">→</span>
            <span class="to">{{ transfer.toName }}</span>
            <span class="amount value">{{ currency() }} {{ format(transfer.amountMinor) }}</span>
          </li>
        }
      </ul>
    }
  `,
  styles: [
    `
      .intro {
        margin-bottom: 10px;
        font-size: 0.85rem;
      }

      .list {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 11px 0;
        border-bottom: 1px solid var(--border);
      }

      .item:last-child {
        border-bottom: none;
      }

      .from,
      .to {
        font-weight: 500;
      }

      .arrow {
        color: var(--text-faint);
      }

      .value {
        margin-left: auto;
        font-weight: 600;
        white-space: nowrap;
      }
    `,
  ],
})
export class SettlementListComponent {
  readonly transfers = input.required<Transfer[]>();
  readonly currency = input.required<string>();

  protected format(minor: number): string {
    return formatAmount(minor);
  }
}
