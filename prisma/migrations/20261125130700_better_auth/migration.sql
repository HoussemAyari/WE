-- Preserve existing user names and account verification state during the auth-module change.
UPDATE "User" SET "name" = 'Partenaire' WHERE "name" IS NULL;
ALTER TABLE "User" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "User"
  ALTER COLUMN "emailVerified" TYPE BOOLEAN USING ("emailVerified" IS NOT NULL),
  ALTER COLUMN "emailVerified" SET DEFAULT false,
  ALTER COLUMN "emailVerified" SET NOT NULL,
  ADD COLUMN "pendingInvitationToken" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;

CREATE TABLE "AuthAccount" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuthAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthVerification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuthVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthRateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL
);

-- Reuse OAuth identities and bcrypt credential hashes already stored by the previous adapter.
INSERT INTO "AuthAccount" (
  "id", "accountId", "providerId", "userId", "accessToken", "refreshToken", "idToken",
  "accessTokenExpiresAt", "scope", "createdAt", "updatedAt"
)
SELECT
  'legacy-oauth-' || md5("provider" || ':' || "providerAccountId"),
  "providerAccountId",
  "provider",
  "userId",
  "access_token",
  "refresh_token",
  "id_token",
  CASE WHEN "expires_at" IS NULL THEN NULL ELSE to_timestamp("expires_at")::TIMESTAMP(3) END,
  "scope",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Account";

INSERT INTO "AuthAccount" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
SELECT
  'legacy-credential-' || "id",
  "id",
  'credential',
  "id",
  "passwordHash",
  "createdAt",
  CURRENT_TIMESTAMP
FROM "User"
WHERE "passwordHash" IS NOT NULL;

INSERT INTO "AuthVerification" ("id", "identifier", "value", "expiresAt", "createdAt", "updatedAt")
SELECT
  'legacy-verification-' || md5("identifier" || ':' || "token"),
  "identifier",
  "token",
  "expires",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "VerificationToken";

ALTER TABLE "Account" DROP CONSTRAINT "Account_userId_fkey";
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";
ALTER TABLE "User" DROP COLUMN "passwordHash";
DROP TABLE "Account";
DROP TABLE "Session";
DROP TABLE "VerificationToken";
DROP TABLE "LoginThrottle";

CREATE INDEX "AuthAccount_userId_idx" ON "AuthAccount"("userId");
CREATE UNIQUE INDEX "AuthAccount_providerId_accountId_key" ON "AuthAccount"("providerId", "accountId");
CREATE UNIQUE INDEX "AuthSession_token_key" ON "AuthSession"("token");
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");
CREATE INDEX "AuthVerification_identifier_idx" ON "AuthVerification"("identifier");
CREATE UNIQUE INDEX "AuthRateLimit_key_key" ON "AuthRateLimit"("key");

ALTER TABLE "AuthAccount" ADD CONSTRAINT "AuthAccount_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
