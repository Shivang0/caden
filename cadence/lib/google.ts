// Google Workspace source: Drive files edited in range.
// The stored connect token is "refresh:<refresh_token>"; exchange it for an
// access token per run. A plain access token is used as-is.

import type { GoogleDriveFile } from "@/lib/types";

const TIMEOUT_MS = 15_000;

async function accessTokenFrom(token: string): Promise<string> {
  if (!token.startsWith("refresh:")) return token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
      refresh_token: token.slice("refresh:".length),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Google token refresh failed (${res.status})`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Google token refresh returned no access token");
  return data.access_token;
}

export async function fetchGoogleDriveActivity(
  token: string,
  since: string,
  until: string
): Promise<GoogleDriveFile[]> {
  const accessToken = await accessTokenFrom(token);
  const q = `modifiedTime > '${since}T00:00:00' and modifiedTime < '${until}T23:59:59' and trashed = false`;
  const params = new URLSearchParams({
    q,
    orderBy: "modifiedTime desc",
    pageSize: "50",
    fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("Google Drive access was rejected. Reconnect Google Workspace.");
  }
  if (!res.ok) throw new Error(`Google Drive API error (${res.status})`);
  const data = (await res.json()) as {
    files?: Array<{ id: string; name: string; mimeType: string; modifiedTime: string; webViewLink?: string }>;
  };
  return (data.files ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    modifiedAt: f.modifiedTime,
    url: f.webViewLink,
  }));
}
