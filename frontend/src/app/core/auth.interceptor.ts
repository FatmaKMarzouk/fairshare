import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { TokenStore } from './token-store';

/**
 * Attaches the bearer token, and treats a rejected one as a session that ended.
 *
 * It depends on TokenStore rather than AuthService on purpose: AuthService
 * makes a request while it is still being constructed, and injecting it here
 * would ask the injector for a service it has not finished building.
 *
 * The credential exchanges are exempt. Sending a stale token with them is
 * pointless, and a 401 from a login attempt means the password was wrong, not
 * that a session expired.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const tokens = inject(TokenStore);
  const router = inject(Router);

  const isCredentialExchange =
    request.url.includes('/auth/login') || request.url.includes('/auth/register');

  const token = tokens.token();

  const outbound =
    token && !isCredentialExchange
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : request;

  return next(outbound).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !isCredentialExchange) {
        tokens.clear();
        void router.navigate(['/login']);
      }

      return throwError(() => error);
    }),
  );
};
