import NextAuth from 'next-auth';
import { authConfig } from './lib/auth.config';

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/courses/:path*',
    '/portfolio/:path*',
    '/assessor/:path*',
    '/iqa/:path*',
    '/messages/:path*',
    '/notifications/:path*',
    '/profile/:path*',
    '/submissions/:path*',
    '/progress/:path*',
    '/c/:path*',
    '/admin/:path*',
    '/sign-in',
    '/sign-up',
    '/forgot-password',
  ],
};
