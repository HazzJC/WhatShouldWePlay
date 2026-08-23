import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/app-url";
import { createOAuthState, getCurrentUser, oauthParticipantForShareToken, rememberOAuthState, safeInternalRedirect } from "@/lib/auth";
import { buildSteamOpenIdUrl } from "@/lib/steam";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const shareToken = url.searchParams.get("shareToken") ?? "";
  const participant = await oauthParticipantForShareToken(shareToken, url.searchParams.get("participant"));
  const friendInvite = url.searchParams.get("friendInvite") ?? "";
  const redirectTo = safeInternalRedirect(url.searchParams.get("redirectTo"));
  const appUrl = await getAppUrl();
  const callback = new URL("/auth/steam/callback", appUrl);
  const state = createOAuthState({
    shareToken: shareToken || undefined,
    participant,
    friendInvite: friendInvite || undefined,
    redirectTo,
    intent: (await getCurrentUser()) ? "link" : "signin",
  });
  await rememberOAuthState(state);
  callback.searchParams.set("state", state);

  redirect(buildSteamOpenIdUrl(callback.toString(), appUrl));
}
