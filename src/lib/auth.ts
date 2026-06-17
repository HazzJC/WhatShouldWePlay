import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const cookieName = "lpg_session";
const sessionDays = 30;

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function signValue(value: string, secret = process.env.AUTH_COOKIE_SECRET ?? "dev-secret") {
  const signature = createHash("sha256").update(`${value}.${secret}`).digest("hex");
  return `${value}.${signature}`;
}

export function verifySignedValue(signedValue: string, secret = process.env.AUTH_COOKIE_SECRET ?? "dev-secret") {
  const [value, signature] = signedValue.split(".");

  if (!value || !signature) {
    return null;
  }

  const expected = signValue(value, secret).split(".")[1];
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
          steamAccount: true,
        },
      },
    },
  });

  return session?.user ?? null;
}
