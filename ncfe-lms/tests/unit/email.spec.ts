import { test, expect } from '@playwright/test';
import {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  welcomeHtml,
  resetHtml,
} from '../../src/lib/email';

const SAMPLE = {
  name: 'Jane Demo',
  email: 'jane@example.invalid',
  password: 'p@SsW0rd!Aa',
  role: 'student',
  loginUrl: 'https://example.invalid/sign-in',
};

test.describe('email helper (unit)', () => {
  test('without env vars returns logged-only', async () => {
    const prevKey = process.env.BREVO_API_KEY;
    delete process.env.BREVO_API_KEY;
    try {
      const r = await sendWelcomeEmail(SAMPLE);
      expect(r.ok).toBe(true);
      expect(r.messageId).toBe('logged-only');
    } finally {
      if (prevKey !== undefined) process.env.BREVO_API_KEY = prevKey;
    }
  });

  test('with invalid key returns soft-fail error', async () => {
    test.setTimeout(60_000);
    const prevKey = process.env.BREVO_API_KEY;
    process.env.BREVO_API_KEY = 'xkeysib-INVALID-KEY-FOR-TEST';
    try {
      const r = await sendWelcomeEmail(SAMPLE);
      expect(r.ok).toBe(false);
      expect(r.error).toBeTruthy();
    } finally {
      if (prevKey !== undefined) process.env.BREVO_API_KEY = prevKey;
      else delete process.env.BREVO_API_KEY;
    }
  });

  test('reset variant also soft-fails on bad key', async () => {
    test.setTimeout(60_000);
    const prevKey = process.env.BREVO_API_KEY;
    process.env.BREVO_API_KEY = 'xkeysib-INVALID-KEY-FOR-TEST';
    try {
      const r = await sendPasswordResetEmail({
        name: SAMPLE.name,
        email: SAMPLE.email,
        password: SAMPLE.password,
        loginUrl: SAMPLE.loginUrl,
      });
      expect(r.ok).toBe(false);
      expect(r.error).toBeTruthy();
    } finally {
      if (prevKey !== undefined) process.env.BREVO_API_KEY = prevKey;
      else delete process.env.BREVO_API_KEY;
    }
  });

  test('welcomeHtml contains every input value', () => {
    const html = welcomeHtml(SAMPLE);
    expect(html).toContain(SAMPLE.name);
    expect(html).toContain(SAMPLE.email);
    expect(html).toContain(SAMPLE.password);
    expect(html).toContain(SAMPLE.loginUrl);
  });

  test('resetHtml contains every input value', () => {
    const html = resetHtml({
      name: SAMPLE.name,
      email: SAMPLE.email,
      password: SAMPLE.password,
      loginUrl: SAMPLE.loginUrl,
    });
    expect(html).toContain(SAMPLE.name);
    expect(html).toContain(SAMPLE.email);
    expect(html).toContain(SAMPLE.password);
    expect(html).toContain(SAMPLE.loginUrl);
  });
});
