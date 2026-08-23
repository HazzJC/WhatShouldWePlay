import { cleanupExpiredRecords } from "@/lib/cleanup";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Cron is not configured.", { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  return Response.json(await cleanupExpiredRecords());
}
