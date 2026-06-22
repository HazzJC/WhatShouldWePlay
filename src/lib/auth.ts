import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const cookieName = "lpg_session";
const sessionDays = 30;

function resolveSecret() {
  const secret = process.env.AUTH_COOKIE_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_COOKIE_SECRET must be set in production.");
  }

  return "dev-secret";
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function signValue(value: string, secret = resolveSecret()) {
  const signature = createHmac("sha256", secret).update(value).digest("hex");
  return `${value}.${signature}`;
}

export function verifySignedValue(signedValue: string, secret = resolveSecret()) {
  const separator = signedValue.lastIndexOf(".");

  if (separator <= 0) {
    return null;
  }

  const value = signedValue.slice(0, separator);
  const signature = signedValue.slice(separator + 1);

  if (!value || !signature) {
    return null;
  }

  const expected = signValue(value, secret).split(".").at(-1)!;
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }

  return timingSafeEqual(signatureBuffer, expectedBuffer) ? value : null;
}

export async function createUserSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);

  await prisma.userSession.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(cookieName, signValue(token), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function rotateUserSession(userId: string) {
  await clearUserSession();
  await createUserSession(userId);
}

export async function clearUserSession() {
  const cookieStore = await cookies();
  const signedToken = cookieStore.get(cookieName)?.value;
  const token = signedToken ? verifySignedValue(signedToken) : null;

  if (token) {
    await prisma.userSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  }

  cookieStore.delete(cookieName);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const signedToken = cookieStore.get(cookieName)?.value;
  const token = signedToken ? verifySignedValue(signedToken) : null;

  if (!token) {
    return null;
  }

  const session = await prisma.userSession.findFirst({
    where: {
      tokenHash: hashSessionToken(token),
      expiresAt: { gt: new Date() },
    },
    include: {
      user: {
        include: {
          oauthAccounts: true,
          steamAccount: true,
          preference: true,
        },
      },
    },
  });

  return session?.user ?? null;
}

// --- Per-session participant identity ---------------------------------------
// The public share token grants the right to view and join a session, but it
// must not by itself authorise acting *as* a specific participant or as the
// host. When a participant is created (host on session create, guest on first
// availability submit) we set a signed, httpOnly cookie scoped to that session.
// Host-only mutations (lock, remove game, deal settings, alerts) require the
// host cookie; per-participant writes prefer the cookie's id over any value
// supplied in the form, preventing impersonation by anyone holding the link.

const participantCookiePrefix = "lpg_p_";
const hostCookiePrefix = "lpg_host_";
const participantCookieDays = 60;

export async function setParticipantIdentity(
  sessionId: string,
  participantId: string,
  options: { isHost?: boolean } = {},
) {
  const cookieStore = await cookies();
  const expires = new Date(Date.now() + participantCookieDays * 24 * 60 * 60 * 1000);
  const settings = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };

  cookieStore.set(`${participantCookiePrefix}${sessionId}`, signValue(participantId), settings);

  if (options.isHost) {
    cookieStore.set(`${hostCookiePrefix}${sessionId}`, signValue(participantId), settings);
  }
}

export async function getParticipantId(sessionId: string) {
  const cookieStore = await cookies();
  const signed = cookieStore.get(`${participantCookiePrefix}${sessionId}`)?.value;
  return signed ? verifySignedValue(signed) : null;
}

export async function getHostParticipantId(sessionId: string) {
  const cookieStore = await cookies();
  const signed = cookieStore.get(`${hostCookiePrefix}${sessionId}`)?.value;
  return signed ? verifySignedValue(signed) : null;
}

// Resolves the participant the caller is allowed to write as for this session.
// Prefers the signed cookie; falls back to a supplied id only when no cookie is
// present (legacy links shared before this cookie existed). Returns null if a
// cookie exists but disagrees with the supplied id (impersonation attempt).
export async function resolveActingParticipantId(sessionId: string, suppliedId?: string | null) {
  const cookieId = await getParticipantId(sessionId);

  if (cookieId) {
    if (suppliedId && suppliedId !== cookieId) {
      return null;
    }

    return cookieId;
  }

  return suppliedId ?? null;
}

export type OAuthState = {
  shareToken?: string;
  participant?: string;
  friendInvite?: string;
  friendGroupInvite?: string;
  redirectTo?: string;
  intent?: "signin" | "link";
  exp: number;
};

export function createOAuthState(input: Omit<OAuthState, "exp">) {
  const state = {
    ...input,
    exp: Date.now() + 10 * 60 * 1000,
  };
  return signValue(Buffer.from(JSON.stringify(state), "utf8").toString("base64url"));
}

export function parseOAuthState(signedState: string | null) {
  if (!signedState) {
    return null;
  }

  const raw = verifySignedValue(signedState);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<OAuthState>;

    if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) {
      return null;
    }

    return parsed as OAuthState;
  } catch {
    return null;
  }
}

export function safeInternalRedirect(value?: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}
