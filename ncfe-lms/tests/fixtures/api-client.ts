import type { APIRequestContext } from '@playwright/test';
import { request as pwRequest } from '@playwright/test';
import { USERS, type Role } from '../users';

/**
 * Returns an APIRequestContext authenticated as the given role using its
 * persisted storage state. Use this in `beforeAll` / setup helpers.
 */
export async function apiAs(role: Role): Promise<APIRequestContext> {
  const stateFile = USERS[role].storageStatePath;
  return await pwRequest.newContext({
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    storageState: stateFile,
  });
}
