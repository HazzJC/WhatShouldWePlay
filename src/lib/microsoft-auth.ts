import { getAppUrl } from "@/lib/app-url";

export type MicrosoftProfile = {
  sub: string;
  email: string | null;
  name: string;
  picture?: string | null;
};

export type MicrosoftAuthErrorCode =
  | "not_configured"
  | "token_exchange_failed"
  | "missing_access_token"
  | "userinfo_failed"
  | "missing_subject";

export class MicrosoftAuthError extends Error {
  code: MicrosoftAuthErrorCode;

  constructor(code: MicrosoftAuthErrorCode, message: string) {
    super(message);
    this.name = "MicrosoftAuthError";
    this.code = code;
  }
}

type MicrosoftUserInfo = {
  sub?: string;
  name?: string;
  email?: string;
  preferred_username?: string;
  picture?: string;
};

function microsoftEnv() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new MicrosoftAuthError("not_configured", "Microsoft sign-in is not configured.");
  }

  return { clientId, clientSecret };
}

export function isMicrosoftAuthConfigured() {
  return Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
}

export async function buildMicrosoftAuthUrl(state: string) {
  const { clientId } = microsoftEnv();
  const appUrl = await getAppUrl();
  const redirectUri = new URL("/auth/microsoft/callback", appUrl).toString();
  const url = new URL("https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize");

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");

  return url.toString();
}

export async function getMicrosoftProfileFromCode(code: string): Promise<MicrosoftProfile> {
  const { clientId, clientSecret } = microsoftEnv();
  const appUrl = await getAppUrl();
  const redirectUri = new URL("/auth/microsoft/callback", appUrl).toString();
  const tokenResponse = await fetch("https://login.microsoftonline.com/consumers/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: "openid profile email",
    }),
  });

  if (!tokenResponse.ok) {
    throw new MicrosoftAuthError("token_exchange_failed", "Microsoft rejected the sign-in request.");
  }

  const tokens = (await tokenResponse.json()) as { access_token?: string };

  if (!tokens.access_token) {
    throw new MicrosoftAuthError("missing_access_token", "Microsoft did not return an access token.");
  }

  const infoResponse = await fetch("https://graph.microsoft.com/oidc/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!infoResponse.ok) {
    throw new MicrosoftAuthError("userinfo_failed", "Microsoft profile information could not be verified.");
  }

  return verifyMicrosoftUserInfo(await infoResponse.json());
}

export function verifyMicrosoftUserInfo(info: MicrosoftUserInfo): MicrosoftProfile {
  if (!info.sub) {
    throw new MicrosoftAuthError("missing_subject", "Microsoft profile is missing an account id.");
  }

  const email = info.email ?? info.preferred_username ?? null;

  return {
    sub: info.sub,
    email,
    name: info.name || email?.split("@")[0] || "Xbox player",
    picture: info.picture ?? null,
  };
}
