import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, of, tap } from 'rxjs';

import { ApiService } from './api.service';
import { AuthResult, User } from './models';

const TOKEN_KEY = 'fairshare.token';

/**
 * Holds the session.
 *
 * The token lives in localStorage so that a reload does not sign the user out.
 * That does mean a cross-site scripting bug could read it — the trade is made
 * deliberately, and the alternative worth building here would be a httpOnly
 * refresh cookie rather than a different browser storage key.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  private readonly currentUser = signal<User | null>(null);
  private readonly token = signal<string | null>(readToken());

  readonly user = this.currentUser.asReadonly();
  readonly isSignedIn = computed(() => this.token() !== null);

  constructor() {
    // A token from a previous visit proves nothing on its own, so the identity
    // behind it is confirmed with the server before it is shown anywhere.
    if (this.token()) {
      this.refresh();
    }
  }

  currentToken(): string | null {
    return this.token();
  }

  register(name: string, email: string, password: string) {
    return this.api.register(name, email, password).pipe(tap((result) => this.accept(result)));
  }

  login(email: string, password: string) {
    return this.api.login(email, password).pipe(tap((result) => this.accept(result)));
  }

  logout(): void {
    this.token.set(null);
    this.currentUser.set(null);
    localStorage.removeItem(TOKEN_KEY);
    void this.router.navigate(['/login']);
  }

  /** Called by the interceptor when the server rejects the token. */
  sessionExpired(): void {
    this.token.set(null);
    this.currentUser.set(null);
    localStorage.removeItem(TOKEN_KEY);
  }

  private accept(result: AuthResult): void {
    this.token.set(result.token);
    this.currentUser.set(result.user);
    localStorage.setItem(TOKEN_KEY, result.token);
  }

  private refresh(): void {
    this.api
      .me()
      .pipe(
        catchError(() => {
          this.sessionExpired();
          return of(null);
        }),
      )
      .subscribe((result) => {
        if (result) {
          this.currentUser.set(result.user);
        }
      });
  }
}

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    // Private browsing modes can make storage throw rather than return null.
    return null;
  }
}
