import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApiService, describeError } from '../core/api.service';
import { Group } from '../core/models';

@Component({
  selector: 'fs-groups',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <div>
        <h1>Your groups</h1>
        <p class="muted sub">A group is a set of people who share costs.</p>
      </div>

      <form class="card create" [formGroup]="form" (ngSubmit)="create()">
        <div class="fields">
          <div class="grow">
            <label for="group-name">Group name</label>
            <input
              id="group-name"
              type="text"
              placeholder="Flat share, ski trip, book club…"
              formControlName="name"
              data-testid="create-group-name"
            />
          </div>

          <div class="narrow">
            <label for="group-currency">Currency</label>
            <input
              id="group-currency"
              type="text"
              maxlength="3"
              formControlName="currency"
              data-testid="create-group-currency"
            />
          </div>

          <button type="submit" [disabled]="form.invalid || busy()" data-testid="create-group-submit">
            Create
          </button>
        </div>

        @if (error()) {
          <p class="error create-error">{{ error() }}</p>
        }
      </form>

      @if (loading()) {
        <p class="empty">Loading…</p>
      } @else if (groups().length === 0) {
        <div class="card">
          <p class="empty" data-testid="groups-empty">
            You are not in any groups yet. Create one above to get started.
          </p>
        </div>
      } @else {
        <ul class="list">
          @for (group of groups(); track group.id) {
            <li class="card item" data-testid="group-card">
              <a class="item-link" [routerLink]="['/groups', group.id]">
                <span class="item-name">{{ group.name }}</span>
                <span class="muted item-meta">
                  {{ group.members.length }}
                  {{ group.members.length === 1 ? 'member' : 'members' }} · {{ group.currency }}
                </span>
              </a>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      .sub {
        margin-top: 4px;
        font-size: 0.9rem;
      }

      .create {
        padding: 16px;
      }

      .fields {
        display: flex;
        align-items: flex-end;
        gap: 12px;
      }

      .grow {
        flex: 1 1 auto;
      }

      .narrow {
        width: 88px;
        flex: 0 0 auto;
      }

      .create-error {
        margin-top: 12px;
      }

      .list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .item-link {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        padding: 14px 16px;
        color: var(--text);
      }

      .item-link:hover {
        text-decoration: none;
      }

      .item:hover {
        border-color: var(--border-strong);
      }

      .item-name {
        font-weight: 500;
      }

      .item-meta {
        font-size: 0.82rem;
      }

      @media (max-width: 560px) {
        .fields {
          flex-wrap: wrap;
        }

        .grow {
          flex-basis: 100%;
        }
      }
    `,
  ],
})
export class GroupsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  protected readonly groups = signal<Group[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    currency: ['CHF', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]],
  });

  ngOnInit(): void {
    this.api.listGroups().subscribe({
      next: (result) => {
        this.groups.set(result.groups);
        this.loading.set(false);
      },
      error: (failure: unknown) => {
        this.loading.set(false);
        this.error.set(describeError(failure, 'Could not load your groups'));
      },
    });
  }

  protected create(): void {
    if (this.form.invalid || this.busy()) {
      return;
    }

    this.busy.set(true);
    this.error.set(null);

    const { name, currency } = this.form.getRawValue();

    this.api.createGroup(name, currency.toUpperCase()).subscribe({
      next: (group) => {
        // Straight into the new group: the next thing anybody wants to do is
        // add the people they are sharing with.
        void this.router.navigate(['/groups', group.id]);
      },
      error: (failure: unknown) => {
        this.busy.set(false);
        this.error.set(describeError(failure, 'Could not create the group'));
      },
    });
  }
}
