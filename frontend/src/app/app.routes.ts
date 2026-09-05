import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth.guard';

/**
 * Pages are loaded on demand, so signing in does not also download the parts of
 * the application a signed-out visitor can never reach.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'groups' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'groups',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/groups.component').then((m) => m.GroupsComponent),
  },
  {
    path: 'groups/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/group-detail.component').then((m) => m.GroupDetailComponent),
  },
  { path: '**', redirectTo: 'groups' },
];
