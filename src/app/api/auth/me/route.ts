import { getCurrentUserIdentity } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUserIdentity();
  return Response.json(
    { user: user ? { username: user.username, displayName: user.displayName } : null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
