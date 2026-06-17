import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/app-url";
import { buildSteamOpenIdUrl } from "@/lib/steam";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const shareToken = url.searchParams.get("shareToken") ?? "";
  const participant = url.searchParams.get("participant") ?? "";
  const appUrl = await getAppUrl();
  const callback = new URL("/auth/steam/callback", appUrl);

  if (shareToken) {
    callback.searchParams.set("shareToken", shareToken);
  }

  if (participant) {
    callback.searchParams.set("participant", participant);
  }

  redirect(buildSteamOpenIdUrl(callback.toString(), appUrl));
}
