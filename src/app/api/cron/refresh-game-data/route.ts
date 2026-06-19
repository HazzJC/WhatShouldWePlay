import { refreshActiveGameData } from "@/lib/game-data-refresh";

// Daily refresh of the shared game dataset (metadata + prices/sales) for games
// that are in use. See src/lib/game-data-refresh.ts for the rationale.
// Allow up to the platform's max so a full batch of external lookups can finish.
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  // Fail closed: this endpoint issues external API calls and DB writes, so an
  // unset secret must not leave it publicly triggerable.
  if (!secret) {
    return new Response("Cron is not configured.", { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await refreshActiveGameData();
  return Response.json(result);
}
