export type SplitMode = 'EQUAL' | 'EXACT' | 'PERCENTAGE' | 'SHARES';

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Group {
  id: string;
  name: string;
  currency: string;
  members: User[];
  createdAt: string;
}

export interface Share {
  userId: string;
  shareMinor: number;
}

export interface Expense {
  id: string;
  description: string;
  amountMinor: number;
  paidBy: string;
  splitMode: SplitMode;
  participants: { userId: string; value?: number }[];
  shares: Share[];
  occurredAt: string;
  createdAt: string;
}

export interface Balance {
  userId: string;
  name: string;
  netMinor: number;
}

export interface Transfer {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amountMinor: number;
}

export interface AuthResult {
  token: string;
  user: User;
}

/** The uniform error envelope every endpoint uses. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { path: string; message: string }[];
  };
}
