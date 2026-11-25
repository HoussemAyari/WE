import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";

const credentialsSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/connexion" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const now = new Date();
        const cutoff = new Date(now.getTime() - 15 * 60 * 1000);
        const throttle = await prisma.loginThrottle.findUnique({ where: { email } });
        if (throttle?.lockedUntil && throttle.lockedUntil > now) return null;
        if (throttle && throttle.windowStart < cutoff) {
          await prisma.loginThrottle.update({
            where: { email },
            data: { attempts: 0, windowStart: now, lockedUntil: null },
          });
        }
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash || !(await compare(password, user.passwordHash))) {
          const current = await prisma.loginThrottle.upsert({
            where: { email },
            create: { email, attempts: 1, windowStart: now },
            update: { attempts: { increment: 1 } },
          });
          if (current.attempts >= 5) {
            await prisma.loginThrottle.update({
              where: { email },
              data: { lockedUntil: new Date(now.getTime() + 15 * 60 * 1000) },
            });
          }
          return null;
        }
        await prisma.loginThrottle.deleteMany({ where: { email } });
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
});
