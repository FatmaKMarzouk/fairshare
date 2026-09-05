import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Balance } from '../core/models';
import { formatAmount } from '../core/money';

@Component({
  selector: 'fs-balance-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="list">
      @for (balance of balances(); track balance.userId) {
        <li
          class="item"
          data-testid="balance-row"
          [attr.data-user-id]="balance.userId"
          [attr.data-net-minor]="balance.netMinor"
        >
          <span class="who">{{ balance.name }}</span>

          <span class="state" [class.up]="balance.netMinor > 0" [class.down]="balance.netMinor < 0">
            @if (balance.netMinor > 0) {
              is owed
            } @else if (balance.netMinor < 0) {
              owes
            } @else {
              settled up
            }
          </span>

          @if (balance.netMinor !== 0) {
            <span
              class="amount value"
              [class.up]="balance.netMinor > 0"
              [class.down]="balance.netMinor < 0"
            >
              {{ currency() }} {{ format(balance.netMinor) }}
            </span>
          }
        </li>
      }
    </ul>
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
        gap: 10px;
        padding: 11px 0;
        border-bottom: 1px solid var(--border);
      }

      .item:last-child {
        border-bottom: none;
      }

      .who {
        font-weight: 500;
        flex: 0 0 auto;
      }

      .state {
        flex: 1 1 auto;
        font-size: 0.82rem;
        color: var(--text-muted);
      }

      .value {
        font-weight: 600;
        white-space: nowrap;
      }

      .up {
        color: var(--positive);
      }

      .down {
        color: var(--negative);
      }
    `,
  ],
})
export class BalanceListComponent {
  readonly balances = input.required<Balance[]>();
  readonly currency = input.required<string>();

  protected format(minor: number): string {
    // The sign is already carried by the wording and the colour, so the number
    // itself reads better without a minus in front of it.
    return formatAmount(Math.abs(minor));
  }
}
