import { notFound } from "next/navigation";
import { getAppUrl } from "@/lib/app-url";
import { createIcsEvent } from "@/lib/ics";
import { prisma } from "@/lib/prisma";

type RouteProps = {
  params: Promise<{ shareToken: string }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  const { shareToken } = await params;
  const session = await prisma.session.findUnique({
    where: { shareToken },
  });

  if (!session || !session.lockedStartTime || !session.lockedEndTime) {
    notFound();
  }

  const appUrl = await getAppUrl();
  const ics = createIcsEvent({
    title: session.title,
    startsAt: session.lockedStartTime,
    endsAt: session.lockedEndTime,
    description: `Game night planned with Let's Play Games.\n${appUrl}/s/${session.shareToken}`,
    url: `${appUrl}/s/${session.shareToken}`,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${session.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${session.shareToken}.ics"`,
    },
  });
}
