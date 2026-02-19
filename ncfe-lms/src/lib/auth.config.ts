import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/sign-in',
    newUser: '/sign-up',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard') ||
        nextUrl.pathname.startsWith('/courses') ||
        nextUrl.pathname.startsWith('/portfolio') ||
        nextUrl.pathname.startsWith('/assessor') ||
        nextUrl.pathname.startsWith('/iqa') ||
        nextUrl.pathname.startsWith('/messages') ||
        nextUrl.pathname.startsWith('/notifications') ||
        nextUrl.pathname.startsWith('/profile') ||
        nextUrl.pathname.startsWith('/submissions') ||
        nextUrl.pathname.startsWith('/progress') ||
        nextUrl.pathname.startsWith('/c/') ||
        nextUrl.pathname === '/c';

      if (isOnDashboard) {
        if (!isLoggedIn) return false; // Redirect to sign-in

        // Redirect assessors/students away from old dashboard to /c
        const role = (auth?.user as Record<string, unknown> | undefined)?.role;
        const isOldDashboard = nextUrl.pathname.startsWith('/dashboard') ||
          nextUrl.pathname.startsWith('/courses') ||
          nextUrl.pathname.startsWith('/portfolio') ||
          nextUrl.pathname.startsWith('/assessor') ||
          nextUrl.pathname.startsWith('/messages') ||
          nextUrl.pathname.startsWith('/notifications') ||
          nextUrl.pathname.startsWith('/submissions') ||
          nextUrl.pathname.startsWith('/progress');

        if (isOldDashboard && (role === 'assessor' || role === 'student')) {
          return Response.redirect(new URL('/c', nextUrl));
        }

        return true;
      }

      // Redirect logged-in users from auth pages to dashboard
      const isOnAuthPage = nextUrl.pathname.startsWith('/sign-in') ||
        nextUrl.pathname.startsWith('/sign-up') ||
        nextUrl.pathname.startsWith('/forgot-password');

      if (isOnAuthPage && isLoggedIn) {
        const role = (auth?.user as Record<string, unknown> | undefined)?.role;
        if (role === 'assessor' || role === 'student') {
          return Response.redirect(new URL('/c', nextUrl));
        }
        return Response.redirect(new URL('/dashboard', nextUrl));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as Record<string, unknown>).role;
        token.centreId = (user as Record<string, unknown>).centreId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as unknown as Record<string, unknown>).role = token.role;
        (session.user as unknown as Record<string, unknown>).centreId = token.centreId;
      }
      return session;
    },
  },
  providers: [],
  session: {
    strategy: 'jwt',
  },
};
