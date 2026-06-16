import crypto from "node:crypto";

export function createShareToken() {
  return crypto.randomBytes(18).toString("base64url");
}
