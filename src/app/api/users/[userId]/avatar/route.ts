import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { userId } = await params;
  const avatar = await prisma.userAvatar.findUnique({
    where: { userId },
    select: {
      data: true,
      mimeType: true,
      updatedAt: true,
    },
  });

  if (!avatar) {
    return new Response("Avatar not found.", { status: 404 });
  }

  return new Response(new Uint8Array(avatar.data), {
    headers: {
      "Content-Type": avatar.mimeType,
      "Content-Length": String(avatar.data.byteLength),
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Last-Modified": avatar.updatedAt.toUTCString(),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
