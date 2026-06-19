import { sendDueDiscordReminders } from "@/lib/discord";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  // Fail closed: an unset secret must not leave this endpoint publicly
  // triggerable (it posts to Discord channels). Vercel Cron sends the secret
  // as `Authorization: Bearer <CRON_SECRET>` when it is configured.
  if (!secret) {
    return new Response("Cron is not configured.", { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await sendDueDiscordReminders();
  return Response.json(result);
}
