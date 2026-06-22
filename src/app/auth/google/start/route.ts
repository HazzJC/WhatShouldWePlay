import { redirect } from "next/navigation";
import { createOAuthState, getCurrentUser, safeInternalRedirect } from "@/lib/auth";
import { buildGoogleAuthUrl } from "@/lib/google-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const currentUser = await getCurrentUser();
  const state = createOAuthState({
    shareToken: url.searchParams.get("shareToken") || undefined,
    participant: url.searchParams.get("participant") || undefined,
    friendInvite: url.searchParams.get("friendInvite") || undefined,
    friendGroupInvite: url.searchParams.get("friendGroupInvite") || undefined,
    redirectTo: safeInternalRedirect(url.searchParams.get("redirectTo")),
    intent: currentUser ? "link" : "signin",
  });

  redirect(await buildGoogleAuthUrl(state));
}
