import { getAppUrl } from "@/lib/app-url";

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string | null;
};

type GoogleTokenInfo = {
  iss?: string;
  aud?: string;
  exp?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
};

function googleEnv() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google sign-in is not configured.");
  }

  return { clientId, clientSecret };
}

export async function buildGoogleAuthUrl(state: string) {
  const { clientId } = googleEnv();
  const appUrl = await getAppUrl();
  const redirectUri = new URL("/auth/google/callback", appUrl).toString();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");

  return url.toString();
}

export async function getGoogleProfileFromCode(code: string): Promise<GoogleProfile> {
  const { clientId, clientSecret } = googleEnv();
  const appUrl = await getAppUrl();
  const redirectUri = new URL("/auth/google/callback", appUrl).toString();
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("Google rejected the sign-in request.");
  }

  const tokens = (await tokenResponse.json()) as { id_token?: string };

  if (!tokens.id_token) {
    throw new Error("Google did not return an identity token.");
  }

  const infoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokens.id_token)}`);

  if (!infoResponse.ok) {
    throw new Error("Google identity token could not be verified.");
  }

  return verifyGoogleTokenInfo(await infoResponse.json(), clientId);
}

export function verifyGoogleTokenInfo(info: GoogleTokenInfo, clientId = process.env.GOOGLE_CLIENT_ID ?? ""): GoogleProfile {
  if (info.iss !== "https://accounts.google.com" && info.iss !== "accounts.google.com") {
    throw new Error("Google identity token has an invalid issuer.");
  }

  if (!clientId || info.aud !== clientId) {
    throw new Error("Google identity token has an invalid audience.");
  }

  if (!info.exp || Number(info.exp) * 1000 <= Date.now()) {
    throw new Error("Google identity token has expired.");
  }

  if (!info.sub) {
    throw new Error("Google identity token is missing an account id.");
  }

  const emailVerified = info.email_verified === true || info.email_verified === "true";

  if (!info.email || !emailVerified) {
    throw new Error("Google account email is not verified.");
  }

  return {
    sub: info.sub,
    email: info.email,
    emailVerified,
    name: info.name || info.email.split("@")[0] || "Google user",
    picture: info.picture ?? null,
  };
}
