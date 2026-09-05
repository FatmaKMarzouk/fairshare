import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';

/**
 * Attaches the bearer token, and treats a rejected one as a signed-out session.
 *
 * The sign-in calls themselves are exempt: sending a stale token with them is
 * pointless, and a 401 from a login attempt means the password was wrong, not
 * that the session ended.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isCredentialExchange =
    request.url.includes('/auth/login') || request.url.includes('/auth/register');

  const token = auth.currentToken();

  const outbound =
    token && !isCredentialExchange
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : request;

  return next(outbound).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !isCredentialExchange) {
        auth.sessionExpired();
        void router.navigate(['/login']);
      }

      return throwError(() => error);
    }),
  );
};
