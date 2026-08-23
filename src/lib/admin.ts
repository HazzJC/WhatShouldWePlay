import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export function isMetadataAdmin(user: { id?: string; role?: string | null } | null | undefined) {
  if (!user) return false;
  if (user.role === "METADATA_ADMIN") return true;
  const configuredIds = new Set(
    (process.env.METADATA_ADMIN_USER_IDS ?? "").split(",").map((value) => value.trim()).filter(Boolean),
  );
  return Boolean(user.id && configuredIds.has(user.id));
}

export async function requireMetadataAdmin() {
  const user = await getCurrentUser();

  if (!isMetadataAdmin(user)) {
    notFound();
  }

  return user;
}
