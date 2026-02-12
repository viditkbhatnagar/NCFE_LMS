import type { UserRole } from '@/types';
import 'next-auth';

declare module 'next-auth' {
  interface User {
    role?: UserRole;
    centreId?: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      centreId: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
    centreId: string;
  }
}
