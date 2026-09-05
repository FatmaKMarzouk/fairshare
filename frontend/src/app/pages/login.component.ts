import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { describeError } from '../core/api.service';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'fs-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">
      <div class="card panel">
        <h1>Welcome back</h1>
        <p class="muted lead">Sign in to see what your groups owe each other.</p>

        <form class="stack" [formGroup]="form" (ngSubmit)="submit()">
          @if (error()) {
            <p class="error" data-testid="form-error">{{ error() }}</p>
          }

          <div>
            <label for="email">Email</label>
            <input
              id="email"
              type="email"
              autocomplete="email"
              formControlName="email"
              data-testid="login-email"
            />
          </div>

          <div>
            <label for="password">Password</label>
            <input
              id="password"
              type="password"
              autocomplete="current-password"
              formControlName="password"
              data-testid="login-password"
            />
          </div>

          <button type="submit" [disabled]="form.invalid || busy()" data-testid="login-submit">
            {{ busy() ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>

        <p class="muted foot">
          No account yet? <a routerLink="/register" data-testid="link-to-register">Create one</a>
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

      .foot {
        margin-top: 20px;
        font-size: 0.85rem;
      }
    `,
  ],
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected submit(): void {
    if (this.form.invalid || this.busy()) {
      return;
    }

    this.busy.set(true);
    this.error.set(null);

    const { email, password } = this.form.getRawValue();

    this.auth.login(email, password).subscribe({
      next: () => {
        void this.router.navigate(['/groups']);
      },
      error: (failure: unknown) => {
        this.busy.set(false);
        // Deliberately not "no such account" or "wrong password" — the server
        // does not distinguish the two, and neither should the interface.
        this.error.set(describeError(failure, 'Those credentials are not valid'));
      },
    });
  }
}
