import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';

import { ExpenseDraft } from '../core/api.service';
import { SplitMode, User } from '../core/models';
import { parseAmount } from '../core/money';

interface ModeOption {
  value: SplitMode;
  label: string;
  hint: string;
  unit: string;
}

const MODES: ModeOption[] = [
  { value: 'EQUAL', label: 'Equally', hint: 'Everyone selected pays the same.', unit: '' },
  {
    value: 'EXACT',
    label: 'Exact amounts',
    hint: 'Enter what each person owes. It has to add up to the total.',
    unit: 'amount',
  },
  {
    value: 'PERCENTAGE',
    label: 'Percentages',
    hint: 'Enter each share as a percentage. They have to add up to 100.',
    unit: '%',
  },
  {
    value: 'SHARES',
    label: 'Shares',
    hint: 'Enter a weight for each person. Two shares pays twice one share.',
    unit: 'shares',
  },
];

@Component({
  selector: 'fs-expense-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="form" (ngSubmit)="submit($event)">
      <div class="line">
        <div class="grow">
          <label for="expense-description">Description</label>
          <input
            id="expense-description"
            type="text"
            placeholder="Groceries, taxi, internet bill…"
            data-testid="expense-description"
            [value]="description()"
            (input)="description.set(textOf($event))"
          />
        </div>

        <div class="amount-field">
          <label for="expense-amount">Amount</label>
          <div class="with-unit">
            <span class="unit">{{ currency() }}</span>
            <input
              id="expense-amount"
              type="text"
              inputmode="decimal"
              placeholder="0.00"
              data-testid="expense-amount"
              [value]="amount()"
              (input)="amount.set(textOf($event))"
            />
          </div>
        </div>
      </div>

      <div class="line">
        <div class="grow">
          <label for="expense-paid-by">Paid by</label>
          <select
            id="expense-paid-by"
            data-testid="expense-paid-by"
            [value]="paidBy()"
            (change)="paidBy.set(textOf($event))"
          >
            @for (member of members(); track member.id) {
              <option [value]="member.id" [selected]="member.id === paidBy()">
                {{ member.name }}
              </option>
            }
          </select>
        </div>

        <div class="grow">
          <label for="expense-split-mode">Split</label>
          <select
            id="expense-split-mode"
            data-testid="expense-split-mode"
            [value]="mode()"
            (change)="setMode(textOf($event))"
          >
            @for (option of modes; track option.value) {
              <option [value]="option.value" [selected]="option.value === mode()">
                {{ option.label }}
              </option>
            }
          </select>
        </div>
      </div>

      <div class="participants">
        <div class="participants-head">
          <span class="label-like">Who shares it</span>
          <span class="muted hint">{{ activeMode().hint }}</span>
        </div>

        <ul class="people">
          @for (member of members(); track member.id) {
            <li class="person">
              <label class="pick">
                <input
                  type="checkbox"
                  data-testid="participant-toggle"
                  [attr.data-user-id]="member.id"
                  [checked]="isSelected(member.id)"
                  (change)="toggle(member.id, checkedOf($event))"
                />
                <span>{{ member.name }}</span>
              </label>

              @if (mode() !== 'EQUAL' && isSelected(member.id)) {
                <span class="with-unit narrow">
                  <input
                    type="text"
                    inputmode="decimal"
                    data-testid="participant-value"
                    [attr.data-user-id]="member.id"
                    [attr.aria-label]="'Share for ' + member.name"
                    [value]="valueFor(member.id)"
                    (input)="setValue(member.id, textOf($event))"
                  />
                  <span class="unit trailing">{{ activeMode().unit }}</span>
                </span>
              }
            </li>
          }
        </ul>
      </div>

      @if (error()) {
        <p class="error" data-testid="expense-error">{{ error() }}</p>
      }

      <div class="actions">
        <button type="submit" [disabled]="draft() === null || busy()" data-testid="expense-submit">
          Add expense
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      .form {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .line {
        display: flex;
        gap: 12px;
      }

      .grow {
        flex: 1 1 0;
        min-width: 0;
      }

      .amount-field {
        width: 150px;
        flex: 0 0 auto;
      }

      .with-unit {
        display: flex;
        align-items: stretch;
      }

      .with-unit .unit {
        display: grid;
        place-items: center;
        padding: 0 9px;
        font-size: 0.8rem;
        color: var(--text-muted);
        background: var(--surface-sunken);
        border: 1px solid var(--border-strong);
        border-right: none;
        border-radius: var(--radius-sm) 0 0 var(--radius-sm);
        white-space: nowrap;
      }

      .with-unit .unit.trailing {
        border-right: 1px solid var(--border-strong);
        border-left: none;
        border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
      }

      .with-unit input {
        border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
      }

      .with-unit .trailing + input,
      .narrow input {
        border-radius: var(--radius-sm) 0 0 var(--radius-sm);
      }

      .narrow {
        width: 120px;
      }

      .participants-head {
        display: flex;
        align-items: baseline;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 6px;
      }

      .label-like {
        font-size: 0.8rem;
        font-weight: 500;
        color: var(--text-muted);
      }

      .hint {
        font-size: 0.78rem;
      }

      .people {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .person {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .pick {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 0.88rem;
        color: var(--text);
        font-weight: 400;
        cursor: pointer;
      }

      .pick input {
        width: auto;
        margin: 0;
        cursor: pointer;
      }

      .actions {
        display: flex;
        justify-content: flex-end;
      }

      @media (max-width: 560px) {
        .line {
          flex-wrap: wrap;
        }

        .amount-field {
          width: 100%;
        }
      }
    `,
  ],
})
export class ExpenseFormComponent {
  readonly members = input.required<User[]>();
  readonly currency = input.required<string>();
  readonly defaultPayerId = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly busy = input(false);

  readonly submitted = output<ExpenseDraft>();

  protected readonly modes = MODES;

  protected readonly description = signal('');
  protected readonly amount = signal('');
  protected readonly paidBy = signal('');
  protected readonly mode = signal<SplitMode>('EQUAL');
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly values = signal<Readonly<Record<string, string>>>({});

  protected readonly activeMode = computed(
    () => MODES.find((option) => option.value === this.mode()) ?? MODES[0],
  );

  /**
   * The expense as it currently stands, or null while it is not yet valid.
   *
   * The submit button is bound straight to this, so "can this be submitted" and
   * "what would be submitted" can never disagree.
   */
  protected readonly draft = computed<ExpenseDraft | null>(() => {
    const description = this.description().trim();
    const amountMinor = parseAmount(this.amount());
    const chosen = this.members().filter((member) => this.selected().has(member.id));

    if (!description || amountMinor === null || amountMinor <= 0 || chosen.length === 0) {
      return null;
    }

    if (!this.paidBy()) {
      return null;
    }

    const mode = this.mode();

    if (mode === 'EQUAL') {
      return {
        description,
        amountMinor,
        paidBy: this.paidBy(),
        splitMode: mode,
        participants: chosen.map((member) => ({ userId: member.id })),
      };
    }

    const participants: { userId: string; value: number }[] = [];

    for (const member of chosen) {
      const value = this.numericValue(mode, this.valueFor(member.id));

      if (value === null) {
        return null;
      }

      participants.push({ userId: member.id, value });
    }

    return {
      description,
      amountMinor,
      paidBy: this.paidBy(),
      splitMode: mode,
      participants,
    };
  });

  constructor() {
    effect(
      () => {
        const members = this.members();
        const preferred = this.defaultPayerId();

        if (members.length === 0) {
          return;
        }

        untracked(() => {
          const current = this.paidBy();

          if (!current || !members.some((member) => member.id === current)) {
            const fallback = members.some((member) => member.id === preferred)
              ? (preferred as string)
              : members[0].id;
            this.paidBy.set(fallback);
          }

          // Somebody who joins the group is in on the next expense by default;
          // unticking them stays possible, but the common case needs no clicks.
          const next = new Set(this.selected());
          for (const member of members) {
            next.add(member.id);
          }
          this.selected.set(next);
        });
      },
      { allowSignalWrites: true },
    );
  }

  protected textOf(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected checkedOf(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  protected isSelected(userId: string): boolean {
    return this.selected().has(userId);
  }

  protected toggle(userId: string, on: boolean): void {
    const next = new Set(this.selected());

    if (on) {
      next.add(userId);
    } else {
      next.delete(userId);
    }

    this.selected.set(next);
  }

  protected valueFor(userId: string): string {
    return this.values()[userId] ?? '';
  }

  protected setValue(userId: string, raw: string): void {
    this.values.set({ ...this.values(), [userId]: raw });
  }

  protected setMode(raw: string): void {
    this.mode.set(raw as SplitMode);
  }

  protected submit(event: Event): void {
    event.preventDefault();

    const draft = this.draft();

    if (!draft || this.busy()) {
      return;
    }

    this.submitted.emit(draft);

    // Keep the participants and the payer: the next expense in a session is
    // usually the same people again.
    this.description.set('');
    this.amount.set('');
    this.values.set({});
  }

  /**
   * Turns what was typed into the unit the API expects for this mode: cents for
   * exact amounts, basis points for percentages, a plain integer for shares.
   */
  private numericValue(mode: SplitMode, raw: string): number | null {
    if (mode === 'EXACT' || mode === 'PERCENTAGE') {
      return parseAmount(raw);
    }

    const parsed = Number(raw.trim());

    return Number.isSafeInteger(parsed) && parsed >= 0 && raw.trim() !== '' ? parsed : null;
  }
}
