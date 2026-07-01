import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const metadataAdminUsername = "hazzjc";

export function isMetadataAdmin(user: { normalizedUsername?: string | null } | null | undefined) {
  return user?.normalizedUsername === metadataAdminUsername;
}

export async function requireMetadataAdmin() {
  const user = await getCurrentUser();

  if (!isMetadataAdmin(user)) {
    notFound();
  }

  return user;
}
