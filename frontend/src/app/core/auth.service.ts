import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, of, tap } from 'rxjs';

import { ApiService } from './api.service';
import { AuthResult, User } from './models';
import { TokenStore } from './token-store';

/** Owns the session: who is signed in, and how that starts and ends. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly tokens = inject(TokenStore);

  private readonly currentUser = signal<User | null>(null);

  readonly user = this.currentUser.asReadonly();
  readonly isSignedIn = computed(() => this.tokens.token() !== null);

  constructor() {
    // The interceptor can clear the token on a rejected request. Whoever it
    // belonged to goes with it.
    effect(
      () => {
        if (this.tokens.token() === null) {
          this.currentUser.set(null);
        }
      },
      { allowSignalWrites: true },
    );

    // A token left over from a previous visit proves nothing on its own, so
    // the identity behind it is confirmed with the server before it is shown.
    if (this.tokens.token()) {
      this.restore();
    }
  }

  register(name: string, email: string, password: string) {
    return this.api.register(name, email, password).pipe(tap((result) => this.accept(result)));
  }

  login(email: string, password: string) {
    return this.api.login(email, password).pipe(tap((result) => this.accept(result)));
  }

  logout(): void {
    this.tokens.clear();
    this.currentUser.set(null);
    void this.router.navigate(['/login']);
  }

  private accept(result: AuthResult): void {
    this.tokens.set(result.token);
    this.currentUser.set(result.user);
  }

  private restore(): void {
    this.api
      .me()
      .pipe(
        catchError(() => {
          this.tokens.clear();
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
