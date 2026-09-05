import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

import { AuthService } from './core/auth.service';

@Component({
  selector: 'fs-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="bar">
      <div class="bar-inner">
        <a class="brand" routerLink="/groups">
          <span class="mark" aria-hidden="true">÷</span>
          FairShare
        </a>

        @if (auth.isSignedIn()) {
          <div class="row">
            <span class="who" data-testid="nav-user-name">{{ auth.user()?.name ?? '' }}</span>
            <button type="button" class="quiet" data-testid="nav-logout" (click)="auth.logout()">
              Log out
            </button>
          </div>
        }
      </div>
    </header>

    <main class="page">
      <router-outlet />
    </main>
  `,
  styles: [
    `
      .bar {
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        position: sticky;
        top: 0;
        z-index: 10;
      }

      .bar-inner {
        max-width: 880px;
        margin: 0 auto;
        padding: 12px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        font-size: 1rem;
        color: var(--text);
        letter-spacing: -0.01em;
      }

      .brand:hover {
        text-decoration: none;
      }

      .mark {
        display: grid;
        place-items: center;
        width: 24px;
        height: 24px;
        border-radius: 6px;
        background: var(--accent);
        color: var(--accent-contrast);
        font-size: 0.85rem;
        font-weight: 700;
      }

      .who {
        font-size: 0.85rem;
        color: var(--text-muted);
      }

      .page {
        max-width: 880px;
        margin: 0 auto;
        padding: 28px 20px 64px;
      }
    `,
  ],
})
export class AppComponent {
  protected readonly auth = inject(AuthService);
}
