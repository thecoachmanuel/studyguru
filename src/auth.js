import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import clientPromise, { getDatabase } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';

const hasMongo = !!process.env.MONGODB_URI;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  ...(hasMongo ? {
    adapter: MongoDBAdapter(clientPromise, {
      databaseName: process.env.MONGODB_DB || 'studycord',
    }),
  } : {}),
  session: {
    strategy: 'jwt',
    maxAge: 60 * 24 * 60 * 60, // 60 days persistent session on device
    updateAge: 24 * 60 * 60,   // Sliding expiration: refresh token age every 24 hours of activity
  },
  jwt: {
    maxAge: 60 * 24 * 60 * 60, // 60 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || '',
      clientSecret: process.env.AUTH_GOOGLE_SECRET || '',
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please enter an email and password');
        }

        const email = String(credentials.email).toLowerCase().trim();

        // Built-in Demo Credentials
        const isDemoEmail =
          email === 'demo@studyguru.me' ||
          email === 'demo@studycord.me' ||
          email === 'demo@study.me';
        const isDemoPassword =
          credentials.password === 'StudyGuru2026!' ||
          credentials.password === 'demo1234' ||
          credentials.password === 'password123' ||
          credentials.password === 'StudyCord2026!';

        if (isDemoEmail && isDemoPassword) {
          return {
            id: '65f01234567890abcdef1234',
            email: email === 'demo@studyguru.me' ? 'demo@studyguru.me' : 'demo@studycord.me',
            name: 'Demo Student',
            image: null,
          };
        }

        try {
          const db = await getDatabase();
          const user = await db.collection('users').findOne({ email });

          if (!user || !user.password_hash) {
            throw new Error('Invalid email or password');
          }

          const isValid = await bcrypt.compare(credentials.password, user.password_hash);
          if (!isValid) {
            throw new Error('Invalid email or password');
          }

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name || user.username || email.split('@')[0],
            image: user.avatar_url || user.image || null,
          };
        } catch (dbErr) {
          if (isDemoEmail) {
            return {
              id: '65f01234567890abcdef1234',
              email: email === 'demo@studyguru.me' ? 'demo@studyguru.me' : 'demo@studycord.me',
              name: 'Demo Student',
              image: null,
            };
          }
          throw dbErr;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id || token.sub;
        token.sub = user.id || token.sub;
        token.name = user.name;
        token.email = user.email;
        token.image = user.image;
      }
      if (trigger === 'update' && session?.user) {
        token.name = session.user.name || token.name;
        token.image = session.user.image || token.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = session.user || {};
        session.user.id = token.id || token.sub;
        session.user.name = token.name || session.user.name;
        session.user.email = token.email || session.user.email;
        session.user.image = token.image || session.user.image;
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'studycord-secret-key-at-least-32-chars-long',
});
