import { redirect } from "next/navigation";
import { getCurrentUser, safeInternalRedirect } from "@/lib/auth";

export const usernamePattern = /^[a-z0-9_]{3,24}$/;
export const usernameChangeCooldownMs = 30 * 24 * 60 * 60 * 1000;

export function normalizeUsername(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function validateUsername(value: string) {
  const normalized = normalizeUsername(value);

  if (!usernamePattern.test(normalized)) {
    return {
      success: false as const,
      error: "Use 3-24 lowercase letters, numbers, or underscores.",
    };
  }

  return { success: true as const, username: normalized };
}

export function onboardingUrl(returnTo?: string | null) {
  const destination = safeInternalRedirect(returnTo);
  return `/account/onboarding?returnTo=${encodeURIComponent(destination)}`;
}

export function signInUrl(returnTo?: string | null) {
  const destination = safeInternalRedirect(returnTo);
  return `/account?returnTo=${encodeURIComponent(destination)}`;
}

export function isActivePickUser(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  return Boolean(user?.username && user.onboardingCompletedAt);
}

export async function requireActivePickUser(returnTo: string) {
  const user = await getCurrentUser();

  if (!user) {
    redirect(signInUrl(returnTo));
  }

  if (!isActivePickUser(user)) {
    redirect(onboardingUrl(returnTo));
  }

  return user;
}

export function usernameChangeAvailableAt(usernameChangedAt?: Date | null) {
  return usernameChangedAt
    ? new Date(usernameChangedAt.getTime() + usernameChangeCooldownMs)
    : null;
}
