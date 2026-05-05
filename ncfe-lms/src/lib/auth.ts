import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { authConfig } from './auth.config';
import dbConnect from './db';
import User from '@/models/User';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        await dbConnect();

        const user = await User.findOne({
          email: (credentials.email as string).toLowerCase(),
        }).select('+passwordHash');

        if (!user || !user.passwordHash) {
          return null;
        }

        const isPasswordValid = await user.comparePassword(
          credentials.password as string
        );

        if (!isPasswordValid) {
          return null;
        }

        if (user.status !== 'active') {
          return null;
        }

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          centreId: user.centreId?.toString(),
        };
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        await dbConnect();
        const existingUser = await User.findOne({ email: user.email });

        if (existingUser) {
          if (!existingUser.googleId) {
            existingUser.googleId = account.providerAccountId;
            await existingUser.save();
          }
          (user as Record<string, unknown>).role = existingUser.role;
          (user as Record<string, unknown>).centreId = existingUser.centreId?.toString();
          user.id = existingUser._id.toString();
        } else {
          return false;
        }
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
});
