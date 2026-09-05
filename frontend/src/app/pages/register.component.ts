import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { describeError } from '../core/api.service';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'fs-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">
      <div class="card panel">
        <h1>Create an account</h1>
        <p class="muted lead">Split costs with a group and settle up in a few payments.</p>

        <form class="stack" [formGroup]="form" (ngSubmit)="submit()">
          @if (error()) {
            <p class="error" data-testid="form-error">{{ error() }}</p>
          }

          <div>
            <label for="name">Name</label>
            <input
              id="name"
              type="text"
              autocomplete="name"
              formControlName="name"
              data-testid="register-name"
            />
          </div>

          <div>
            <label for="email">Email</label>
            <input
              id="email"
              type="email"
              autocomplete="email"
              formControlName="email"
              data-testid="register-email"
            />
          </div>

          <div>
            <label for="password">Password</label>
            <input
              id="password"
              type="password"
              autocomplete="new-password"
              formControlName="password"
              data-testid="register-password"
            />
            <p class="hint muted">At least eight characters.</p>
          </div>

          <button type="submit" [disabled]="form.invalid || busy()" data-testid="register-submit">
            {{ busy() ? 'Creating…' : 'Create account' }}
          </button>
        </form>

        <p class="muted foot">
          Already have one? <a routerLink="/login" data-testid="link-to-login">Sign in</a>
        </p>
      </div>
    </div>
  `,
  styles: [
    `
      .shell {
        max-width: 380px;
        margin: 6vh auto 0;
      }

      .panel {
        padding: 28px;
      }

      .lead {
        margin: 6px 0 22px;
        font-size: 0.9rem;
      }

      .hint {
        margin-top: 5px;
        font-size: 0.78rem;
      }

      .foot {
        margin-top: 20px;
        font-size: 0.85rem;
      }
    `,
  ],
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected submit(): void {
    if (this.form.invalid || this.busy()) {
      return;
    }

    this.busy.set(true);
    this.error.set(null);

    const { name, email, password } = this.form.getRawValue();

    this.auth.register(name, email, password).subscribe({
      next: () => {
        void this.router.navigate(['/groups']);
      },
      error: (failure: unknown) => {
        this.busy.set(false);
        this.error.set(describeError(failure, 'Could not create the account'));
      },
    });
  }
}
