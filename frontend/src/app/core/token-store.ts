import { Injectable, signal } from '@angular/core';

const TOKEN_KEY = 'fairshare.token';

/**
 * Holds the bearer token, and nothing else.
 *
 * This exists as its own service so that the HTTP interceptor has something to
 * read the token from without depending on AuthService. AuthService makes a
 * request during its own construction, to confirm a token left over from a
 * previous visit; if the interceptor injected AuthService, that request would
 * ask the injector for a service that is still being built.
 *
 * Storing in localStorage is what keeps a session across a reload. It also
 * means a cross-site scripting bug could read the token — the trade is
 * deliberate, and the thing worth building instead would be a httpOnly refresh
 * cookie, not a different browser storage key.
 */
@Injectable({ providedIn: 'root' })
export class TokenStore {
  private readonly current = signal<string | null>(read());

  readonly token = this.current.asReadonly();

  set(token: string): void {
    this.current.set(token);
    write(token);
  }

  clear(): void {
    this.current.set(null);
    write(null);
  }
}

function read(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    // Private browsing modes can make storage throw rather than return null.
    return null;
  }
}

function write(token: string | null): void {
  try {
    if (token === null) {
      localStorage.removeItem(TOKEN_KEY);
    } else {
      localStorage.setItem(TOKEN_KEY, token);
    }
  } catch {
    // Losing persistence is survivable; the session simply ends on reload.
  }
}
