// One-click "Connect account" provider registry.
// Each entry knows how to build its OAuth authorize URL, exchange an
// authorization code for an access token, and which GenerateRequest field the
// resulting token fills. Env var names match CONNECT-SETUP.md exactly.
//
// Tokens and authorization codes are never logged; exchange failures throw
// short machine-readable messages that contain neither.

import type { GenerateRequest } from "@/lib/types";

export type ConnectProviderId = "github" | "linear" | "notion" | "figma" | "vercel" | "stripe" | "google" | "linkedin";

/** The GenerateRequest credential fields a Connect token can fill. */
export type ConnectRequestField = Extract<
  keyof GenerateRequest,
  "githubToken" | "linearApiKey" | "notionToken" | "figmaToken" | "vercelToken" | "stripeMetricsKey" | "googleToken" | "linkedinToken"
>;

export interface ConnectProvider {
  id: ConnectProviderId;
  label: string;
  authorizeUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<string>; // returns access token
  requestField: ConnectRequestField;
  configured(): boolean; // env vars present
  note?: string; // extra form requirements, e.g. Figma team id
}

const TIMEOUT_MS = 15_000;

function env(name: string): string {
  return process.env[name] ?? "";
}

function basicAuth(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

/**
 * POST to a token endpoint and return access_token. Throws short codes on
 * failure — never the authorization code, token, or raw response body.
 */
async function postForToken(
  url: string,
  body: string,
  contentType: string,
  extraHeaders?: Record<string, string>
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        Accept: "application/json",
        ...extraHeaders,
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new Error("token_endpoint_unreachable");
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error(`token_response_unreadable_http_${res.status}`);
  }

  const accessToken =
    data && typeof data === "object" ? (data as { access_token?: unknown }).access_token : undefined;
  if (!res.ok || typeof accessToken !== "string" || accessToken.length === 0) {
    throw new Error(`token_exchange_failed_http_${res.status}`);
  }
  return accessToken;
}

export const CONNECT_PROVIDERS: ConnectProvider[] = [
  {
    id: "github",
    label: "GitHub",
    requestField: "githubToken",
    note: "One click. We watch every repo in your org, you never paste a URL again.",
    // One-click manual connect (server GITHUB_TOKEN or a pasted PAT) is the
    // primary path; the OAuth route additionally lights up when an OAuth app
    // with our callback exists.
    configured: () =>
      Boolean(env("GITHUB_TOKEN")) || Boolean(env("GITHUB_CLIENT_ID") && env("GITHUB_CLIENT_SECRET")),
    authorizeUrl: (state, redirectUri) =>
      `https://github.com/login/oauth/authorize?${new URLSearchParams({
        client_id: env("GITHUB_CLIENT_ID"),
        redirect_uri: redirectUri,
        scope: "repo read:org",
        state,
      }).toString()}`,
    exchangeCode: (code, redirectUri) =>
      postForToken(
        "https://github.com/login/oauth/access_token",
        new URLSearchParams({
          client_id: env("GITHUB_CLIENT_ID"),
          client_secret: env("GITHUB_CLIENT_SECRET"),
          code,
          redirect_uri: redirectUri,
        }).toString(),
        "application/x-www-form-urlencoded"
      ),
  },
  {
    id: "linear",
    label: "Linear",
    requestField: "linearApiKey",
    configured: () => Boolean(env("LINEAR_CLIENT_ID") && env("LINEAR_CLIENT_SECRET")),
    authorizeUrl: (state, redirectUri) =>
      `https://linear.app/oauth/authorize?${new URLSearchParams({
        response_type: "code",
        client_id: env("LINEAR_CLIENT_ID"),
        redirect_uri: redirectUri,
        scope: "read",
        state,
      }).toString()}`,
    exchangeCode: (code, redirectUri) =>
      postForToken(
        "https://api.linear.app/oauth/token",
        new URLSearchParams({
          grant_type: "authorization_code",
          client_id: env("LINEAR_CLIENT_ID"),
          client_secret: env("LINEAR_CLIENT_SECRET"),
          code,
          redirect_uri: redirectUri,
        }).toString(),
        "application/x-www-form-urlencoded"
      ),
  },
  {
    id: "notion",
    label: "Notion",
    requestField: "notionToken",
    configured: () => Boolean(env("NOTION_CLIENT_ID") && env("NOTION_CLIENT_SECRET")),
    authorizeUrl: (state, redirectUri) =>
      `https://api.notion.com/v1/oauth/authorize?${new URLSearchParams({
        owner: "user",
        response_type: "code",
        client_id: env("NOTION_CLIENT_ID"),
        redirect_uri: redirectUri,
        state,
      }).toString()}`,
    exchangeCode: (code, redirectUri) =>
      postForToken(
        "https://api.notion.com/v1/oauth/token",
        JSON.stringify({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
        "application/json",
        { Authorization: basicAuth(env("NOTION_CLIENT_ID"), env("NOTION_CLIENT_SECRET")) }
      ),
  },
  {
    id: "figma",
    label: "Figma",
    requestField: "figmaToken",
    note: "Figma also needs your team id (from the team URL) in the form",
    configured: () => Boolean(env("FIGMA_CLIENT_ID") && env("FIGMA_CLIENT_SECRET")),
    authorizeUrl: (state, redirectUri) =>
      `https://www.figma.com/oauth?${new URLSearchParams({
        client_id: env("FIGMA_CLIENT_ID"),
        redirect_uri: redirectUri,
        // Figma granular scopes (2025+ apps): metadata scopes cover listing
        // team projects/files and last-modified stamps — all our fetcher needs.
        scope: "file_metadata:read,folder_metadata:read",
        state,
        response_type: "code",
      }).toString()}`,
    exchangeCode: (code, redirectUri) =>
      postForToken(
        "https://api.figma.com/v1/oauth/token",
        new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }).toString(),
        "application/x-www-form-urlencoded",
        { Authorization: basicAuth(env("FIGMA_CLIENT_ID"), env("FIGMA_CLIENT_SECRET")) }
      ),
  },
  {
    id: "vercel",
    label: "Vercel",
    requestField: "vercelToken",
    configured: () => Boolean(env("VERCEL_CLIENT_ID") && env("VERCEL_CLIENT_SECRET")),
    // Marketplace integrations install via the integration page, not the
    // legacy /oauth/authorize route. Vercel redirects to the integration's
    // configured Redirect URL with code and state.
    authorizeUrl: (state) =>
      `https://vercel.com/integrations/${env("VERCEL_INTEGRATION_SLUG") || "caden-connect"}/new?${new URLSearchParams({
        state,
      }).toString()}`,
    exchangeCode: (code, redirectUri) =>
      postForToken(
        "https://api.vercel.com/v2/oauth/access_token",
        new URLSearchParams({
          client_id: env("VERCEL_CLIENT_ID"),
          client_secret: env("VERCEL_CLIENT_SECRET"),
          code,
          redirect_uri: redirectUri,
        }).toString(),
        "application/x-www-form-urlencoded"
      ),
  },
  {
    id: "stripe",
    label: "Stripe",
    requestField: "stripeMetricsKey",
    // Manual paste-key connect works with the platform secret alone; the
    // Connect OAuth client id is only needed for the redirect flow.
    configured: () => Boolean(env("STRIPE_SECRET_KEY")),
    authorizeUrl: (state, redirectUri) =>
      `https://connect.stripe.com/oauth/authorize?${new URLSearchParams({
        response_type: "code",
        client_id: env("STRIPE_CONNECT_CLIENT_ID"),
        scope: "read_only",
        state,
        redirect_uri: redirectUri,
      }).toString()}`,
    // Stripe Connect exchanges with the platform secret key; no redirect_uri.
    exchangeCode: (code) =>
      postForToken(
        "https://connect.stripe.com/oauth/token",
        new URLSearchParams({
          client_secret: env("STRIPE_SECRET_KEY"),
          code,
          grant_type: "authorization_code",
        }).toString(),
        "application/x-www-form-urlencoded"
      ),
  },
{
    id: "google",
    label: "Google Workspace",
    requestField: "googleToken",
    configured: () => Boolean(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET")),
    note: "Docs, Sheets and Decks edited in range show up in your update.",
    authorizeUrl: (state, redirectUri) =>
      `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: env("GOOGLE_CLIENT_ID"),
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/drive.metadata.readonly",
        access_type: "offline",
        prompt: "consent",
        state,
      }).toString()}`,
    // Store the refresh token; access tokens expire in an hour.
    exchangeCode: async (code, redirectUri) => {
      let res: Response;
      try {
        res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: env("GOOGLE_CLIENT_ID"),
            client_secret: env("GOOGLE_CLIENT_SECRET"),
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
          }).toString(),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch {
        throw new Error("token_endpoint_unreachable");
      }
      const data = (await res.json().catch(() => null)) as {
        access_token?: string;
        refresh_token?: string;
      } | null;
      if (!res.ok || !data?.access_token) throw new Error(`token_exchange_failed_http_${res.status}`);
      return data.refresh_token ? `refresh:${data.refresh_token}` : data.access_token;
    },
  },
{
    id: "linkedin",
    label: "LinkedIn",
    requestField: "linkedinToken",
    configured: () => Boolean(env("LINKEDIN_CLIENT_ID") && env("LINKEDIN_CLIENT_SECRET")),
    note: "Publish your build in public post with one click, in your voice.",
    authorizeUrl: (state, redirectUri) =>
      `https://www.linkedin.com/oauth/v2/authorization?${new URLSearchParams({
        response_type: "code",
        client_id: env("LINKEDIN_CLIENT_ID"),
        redirect_uri: redirectUri,
        scope: "openid profile w_member_social",
        state,
      }).toString()}`,
    exchangeCode: (code, redirectUri) =>
      postForToken(
        "https://www.linkedin.com/oauth/v2/accessToken",
        new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: env("LINKEDIN_CLIENT_ID"),
          client_secret: env("LINKEDIN_CLIENT_SECRET"),
        }).toString(),
        "application/x-www-form-urlencoded"
      ),
  },
];

/** Look up a provider by (untrusted) id; null when unknown. */
export function getProvider(id: string): ConnectProvider | null {
  return CONNECT_PROVIDERS.find((provider) => provider.id === id) ?? null;
}
