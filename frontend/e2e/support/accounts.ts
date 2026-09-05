/**
 * The end-to-end suite runs against a persistent database, so every test makes
 * its own account rather than sharing a fixture. Tests then cannot interfere
 * with one another, and a failed run leaves no state that breaks the next one.
 */

let counter = 0;

export interface Account {
  name: string;
  email: string;
  password: string;
}

export function newAccount(label = 'user'): Account {
  counter += 1;
  const unique = `${Date.now().toString(36)}${counter.toString(36)}`;

  return {
    name: `${label.charAt(0).toUpperCase()}${label.slice(1)} ${unique.slice(-4)}`,
    email: `${label}.${unique}@example.test`,
    password: 'correct horse battery staple',
  };
}
