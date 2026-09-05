import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/** Keeps signed-out visitors off the application, and sends them to sign in. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isSignedIn()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

/** Keeps signed-in visitors off the sign-in pages. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isSignedIn()) {
    return true;
  }

  return router.createUrlTree(['/groups']);
};
