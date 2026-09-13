import { redirect } from "next/navigation";
import { redeemDiscordHostHandoff } from "@/lib/discord-handoff";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const destination = await redeemDiscordHostHandoff(token);
  redirect(destination ?? "/?handoff=invalid");
}
