import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

type SteamAppDetailsResponse = Record<
  string,
  {
    success: boolean;
    data?: {
      is_free?: boolean;
      price_overview?: {
        currency?: string;
        initial?: number;
        final?: number;
        discount_percent?: number;
      };
    };
  }
>;

export async function fetchSteamAppDetails(steamAppId: number) {
  const url = new URL("https://store.steampowered.com/api/appdetails");
  url.searchParams.set("appids", String(steamAppId));
  url.searchParams.set("filters", "price_overview,basic");
  url.searchParams.set("cc", "gb");

  const response = await fetchWithTimeout(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    timeoutMs: 4000,
  });

  if (!response.ok) {
    throw new Error(`Steam store lookup failed with ${response.status}`);
  }

  const payload = (await response.json()) as SteamAppDetailsResponse;
  return payload[String(steamAppId)] ?? null;
}
