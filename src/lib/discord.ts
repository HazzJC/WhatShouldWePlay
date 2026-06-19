import nacl from "tweetnacl";
import { fromZonedTime } from "date-fns-tz";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { getAppUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { dateRangeFromPreset, formatSlotRange, rankBestTimes, responseMap, type DatePreset } from "@/lib/scheduling";
import { createShareToken } from "@/lib/tokens";

export type DiscordInteraction = {
  id: string;
  type: number;
  token?: string;
  guild_id?: string;
  channel_id?: string;
  member?: { user?: DiscordUser };
  user?: DiscordUser;
  data?: {
    name?: string;
    custom_id?: string;
    options?: DiscordCommandOption[];
  };
};

type DiscordUser = {
  id: string;
  username?: string;
  global_name?: string | null;
};

type DiscordCommandOption = {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: DiscordCommandOption[];
};

type DiscordMessage = {
  content?: string;
  embeds?: Array<Record<string, unknown>>;
  components?: Array<Record<string, unknown>>;
};

const interactionTypes = {
  ping: 1,
  applicationCommand: 2,
  messageComponent: 3,
} as const;

const responseTypes = {
  pong: 1,
  channelMessageWithSource: 4,
  deferredChannelMessageWithSource: 5,
} as const;

export const reminderChoices = ["No reminders", "24 hours before", "2 hours before", "15 minutes before", "Custom"] as const;

export const discordCommandPayload = {
  name: "letsplay",
  description: "Create and manage Let's Play Games sessions",
  options: [
    {
      type: 1,
      name: "create",
      description: "Create a game night planning session",
      options: [
        { type: 3, name: "title", description: "Game night name", required: false, max_length: 120 },
        { type: 4, name: "duration", description: "Duration in hours", required: false, min_value: 1, max_value: 8 },
        { type: 4, name: "players", description: "Minimum players", required: false, min_value: 2, max_value: 30 },
        {
          type: 3,
          name: "date",
          description: "Date window",
          required: false,
          choices: [
            { name: "Tonight", value: "tonight" },
            { name: "This week", value: "this_week" },
            { name: "This month", value: "this_month" },
          ],
        },
        {
          type: 3,
          name: "mode",
          description: "Online or in person",
          required: false,
          choices: [
            { name: "Online", value: "ONLINE" },
            { name: "In person", value: "IN_PERSON" },
          ],
        },
        {
          type: 3,
          name: "reminder",
          description: "Reminder timing",
          required: false,
          choices: reminderChoices.map((choice) => ({ name: choice, value: choice })),
        },
      ],
    },
    { type: 1, name: "status", description: "Show the current best time for this channel's latest session" },
    { type: 1, name: "remind", description: "Ping the channel to fill availability" },
    { type: 1, name: "games", description: "Suggest current game matches for the session" },
  ],
};

export function verifyDiscordRequest({
  body,
  signature,
  timestamp,
  publicKey = process.env.DISCORD_PUBLIC_KEY,
}: {
  body: string;
  signature: string | null;
  timestamp: string | null;
  publicKey?: string;
}) {
  if (!signature || !timestamp || !publicKey) {
    return false;
  }

  try {
    const message = new Uint8Array(new TextEncoder().encode(`${timestamp}${body}`));
    return nacl.sign.detached.verify(message, hexToBytes(signature), hexToBytes(publicKey));
  } catch {
    return false;
  }
}

export async function handleDiscordInteraction(interaction: DiscordInteraction) {
  if (interaction.type === interactionTypes.ping) {
    return discordJson({ type: responseTypes.pong });
  }

  if (interaction.type === interactionTypes.messageComponent) {
    return handleDiscordComponent(interaction);
  }

  if (interaction.type !== interactionTypes.applicationCommand || interaction.data?.name !== "letsplay") {
    return discordMessage("I do not know that command yet.", true);
  }

  const subcommand = interaction.data.options?.[0];

  if (!subcommand) {
    return discordMessage("Try `/letsplay create`, `/letsplay status`, `/letsplay remind`, or `/letsplay games`.", true);
  }

  if (subcommand.name === "create") {
    const result = await createDiscordSessionFromInteraction(interaction, subcommand.options ?? []);
    return discordJson({ type: responseTypes.channelMessageWithSource, data: sessionDiscordMessage(result) });
  }

  const integration = await latestDiscordIntegration(interaction);

  if (!integration) {
    return discordMessage("No session is linked to this channel yet. Use `/letsplay create` first.", true);
  }

  if (subcommand.name === "status") {
    return discordJson({ type: responseTypes.channelMessageWithSource, data: await statusDiscordMessage(integration.sessionId) });
  }

  if (subcommand.name === "remind") {
    const message = await reminderDiscordMessage(integration.sessionId);
    await postDiscordChannelMessage(integration.channelId, message);
    await logDiscordNotification({
      sessionId: integration.sessionId,
      guildId: integration.guildId,
      channelId: integration.channelId,
      type: "availability_ping",
      status: "sent",
    });
    return discordMessage("Posted an availability reminder in this channel.", true);
  }

  if (subcommand.name === "games") {
    return discordJson({ type: responseTypes.channelMessageWithSource, data: await gamesDiscordMessage(integration.sessionId) });
  }

  return discordMessage("That `/letsplay` subcommand is not implemented yet.", true);
}

export async function createDiscordSessionFromInteraction(interaction: DiscordInteraction, options: DiscordCommandOption[]) {
  const discordUser = interaction.member?.user ?? interaction.user;
  const timezone = "Europe/London";
  const title = stringOption(options, "title") ?? "Game night";
  const duration = numberOption(options, "duration") ?? 2;
  const minimumPlayers = numberOption(options, "players") ?? 4;
  const datePreset = (stringOption(options, "date") ?? "this_week") as DatePreset;
  const mode = stringOption(options, "mode") === "IN_PERSON" ? "IN_PERSON" : "ONLINE";
  const reminder = stringOption(options, "reminder") ?? "24 hours before";
  const dateRange = dateRangeFromPreset(datePreset, timezone);

  const session = await prisma.session.create({
    data: {
      title,
      shareToken: createShareToken(),
      mode,
      requiredDuration: duration,
      minimumPlayerCount: minimumPlayers,
      dateRangeStart: fromZonedTime(`${dateRange.startsOn}T00:00:00`, timezone),
      dateRangeEnd: fromZonedTime(`${dateRange.endsOn}T00:00:00`, timezone),
      dailyStartHour: 18,
      dailyEndHour: 23,
      timezone,
      discordChannel: interaction.channel_id ? `<#${interaction.channel_id}>` : null,
      reminderPreferences: normalizeReminderPreferences([reminder]),
      participants: {
        create: {
          name: discordDisplayName(discordUser),
          isHost: true,
          discordUserId: discordUser?.id ?? null,
          discordUsername: discordUser?.username ?? null,
        },
      },
      discordIntegrations:
        interaction.guild_id && interaction.channel_id
          ? {
              create: {
                guildId: interaction.guild_id,
                channelId: interaction.channel_id,
                createdByUserId: discordUser?.id ?? null,
              },
            }
          : undefined,
    },
    include: { participants: true, discordIntegrations: true },
  });

  return {
    session,
    host: session.participants[0],
    integration: session.discordIntegrations[0] ?? null,
    appUrl: await getAppUrl(),
  };
}

export async function latestDiscordIntegration(interaction: Pick<DiscordInteraction, "guild_id" | "channel_id">) {
  if (!interaction.guild_id || !interaction.channel_id) {
    return null;
  }

  return prisma.discordIntegration.findFirst({
    where: { guildId: interaction.guild_id, channelId: interaction.channel_id },
    orderBy: { createdAt: "desc" },
  });
}

export async function handleDiscordComponent(interaction: DiscordInteraction) {
  const customId = interaction.data?.custom_id ?? "";
  const [kind, shareToken] = customId.split(":");

  if (!shareToken) {
    return discordMessage("That button is missing session context.", true);
  }

  if (kind === "attendance") {
    const session = await prisma.session.findUnique({
      where: { shareToken },
      select: { id: true },
    });
    const discordUser = interaction.member?.user ?? interaction.user;

    if (!session || !discordUser) {
      return discordMessage("Could not confirm attendance for this session.", true);
    }

    const participant = await prisma.participant.findFirst({
      where: { sessionId: session.id, discordUserId: discordUser.id },
      select: { id: true },
    });

    await prisma.discordAttendance.upsert({
      where: { sessionId_discordUserId: { sessionId: session.id, discordUserId: discordUser.id } },
      create: {
        sessionId: session.id,
        participantId: participant?.id ?? null,
        discordUserId: discordUser.id,
        discordUsername: discordUser.username ?? null,
        status: "CONFIRMED",
      },
      update: {
        participantId: participant?.id ?? undefined,
        discordUsername: discordUser.username ?? null,
        status: "CONFIRMED",
      },
    });

    return discordMessage("You are confirmed for this session.", true);
  }

  if (kind === "best") {
    const session = await prisma.session.findUnique({ where: { shareToken }, select: { id: true } });
    return session ? discordJson({ type: responseTypes.channelMessageWithSource, data: await statusDiscordMessage(session.id) }) : discordMessage("Session not found.", true);
  }

  return discordMessage("That button is not supported yet.", true);
}

export function normalizeReminderPreferences(values: string[]) {
  const unique = [...new Set(values.filter(Boolean))];

  if (unique.length === 0 || unique.includes("No reminders")) {
    return [];
  }

  return unique.map((value) => {
    if (value === "24 hours before") {
      return { label: value, minutesBefore: 24 * 60 };
    }

    if (value === "2 hours before") {
      return { label: value, minutesBefore: 2 * 60 };
    }

    if (value === "15 minutes before") {
      return { label: value, minutesBefore: 15 };
    }

    const customMatch = /^Custom:(\d+)$/.exec(value);

    if (customMatch) {
      return { label: "Custom", minutesBefore: Number(customMatch[1]) };
    }

    return { label: value, minutesBefore: 24 * 60 };
  });
}

export function reminderDueAt(lockedStartTime: Date, reminder: { minutesBefore?: number | null }) {
  return new Date(lockedStartTime.getTime() - (reminder.minutesBefore ?? 0) * 60_000);
}

export async function sendDueDiscordReminders(now = new Date()) {
  const sessions = await prisma.session.findMany({
    where: {
      lockedStartTime: { not: null, gt: now },
      discordIntegrations: { some: {} },
    },
    include: { discordIntegrations: true },
  });
  let sent = 0;

  for (const session of sessions) {
    const reminders = parseReminderJson(session.reminderPreferences);

    for (const reminder of reminders) {
      const scheduledFor = reminderDueAt(session.lockedStartTime!, reminder);

      if (scheduledFor > now) {
        continue;
      }

      for (const integration of session.discordIntegrations) {
        const type = `reminder:${reminder.label}:${reminder.minutesBefore}`;
        const created = await createNotificationIfMissing({
          sessionId: session.id,
          guildId: integration.guildId,
          channelId: integration.channelId,
          type,
          scheduledFor,
        });

        if (!created) {
          continue;
        }

        try {
          const message = await confirmedTimeDiscordMessage(session.id, `Reminder: ${session.title} starts soon.`);
          const response = await postDiscordChannelMessage(integration.channelId, message);
          await prisma.discordNotificationLog.update({
            where: { id: created.id },
            data: { status: "sent", messageId: response?.id ?? null },
          });
          sent += 1;
        } catch (error) {
          await prisma.discordNotificationLog.update({
            where: { id: created.id },
            data: { status: "failed", error: error instanceof Error ? error.message : "Unknown Discord send error" },
          });
        }
      }
    }
  }

  return { sent };
}

export async function announceLockedSessionToDiscord(shareToken: string) {
  const session = await prisma.session.findUnique({
    where: { shareToken },
    include: { discordIntegrations: true },
  });

  if (!session?.lockedStartTime || !session.lockedEndTime) {
    return;
  }

  for (const integration of session.discordIntegrations) {
    const created = await createNotificationIfMissing({
      sessionId: session.id,
      guildId: integration.guildId,
      channelId: integration.channelId,
      type: "confirmed_time",
      scheduledFor: session.lockedStartTime,
    });

    if (!created) {
      continue;
    }

    try {
      const message = await confirmedTimeDiscordMessage(session.id, "Confirmed game night time");
      const response = await postDiscordChannelMessage(integration.channelId, message);
      await prisma.discordNotificationLog.update({
        where: { id: created.id },
        data: { status: "sent", messageId: response?.id ?? null },
      });
    } catch (error) {
      await prisma.discordNotificationLog.update({
        where: { id: created.id },
        data: { status: "failed", error: error instanceof Error ? error.message : "Unknown Discord send error" },
      });
    }
  }
}

export async function announceDiscordPriceAlerts(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      discordIntegrations: true,
      priceAlertEvents: {
        orderBy: { triggeredAt: "desc" },
        take: 6,
      },
    },
  });

  if (!session || session.discordIntegrations.length === 0 || session.priceAlertEvents.length === 0) {
    return;
  }

  for (const event of session.priceAlertEvents) {
    for (const integration of session.discordIntegrations) {
      const created = await createNotificationIfMissing({
        sessionId,
        guildId: integration.guildId,
        channelId: integration.channelId,
        type: `sale_alert:${event.id}`,
        scheduledFor: event.triggeredAt,
      });

      if (!created) {
        continue;
      }

      try {
        const response = await postDiscordChannelMessage(integration.channelId, {
          content: `**Sale alert**\n${event.message}${event.url ? `\n${event.url}` : ""}`,
        });
        await prisma.discordNotificationLog.update({
          where: { id: created.id },
          data: { status: "sent", messageId: response?.id ?? null },
        });
      } catch (error) {
        await prisma.discordNotificationLog.update({
          where: { id: created.id },
          data: { status: "failed", error: error instanceof Error ? error.message : "Unknown Discord send error" },
        });
      }
    }
  }
}

export async function postDiscordChannelMessage(channelId: string, message: DiscordMessage) {
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!token) {
    throw new Error("DISCORD_BOT_TOKEN is not configured.");
  }

  const response = await fetchWithTimeout(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
    timeoutMs: 5000,
  });

  if (!response.ok) {
    throw new Error(`Discord message failed with HTTP ${response.status}.`);
  }

  return (await response.json()) as { id?: string };
}

async function createNotificationIfMissing(input: {
  sessionId: string;
  guildId?: string | null;
  channelId?: string | null;
  type: string;
  scheduledFor?: Date | null;
}) {
  const existing = await prisma.discordNotificationLog.findFirst({
    where: {
      sessionId: input.sessionId,
      type: input.type,
      scheduledFor: input.scheduledFor ?? null,
    },
  });

  if (existing) {
    return null;
  }

  return prisma.discordNotificationLog.create({
    data: {
      sessionId: input.sessionId,
      guildId: input.guildId ?? null,
      channelId: input.channelId ?? null,
      type: input.type,
      scheduledFor: input.scheduledFor ?? null,
      status: "pending",
    },
  });
}

export async function logDiscordNotification(input: {
  sessionId: string;
  guildId?: string | null;
  channelId?: string | null;
  type: string;
  status: string;
  messageId?: string | null;
  error?: string | null;
}) {
  return prisma.discordNotificationLog.create({
    data: {
      sessionId: input.sessionId,
      guildId: input.guildId ?? null,
      channelId: input.channelId ?? null,
      type: input.type,
      status: input.status,
      messageId: input.messageId ?? null,
      error: input.error ?? null,
    },
  });
}

function sessionDiscordMessage({
  session,
  host,
  appUrl,
}: Awaited<ReturnType<typeof createDiscordSessionFromInteraction>>) {
  const planUrl = `${appUrl}/s/${session.shareToken}?participant=${host.id}`;
  const pickUrl = `${appUrl}/s/${session.shareToken}?tab=pick&participant=${host.id}`;

  return {
    content: `**${session.title}** is ready. Fill in your availability here:\n${planUrl}`,
    embeds: [
      {
        title: "Current best time",
        description: "Waiting for availability responses.",
        color: 0x148a8a,
        fields: [
          { name: "Duration", value: `${session.requiredDuration} hour${session.requiredDuration === 1 ? "" : "s"}`, inline: true },
          { name: "Players", value: `${session.minimumPlayerCount}+`, inline: true },
        ],
      },
    ],
    components: sessionButtons(session.shareToken, planUrl, pickUrl),
  };
}

async function statusDiscordMessage(sessionId: string): Promise<DiscordMessage> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { participants: { include: { responses: true } } },
  });

  if (!session) {
    return { content: "Session not found." };
  }

  const participantAvailability = session.participants.map((participant) => ({
    participantId: participant.id,
    name: participant.name,
    responses: responseMap(participant.responses),
  }));
  const [best] = rankBestTimes(session, participantAvailability);
  const appUrl = await getAppUrl();
  const planUrl = `${appUrl}/s/${session.shareToken}`;
  const submitted = participantAvailability.filter((participant) => participant.responses.size > 0).length;

  return {
    content: best
      ? `Current best time: **${formatSlotRange(best.startsAt, best.endsAt, session.timezone)}**\n${best.availableCount} of ${session.participants.length} available.`
      : `No best time yet. ${submitted} of ${session.participants.length} players have submitted availability.`,
    components: sessionButtons(session.shareToken, planUrl, `${planUrl}?tab=pick`),
  };
}

async function reminderDiscordMessage(sessionId: string): Promise<DiscordMessage> {
  const session = await prisma.session.findUnique({ where: { id: sessionId }, include: { participants: true } });
  const appUrl = await getAppUrl();

  if (!session) {
    return { content: "Session not found." };
  }

  return {
    content: `Time to fill availability for **${session.title}**.\n${appUrl}/s/${session.shareToken}`,
    components: sessionButtons(session.shareToken, `${appUrl}/s/${session.shareToken}`, `${appUrl}/s/${session.shareToken}?tab=pick`),
  };
}

async function confirmedTimeDiscordMessage(sessionId: string, title: string): Promise<DiscordMessage> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  const appUrl = await getAppUrl();

  if (!session?.lockedStartTime || !session.lockedEndTime) {
    return { content: "Session time is not locked yet." };
  }

  return {
    content: `**${title}**\n${session.title}: **${formatSlotRange(session.lockedStartTime, session.lockedEndTime, session.timezone)}**\nConfirm if you can make it.`,
    components: sessionButtons(session.shareToken, `${appUrl}/s/${session.shareToken}`, `${appUrl}/s/${session.shareToken}?tab=pick`, true),
  };
}

async function gamesDiscordMessage(sessionId: string): Promise<DiscordMessage> {
  const games = await prisma.sessionGame.findMany({
    where: { sessionId },
    include: { game: true, signals: true },
    take: 5,
  });

  if (games.length === 0) {
    return { content: "No games are shortlisted yet. Open Pick and add a few suggestions." };
  }

  const lines = games
    .map((sessionGame) => {
      const have = sessionGame.signals.filter((signal) => signal.signal === "OWNED" || signal.signal === "AVAILABLE_TO_PLAY").length;
      return `• **${sessionGame.game.title}** — ${have} have`;
    })
    .join("\n");

  return { content: `Current game suggestions:\n${lines}` };
}

function sessionButtons(shareToken: string, planUrl: string, pickUrl: string, attendance = false) {
  const components = [
    { type: 2, style: 5, label: "Fill availability", url: planUrl },
    { type: 2, style: 5, label: "Open Pick", url: pickUrl },
    { type: 2, style: 2, label: "Show current best", custom_id: `best:${shareToken}` },
  ];

  if (attendance) {
    components.unshift({ type: 2, style: 3, label: "Confirm attendance", custom_id: `attendance:${shareToken}` });
  }

  return [{ type: 1, components }];
}

function discordMessage(content: string, ephemeral = false) {
  return discordJson({
    type: responseTypes.channelMessageWithSource,
    data: {
      content,
      flags: ephemeral ? 64 : undefined,
    },
  });
}

function discordJson(payload: unknown) {
  return Response.json(payload);
}

function stringOption(options: DiscordCommandOption[], name: string) {
  const value = options.find((option) => option.name === name)?.value;
  return typeof value === "string" ? value : null;
}

function numberOption(options: DiscordCommandOption[], name: string) {
  const value = options.find((option) => option.name === name)?.value;
  return typeof value === "number" ? value : null;
}

function discordDisplayName(user?: DiscordUser) {
  return user?.global_name ?? user?.username ?? "Discord host";
}

function parseReminderJson(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as Array<{ label: string; minutesBefore: number }>;
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return normalizeReminderPreferences([item])[0] ?? null;
      }

      if (item && typeof item === "object" && "minutesBefore" in item) {
        const reminder = item as { label?: unknown; minutesBefore?: unknown };
        return {
          label: typeof reminder.label === "string" ? reminder.label : "Reminder",
          minutesBefore: typeof reminder.minutesBefore === "number" ? reminder.minutesBefore : 0,
        };
      }

      return null;
    })
    .filter((item): item is { label: string; minutesBefore: number } => Boolean(item));
}

function hexToBytes(hex: string) {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex value.");
  }

  const bytes = new Uint8Array(hex.length / 2);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}
