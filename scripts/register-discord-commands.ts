import { discordCommandPayload } from "../src/lib/discord";

async function main() {
  const applicationId = process.env.DISCORD_APPLICATION_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!applicationId || !botToken) {
    throw new Error("DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN are required.");
  }

  const url = guildId
    ? `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`
    : `https://discord.com/api/v10/applications/${applicationId}/commands`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([discordCommandPayload]),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord command registration failed with HTTP ${response.status}: ${body}`);
  }

  console.log(guildId ? `Registered guild commands for ${guildId}.` : "Registered global commands.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
