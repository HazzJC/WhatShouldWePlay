import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { z } from "zod";

export const playerMetadataCsvHeaders = [
  "game_id",
  "steam_app_id",
  "title",
  "min_players",
  "max_players",
] as const;

const rowSchema = z.object({
  game_id: z.string().trim().min(1),
  min_players: z.coerce.number().int().min(1).max(1000),
  max_players: z.coerce.number().int().min(1).max(1000),
}).refine((row) => row.max_players >= row.min_players, {
  message: "max_players must be at least min_players",
});

export type PlayerMetadataCsvGame = {
  id: string;
  steamAppId: number | null;
  title: string;
  minPlayers: number | null;
  maxPlayers: number | null;
};

export type PlayerMetadataCsvUpdate = {
  gameId: string;
  minPlayers: number;
  maxPlayers: number;
};

export function createPlayerMetadataCsv(games: PlayerMetadataCsvGame[]) {
  return stringify(
    games.map((game) => ({
      game_id: game.id,
      steam_app_id: game.steamAppId ?? "",
      title: game.title,
      min_players: game.minPlayers ?? 1,
      max_players: game.maxPlayers ?? "",
    })),
    {
      header: true,
      columns: [...playerMetadataCsvHeaders],
      bom: true,
    },
  );
}

export function parsePlayerMetadataCsv(csv: string) {
  let rows: Record<string, string>[];

  try {
    rows = parse(csv, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
    });
  } catch {
    return {
      updates: [] as PlayerMetadataCsvUpdate[],
      skipped: 0,
      errors: ["The file is not valid CSV."],
    };
  }

  if (rows.length > 1000) {
    return {
      updates: [] as PlayerMetadataCsvUpdate[],
      skipped: 0,
      errors: ["CSV files can contain at most 1,000 game rows."],
    };
  }

  const headers = Object.keys(rows[0] ?? {});
  const missingHeaders = playerMetadataCsvHeaders.filter((header) => !headers.includes(header));

  if (missingHeaders.length > 0) {
    return {
      updates: [] as PlayerMetadataCsvUpdate[],
      skipped: 0,
      errors: [`Missing columns: ${missingHeaders.join(", ")}.`],
    };
  }

  const updates: PlayerMetadataCsvUpdate[] = [];
  const errors: string[] = [];
  const seenIds = new Set<string>();
  let skipped = 0;

  rows.forEach((row, index) => {
    const rowNumber = index + 2;

    if (!row.min_players || !row.max_players) {
      skipped += 1;
      return;
    }

    const parsed = rowSchema.safeParse(row);

    if (!parsed.success) {
      errors.push(`Row ${rowNumber}: ${parsed.error.issues[0]?.message ?? "invalid player counts"}.`);
      return;
    }

    if (seenIds.has(parsed.data.game_id)) {
      errors.push(`Row ${rowNumber}: duplicate game_id.`);
      return;
    }

    seenIds.add(parsed.data.game_id);
    updates.push({
      gameId: parsed.data.game_id,
      minPlayers: parsed.data.min_players,
      maxPlayers: parsed.data.max_players,
    });
  });

  return { updates, skipped, errors };
}
