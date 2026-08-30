// caden founder image: find the founder's photo for the video cameo.
// POST { query, repo } -> { imageUrls: [..], via }
// query: a name or LinkedIn URL, searched via Linkup (LinkedIn posts, Google,
// press). Falls back to the GitHub avatar of the repo owner.

export const config = {
  maxDuration: 60,
};

function ownerAvatar(repoInput) {
  const m = String(repoInput || "").trim().match(/(?:github\.com\/)?([\w.-]+)\/[\w.-]+/);
  return m ? `https://github.com/${m[1]}.png?size=640` : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  const { query, repo } = req.body || {};
  const fallback = ownerAvatar(repo);
  const urls = [];
  let via = "github avatar";

  try {
    if ((query || "").trim() && process.env.LINKUP_API_KEY) {
      // Image results are query-sensitive, so run two phrasings and merge.
      const name = query.trim();
      const queries = [`${name} headshot photo`, `${name} founder CEO photo portrait`];
      const searches = await Promise.all(
        queries.map((q) =>
          fetch("https://api.linkup.so/v1/search", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.LINKUP_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              q,
              depth: "standard",
              outputType: "searchResults",
              includeImages: true,
            }),
          })
            .then((r) => (r.ok ? r.json() : { results: [] }))
            .catch(() => ({ results: [] }))
        )
      );
      const seen = new Set();
      for (const data of searches) {
        for (const x of data.results || []) {
          if (x.type === "image" && /^https:/.test(x.url || "") && !seen.has(x.url)) {
            seen.add(x.url);
            urls.push(x.url);
          }
        }
      }
      if (urls.length) via = "linkup";
      urls.splice(5);
    }
  } catch (err) {
    // fall through to the avatar
  }

  if (fallback) urls.push(fallback);
  if (!urls.length) {
    res.status(404).json({ error: "No photo found. Add a name or a repo." });
    return;
  }
  res.status(200).json({ imageUrls: urls, via });
}
