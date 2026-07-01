import { requireMetadataAdmin } from "@/lib/admin";
import { createPlayerMetadataCsv } from "@/lib/player-metadata-csv";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await requireMetadataAdmin();

  const games = await prisma.game.findMany({
    where: {
      userGames: { some: { source: "STEAM" } },
      OR: [{ minPlayers: null }, { maxPlayers: null }],
    },
    select: {
      id: true,
      steamAppId: true,
      title: true,
      minPlayers: true,
      maxPlayers: true,
    },
    orderBy: { title: "asc" },
  });
  const csv = createPlayerMetadataCsv(games);
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="missing-player-metadata-${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
