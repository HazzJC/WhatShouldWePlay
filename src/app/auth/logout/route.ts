import { redirect } from "next/navigation";
import { clearUserSession } from "@/lib/auth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const redirectTo = String(formData.get("redirectTo") ?? "/");

  await clearUserSession();
  redirect(redirectTo.startsWith("/") ? redirectTo : "/");
}
