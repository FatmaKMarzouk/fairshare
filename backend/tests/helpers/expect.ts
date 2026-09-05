import { DomainError, DomainErrorCode } from '../../src/domain/types';

/**
 * Asserts that `fn` throws a DomainError carrying a specific code.
 *
 * Matching on the code rather than the message means the wording can be
 * improved without breaking the suite, while a genuine change of failure mode
 * still fails loudly.
 */
export function expectDomainError(fn: () => unknown, code: DomainErrorCode): void {
  let thrown: unknown;
  let threw = false;

  try {
    fn();
  } catch (error) {
    threw = true;
    thrown = error;
  }

  if (!threw) {
    throw new Error(`expected a DomainError with code ${code}, but nothing was thrown`);
  }

  expect(thrown).toBeInstanceOf(DomainError);
  expect((thrown as DomainError).code).toBe(code);
}
