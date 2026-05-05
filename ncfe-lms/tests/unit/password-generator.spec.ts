import { test, expect } from '@playwright/test';
import { generatePassword, DEFAULT_PASSWORD_LENGTH } from '../../src/lib/password-generator';

test.describe('password-generator (unit)', () => {
  test('100 generations: every result is 14 chars, all classes present, all unique', () => {
    expect(DEFAULT_PASSWORD_LENGTH).toBe(14);

    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const pw = generatePassword();
      expect(pw.length).toBe(14);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[2-9]/);
      expect(pw).toMatch(/[!@#$%^&*\-_=+]/);
      // Excluded ambiguous characters
      expect(pw).not.toMatch(/[0OoIl1]/);
      // Excluded copy-paste-unfriendly characters
      expect(pw).not.toMatch(/[\s'"\\`]/);
      seen.add(pw);
    }

    expect(seen.size, 'all 100 generations should be unique').toBe(100);
  });

  test('honours custom length', () => {
    const pw = generatePassword(20);
    expect(pw.length).toBe(20);
    expect(pw).toMatch(/[a-z]/);
    expect(pw).toMatch(/[A-Z]/);
    expect(pw).toMatch(/[2-9]/);
    expect(pw).toMatch(/[!@#$%^&*\-_=+]/);
  });

  test('rejects length < 8', () => {
    expect(() => generatePassword(7)).toThrow(/at least 8/);
  });
});
