// POST /api/publish/linkedin — publish the build-in-public post to the
// signed-in founder's LinkedIn feed using their connected member token.
// Payload shape verified against learn.microsoft.com/linkedin, version 202608.

import { getSession } from "@/lib/auth";
import { readConnectionToken } from "@/lib/connect/store";

export const runtime = "nodejs";

const LINKEDIN_VERSION = "202608";

export async function POST(request: Request): Promise<Response> {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "login_required" }, { status: 401 });

  const token = await readConnectionToken(user.id, "linkedin");
  if (!token) {
    return Response.json(
      { error: "Connect LinkedIn first on the Connections page." },
      { status: 400 }
    );
  }

  let text = "";
  try {
    const body = (await request.json()) as { text?: string };
    text = (body.text ?? "").trim();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!text) return Response.json({ error: "text is required." }, { status: 400 });
  if (text.length > 2900) text = text.slice(0, 2900);

  const me = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!me.ok) {
    return Response.json(
      { error: "LinkedIn session expired. Reconnect LinkedIn and try again." },
      { status: 400 }
    );
  }
  const profile = (await me.json()) as { sub?: string; name?: string };
  if (!profile.sub) return Response.json({ error: "Could not resolve your LinkedIn id." }, { status: 502 });

  const post = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: `urn:li:person:${profile.sub}`,
      commentary: text,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!post.ok) {
    const detail = (await post.text()).slice(0, 200);
    return Response.json({ error: `LinkedIn post failed (${post.status}): ${detail}` }, { status: 502 });
  }
  const postId = post.headers.get("x-restli-id") ?? "";
  return Response.json({ ok: true, postId, name: profile.name ?? "" });
}
