import { redirect } from "next/navigation";
import { createOAuthState, getCurrentUser, oauthParticipantForShareToken, rememberOAuthState, safeInternalRedirect } from "@/lib/auth";
import { buildMicrosoftAuthUrl } from "@/lib/microsoft-auth";

function withMicrosoftError(path: string, code: string) {
  const destination = new URL(safeInternalRedirect(path), "https://local.invalid");
  destination.searchParams.set("microsoft_error", code);
  return `${destination.pathname}${destination.search}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const currentUser = await getCurrentUser();
  const redirectTo = safeInternalRedirect(url.searchParams.get("redirectTo"));
  const shareToken = url.searchParams.get("shareToken") || undefined;
  const participant = await oauthParticipantForShareToken(shareToken, url.searchParams.get("participant"));
  const state = createOAuthState({
    shareToken,
    participant,
    friendInvite: url.searchParams.get("friendInvite") || undefined,
    friendGroupInvite: url.searchParams.get("friendGroupInvite") || undefined,
    redirectTo,
    intent: currentUser ? "link" : "signin",
  });
  await rememberOAuthState(state);

  let authUrl: string;

  try {
    authUrl = await buildMicrosoftAuthUrl(state);
  } catch {
    redirect(withMicrosoftError(redirectTo, "not_configured"));
  }

  redirect(authUrl);
}
