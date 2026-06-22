CREATE TYPE "OAuthProvider" AS ENUM ('GOOGLE');
CREATE TYPE "FriendGroupMemberStatus" AS ENUM ('ACCEPTED', 'PENDING');

ALTER TABLE "User"
  ADD COLUMN "email" TEXT,
  ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "avatarUrl" TEXT,
  ADD COLUMN "lastSignedInAt" TIMESTAMP(3);

CREATE INDEX "User_email_idx" ON "User"("email");

CREATE TABLE "OAuthAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "OAuthProvider" NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "email" TEXT,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "avatarUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OAuthAccount_provider_providerAccountId_key" ON "OAuthAccount"("provider", "providerAccountId");
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");

CREATE TABLE "FriendGroup" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FriendGroup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FriendGroup_ownerId_idx" ON "FriendGroup"("ownerId");

CREATE TABLE "FriendGroupMember" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "userId" TEXT,
  "displayName" TEXT NOT NULL,
  "status" "FriendGroupMemberStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FriendGroupMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FriendGroupMember_groupId_userId_key" ON "FriendGroupMember"("groupId", "userId");
CREATE INDEX "FriendGroupMember_userId_idx" ON "FriendGroupMember"("userId");
CREATE INDEX "FriendGroupMember_groupId_status_idx" ON "FriendGroupMember"("groupId", "status");

CREATE TABLE "FriendGroupInvite" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "inviterId" TEXT NOT NULL,
  "acceptedById" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FriendGroupInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FriendGroupInvite_token_key" ON "FriendGroupInvite"("token");
CREATE INDEX "FriendGroupInvite_groupId_idx" ON "FriendGroupInvite"("groupId");
CREATE INDEX "FriendGroupInvite_inviterId_idx" ON "FriendGroupInvite"("inviterId");
CREATE INDEX "FriendGroupInvite_acceptedById_idx" ON "FriendGroupInvite"("acceptedById");
CREATE INDEX "FriendGroupInvite_expiresAt_idx" ON "FriendGroupInvite"("expiresAt");

ALTER TABLE "OAuthAccount"
  ADD CONSTRAINT "OAuthAccount_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FriendGroup"
  ADD CONSTRAINT "FriendGroup_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FriendGroupMember"
  ADD CONSTRAINT "FriendGroupMember_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "FriendGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FriendGroupMember"
  ADD CONSTRAINT "FriendGroupMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FriendGroupInvite"
  ADD CONSTRAINT "FriendGroupInvite_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "FriendGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FriendGroupInvite"
  ADD CONSTRAINT "FriendGroupInvite_inviterId_fkey"
  FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
