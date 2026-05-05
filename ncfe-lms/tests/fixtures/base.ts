import { test as base, expect, type Page, type ConsoleMessage } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { CreatedRegistry, createdRegistry } from './created-registry';
import { RUN_ID } from '../run-id';

interface ConsoleCapture {
  errors: string[];
  serverErrors: string[];
}

interface BaseFixtures {
  created: CreatedRegistry;
  consoleCapture: ConsoleCapture;
  ensurePage: Page;
  runId: string;
}

// Patterns we ignore (3rd-party dev noise + known acceptable warnings).
const IGNORED_CONSOLE = [
  /favicon/i,
  /Hot Module Replacement/i,
  /Download the React DevTools/i,
  /Fast Refresh/i,
  /\[Fast Refresh\]/i,
  /\[next-auth\]/i, // next-auth dev logs
];

const IGNORED_RESPONSE_URLS = [
  /\/_next\//,
  /\/favicon\.ico$/,
  /__nextjs/,
  /\/__webpack_hmr/,
  /\/api\/auth\/session/, // 200 always; never matters
  /\/api\/auth\/_log/,
];

/* eslint-disable react-hooks/rules-of-hooks -- the `use` callback below is
   Playwright's fixture API, not the React hook; ESLint's hook detector
   misidentifies it because of the parameter name. */
export const test = base.extend<BaseFixtures>({
  runId: async ({}, use) => {
    await use(RUN_ID);
  },
  created: async ({ request }, use, testInfo) => {
    const registry = createdRegistry();
    await use(registry);
    const result = await registry.cleanup(request);
    if (result.failures.length) {
      // Persist failures so the BUG_LOG sweep can ingest them later.
      const logPath = path.join(__dirname, '..', 'cleanup-failures.jsonl');
      for (const f of result.failures) {
        fs.appendFileSync(
          logPath,
          JSON.stringify({
            test: testInfo.titlePath.join(' > '),
            entry: f.entry,
            error: f.error,
            ts: new Date().toISOString(),
          }) + '\n',
        );
      }
      // Don't fail the test on cleanup issues — but we DO surface them via
      // postflight's leak detection.
      console.warn(
        `[cleanup] ${result.failures.length} entries failed to clean up in test "${testInfo.title}":`,
        result.failures.map((f) => f.error).slice(0, 3).join(' | '),
      );
    }
  },
  consoleCapture: async ({ page }, use, testInfo) => {
    const capture: ConsoleCapture = { errors: [], serverErrors: [] };
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
        capture.errors.push(text);
      }
    });
    page.on('pageerror', (err) => {
      capture.errors.push(`pageerror: ${err.message}`);
    });
    page.on('response', (resp) => {
      const url = resp.url();
      if (IGNORED_RESPONSE_URLS.some((re) => re.test(url))) return;
      const status = resp.status();
      if (status >= 500) {
        capture.serverErrors.push(`${status} ${resp.request().method()} ${url}`);
      }
    });
    await use(capture);
    // Persist (don't auto-fail) — specs that care about console errors assert explicitly.
    if (capture.errors.length || capture.serverErrors.length) {
      const logPath = path.join(__dirname, '..', 'console-issues.jsonl');
      fs.appendFileSync(
        logPath,
        JSON.stringify({
          test: testInfo.titlePath.join(' > '),
          errors: capture.errors,
          serverErrors: capture.serverErrors,
          ts: new Date().toISOString(),
        }) + '\n',
      );
    }
  },
  ensurePage: async ({ page }, use) => {
    await use(page);
  },
});
/* eslint-enable react-hooks/rules-of-hooks */

export { expect };
export type { ConsoleCapture };

/** Reads the auth probe to determine if a role's storage state is valid. */
export function isRoleAvailable(role: 'student' | 'student2' | 'assessor' | 'iqa' | 'admin'): boolean {
  const probePath = path.join(__dirname, '..', '.auth', 'auth-probe.json');
  if (!fs.existsSync(probePath)) return false;
  try {
    const data = JSON.parse(fs.readFileSync(probePath, 'utf8')) as Record<string, { ok: boolean }>;
    return !!data[role]?.ok;
  } catch {
    return false;
  }
}
