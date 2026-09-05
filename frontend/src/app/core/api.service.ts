import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  ApiErrorBody,
  AuthResult,
  Balance,
  Expense,
  Group,
  SplitMode,
  Transfer,
  User,
} from './models';

/**
 * The API is reached at a relative path, because nginx serves this bundle and
 * proxies /api to the backend from the same origin. There is no host to
 * configure at build time and no CORS preflight in normal operation.
 */
const BASE = '/api';

export interface ExpenseDraft {
  description: string;
  amountMinor: number;
  paidBy: string;
  splitMode: SplitMode;
  participants: { userId: string; value?: number }[];
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  register(name: string, email: string, password: string): Observable<AuthResult> {
    return this.http.post<AuthResult>(`${BASE}/auth/register`, { name, email, password });
  }

  login(email: string, password: string): Observable<AuthResult> {
    return this.http.post<AuthResult>(`${BASE}/auth/login`, { email, password });
  }

  me(): Observable<{ user: User }> {
    return this.http.get<{ user: User }>(`${BASE}/auth/me`);
  }

  listGroups(): Observable<{ groups: Group[] }> {
    return this.http.get<{ groups: Group[] }>(`${BASE}/groups`);
  }

  createGroup(name: string, currency: string): Observable<Group> {
    return this.http.post<Group>(`${BASE}/groups`, { name, currency });
  }

  getGroup(id: string): Observable<Group> {
    return this.http.get<Group>(`${BASE}/groups/${id}`);
  }

  addMember(groupId: string, email: string): Observable<Group> {
    return this.http.post<Group>(`${BASE}/groups/${groupId}/members`, { email });
  }

  listExpenses(groupId: string): Observable<{ expenses: Expense[] }> {
    return this.http.get<{ expenses: Expense[] }>(`${BASE}/groups/${groupId}/expenses`);
  }

  addExpense(groupId: string, draft: ExpenseDraft): Observable<Expense> {
    return this.http.post<Expense>(`${BASE}/groups/${groupId}/expenses`, draft);
  }

  deleteExpense(expenseId: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/expenses/${expenseId}`);
  }

  getBalances(groupId: string): Observable<{ balances: Balance[] }> {
    return this.http.get<{ balances: Balance[] }>(`${BASE}/groups/${groupId}/balances`);
  }

  getSettlement(groupId: string): Observable<{ transfers: Transfer[] }> {
    return this.http.get<{ transfers: Transfer[] }>(`${BASE}/groups/${groupId}/settlement`);
  }
}

/**
 * Pulls the human-readable part out of a failed request.
 *
 * The API always answers with the same envelope, so this never has to guess.
 * A network failure has no envelope at all, which is the one case that falls
 * back to generic wording.
 */
export function describeError(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as ApiErrorBody | null;

    if (body?.error?.message) {
      const details = body.error.details;

      if (details && details.length > 0) {
        return `${body.error.message}: ${details.map((d) => d.message).join(', ')}`;
      }

      return body.error.message;
    }

    if (error.status === 0) {
      return 'Could not reach the server';
    }
  }

  return fallback;
}
