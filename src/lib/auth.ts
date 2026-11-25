import { compare, hash } from "bcryptjs";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db";
import { sendAuthEmail } from "@/lib/email";

const authURL = process.env.AUTH_URL || "http://localhost:3000";
const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

function invitationTokenFor(user: Record<string, unknown>) {
  const token = user.pendingInvitationToken;
  return typeof token === "string" && token.length > 0 && token.length <= 200 ? token : null;
}

async function provisionHousehold(user: { id: string; name: string; email: string }, token: string | null) {
  await prisma.$transaction(async (tx) => {
    if (token) {
      const invite = await tx.householdInvite.findUnique({ where: { token } });
      if (!invite || invite.expiresAt <= new Date() || (invite.email && invite.email.toLowerCase() !== user.email.toLowerCase())) {
        throw new Error("Invitation invalide ou expirée.");
      }
      if (await tx.householdMember.count({ where: { householdId: invite.householdId } }) >= 2) {
        throw new Error("Ce foyer a déjà ses deux membres.");
      }
      await tx.householdMember.create({ data: { householdId: invite.householdId, userId: user.id } });
      await tx.householdInvite.delete({ where: { id: invite.id } });
      await tx.activityLog.create({
        data: { householdId: invite.householdId, actorId: user.id, action: "a rejoint le foyer", entityType: "household", entityId: invite.householdId },
      });
    } else {
      const household = await tx.household.create({
        data: { name: `Foyer de ${user.name}`, members: { create: { userId: user.id, role: "OWNER" } } },
      });
      await tx.budgetCategory.createMany({
        data: ["Alimentation", "Transport", "Logement", "Loisirs", "Santé", "Cigarettes", "Autre"].map((name) => ({
          householdId: household.id,
          name,
        })),
        skipDuplicates: true,
      });
      await tx.activityLog.create({
        data: { householdId: household.id, actorId: user.id, action: "a créé le foyer", entityType: "household", entityId: household.id },
      });
    }
    await tx.user.update({ where: { id: user.id }, data: { pendingInvitationToken: null } });
  });
}

export const auth = betterAuth({
  appName: "DeuxNous",
  baseURL: authURL,
  secret: process.env.AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  user: {
    additionalFields: {
      pendingInvitationToken: {
        type: "string",
        required: false,
        input: true,
        returned: false,
      },
    },
  },
  account: {
    modelName: "AuthAccount",
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      allowDifferentEmails: false,
    },
  },
  session: {
    modelName: "AuthSession",
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  verification: { modelName: "AuthVerification" },
  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "AuthRateLimit",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-in/social": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/request-password-reset": { window: 60, max: 3 },
    },
  },
  advanced: {
    defaultCookieAttributes: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    password: {
      hash: (password) => hash(password, 12),
      verify: ({ hash: storedHash, password }) => compare(password, storedHash),
    },
    sendResetPassword: async ({ user, url }) => {
      await sendAuthEmail({
        to: user.email,
        subject: "Réinitialiser votre mot de passe DeuxNous",
        text: `Bonjour ${user.name},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable une heure) :\n${url}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: false,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthEmail({
        to: user.email,
        subject: "Vérifiez votre adresse e-mail DeuxNous",
        text: `Bonjour ${user.name},\n\nPour vérifier votre adresse e-mail, ouvrez ce lien (valable une heure) :\n${url}\n\nSi vous n'avez pas créé de compte DeuxNous, ignorez cet e-mail.`,
      });
    },
  },
  socialProviders: googleConfigured
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          scope: ["openid", "email", "profile"],
        },
      }
    : {},
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (user.pendingInvitationToken && !invitationTokenFor(user)) return false;
          const token = invitationTokenFor(user);
          if (!token) return;
          const invite = await prisma.householdInvite.findUnique({ where: { token } });
          if (!invite || invite.expiresAt <= new Date() || (invite.email && invite.email.toLowerCase() !== user.email.toLowerCase())) return false;
          if (await prisma.householdMember.count({ where: { householdId: invite.householdId } }) >= 2) return false;
        },
        after: async (user) => {
          await provisionHousehold(user, invitationTokenFor(user));
        },
      },
    },
  },
});
