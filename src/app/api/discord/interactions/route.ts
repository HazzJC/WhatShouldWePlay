import { handleDiscordInteraction, verifyDiscordRequest, type DiscordInteraction } from "@/lib/discord";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");

  if (!verifyDiscordRequest({ body, signature, timestamp })) {
    return new Response("Invalid Discord request signature.", { status: 401 });
  }

  let interaction: DiscordInteraction;

  try {
    interaction = JSON.parse(body) as DiscordInteraction;
  } catch {
    return new Response("Invalid Discord interaction payload.", { status: 400 });
  }

  try {
    return await handleDiscordInteraction(interaction);
  } catch (error) {
    console.error("[discord] interaction failed", error);
    return Response.json({
      type: 4,
      data: {
        content: "Let's Play Games hit an error while handling that Discord command. Try again in a moment.",
        flags: 64,
      },
    });
  }
}
