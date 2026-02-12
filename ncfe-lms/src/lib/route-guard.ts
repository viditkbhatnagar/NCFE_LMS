import { NextResponse } from 'next/server';
import { auth } from './auth';
import type { UserRole, SessionUser } from '@/types';

interface AuthResult {
  session: { user: SessionUser } | null;
  error: NextResponse | null;
}

export async function withAuth(
  allowedRoles?: UserRole[]
): Promise<AuthResult> {
  const session = await auth();

  if (!session?.user) {
    return {
      session: null,
      error: NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }

  const user = session.user as unknown as SessionUser;

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role)) {
      return {
        session: null,
        error: NextResponse.json(
          { success: false, error: 'Forbidden: insufficient permissions' },
          { status: 403 }
        ),
      };
    }
  }

  return {
    session: { user },
    error: null,
  };
}
