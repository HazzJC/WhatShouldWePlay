import { redirect } from "next/navigation";
import { createOAuthState, getCurrentUser, safeInternalRedirect } from "@/lib/auth";
import { buildGoogleAuthUrl } from "@/lib/google-auth";

function withGoogleError(path: string, code: string) {
  const destination = new URL(safeInternalRedirect(path), "https://local.invalid");
  destination.searchParams.set("google_error", code);
  return `${destination.pathname}${destination.search}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const currentUser = await getCurrentUser();
  const redirectTo = safeInternalRedirect(url.searchParams.get("redirectTo"));
  const state = createOAuthState({
    shareToken: url.searchParams.get("shareToken") || undefined,
    participant: url.searchParams.get("participant") || undefined,
    friendInvite: url.searchParams.get("friendInvite") || undefined,
    friendGroupInvite: url.searchParams.get("friendGroupInvite") || undefined,
    redirectTo,
    intent: currentUser ? "link" : "signin",
  });

  let authUrl: string;

  try {
    authUrl = await buildGoogleAuthUrl(state);
  } catch {
    redirect(withGoogleError(redirectTo, "not_configured"));
  }

  redirect(authUrl);
}
