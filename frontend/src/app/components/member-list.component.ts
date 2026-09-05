import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { inject } from '@angular/core';

import { User } from '../core/models';

@Component({
  selector: 'fs-member-list',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <ul class="chips">
        @for (member of members(); track member.id) {
          <li class="chip" data-testid="member-chip" [title]="member.email">
            <span class="initial" aria-hidden="true">{{ member.name.charAt(0) }}</span>
            {{ member.name }}
          </li>
        }
      </ul>

      <form class="add" [formGroup]="form" (ngSubmit)="add()">
        <input
          type="email"
          placeholder="Add someone by email"
          formControlName="email"
          data-testid="add-member-email"
          aria-label="Email address of the person to add"
        />
        <button
          type="submit"
          class="secondary"
          [disabled]="form.invalid || busy()"
          data-testid="add-member-submit"
        >
          Add
        </button>
      </form>

      @if (error()) {
        <p class="error" data-testid="add-member-error">{{ error() }}</p>
      }
    </div>
  `,
  styles: [
    `
      .wrap {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .chips {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .chip {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 4px 11px 4px 4px;
        border-radius: 999px;
        background: var(--surface-sunken);
        border: 1px solid var(--border);
        font-size: 0.83rem;
      }

      .initial {
        display: grid;
        place-items: center;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--accent);
        color: var(--accent-contrast);
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
      }

      .add {
        display: flex;
        gap: 8px;
      }

      .add input {
        flex: 1 1 auto;
      }
    `,
  ],
})
export class MemberListComponent {
  readonly members = input.required<User[]>();
  readonly error = input<string | null>(null);
  readonly busy = input(false);

  readonly added = output<string>();

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected add(): void {
    if (this.form.invalid) {
      return;
    }

    this.added.emit(this.form.getRawValue().email);
    this.form.reset({ email: '' });
  }
}
