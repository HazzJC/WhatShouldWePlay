import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/app-url";
import { safeInternalRedirect } from "@/lib/auth";
import { buildSteamOpenIdUrl } from "@/lib/steam";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const shareToken = url.searchParams.get("shareToken") ?? "";
  const participant = url.searchParams.get("participant") ?? "";
  const friendInvite = url.searchParams.get("friendInvite") ?? "";
  const redirectTo = safeInternalRedirect(url.searchParams.get("redirectTo"));
  const appUrl = await getAppUrl();
  const callback = new URL("/auth/steam/callback", appUrl);

  if (shareToken) {
    callback.searchParams.set("shareToken", shareToken);
  }

  if (participant) {
    callback.searchParams.set("participant", participant);
  }

  if (friendInvite) {
    callback.searchParams.set("friendInvite", friendInvite);
  }

  if (redirectTo !== "/") {
    callback.searchParams.set("redirectTo", redirectTo);
  }

  redirect(buildSteamOpenIdUrl(callback.toString(), appUrl));
}
