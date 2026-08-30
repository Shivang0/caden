// caden pipeline: GitHub activity in, founder comms out.
// LLM: moonshotai/kimi-k3 via NVIDIA API (OpenAI-compatible, SSE streaming).
// POST { repo, from, to, metrics } -> SSE stream of stage/delta events.

export const config = {
  supportsResponseStreaming: true,
  maxDuration: 300,
};

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
// Kimi first, Nemotron when Kimi's quota is exhausted (it 429s even on
// single tiny requests once the per-model allowance is burned).
const MODELS = ["moonshotai/kimi-k3", "nvidia/nemotron-3-super-120b-a12b"];

const VOICE_RULES = `Voice rules, non negotiable:
- Never use em dashes or en dashes anywhere. Use periods, commas, colons, or parentheses instead.
- Short declarative sentences. Concrete nouns from the actual work: merged PRs, releases, commits.
- Banned words: unlock, seamless, seamlessly, supercharge, effortless, elevate, empower, game-changing, revolutionize, cutting-edge, leverage (as a verb), robust, streamline, journey, delve.
- Never invent numbers, customers, or traction. Metrics may only come from the founder's pasted metrics block. If no metrics were provided, do not fabricate a metrics section.
- Every factual claim about the product must trace back to a PR, commit, or release in the input.
- Output only the final artifact. No preamble, no meta commentary about being an AI or about these rules.`;

function sse(res, event) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

// One non-streaming NVIDIA chat call with the same model fallback as runAgent.
async function nvChat(system, user, maxTokens) {
  let r = null;
  for (const model of MODELS) {
    const body = {
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: maxTokens || 600,
      temperature: 0.6,
      stream: false,
    };
    if (model.startsWith("moonshotai/")) body.reasoning_effort = "low";
    if (model.startsWith("nvidia/")) body.chat_template_kwargs = { thinking: false };
    r = await fetch(NVIDIA_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (r.status !== 429) break;
    await r.text().catch(() => {});
  }
  if (!r || !r.ok) throw new Error(`NVIDIA ${r ? r.status : "unreachable"}`);
  const data = await r.json();
  return (((data.choices || [])[0] || {}).message || {}).content || "";
}

// Voice profiler agent (ported from swey): reads the founder's public posts
// via Linkup and distills tone, cadence, and signature phrases so the writers
// imitate the founder instead of a generic house style.
const FALLBACK_TRAITS = {
  tone: "confident, friendly, founder to founder",
  cadence: "short punchy paragraphs with one idea each",
  emojiUsage: "sparing, at most one per post",
  signaturePhrases: [],
  sentenceLength: "short to medium",
};

async function buildVoiceProfile(founder) {
  if (!founder || !process.env.LINKUP_API_KEY) return null;
  let results = [];
  try {
    const r = await fetch("https://api.linkup.so/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.LINKUP_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: `posts by ${founder} site:linkedin.com`,
        depth: "standard",
        outputType: "searchResults",
      }),
    });
    if (r.ok) results = (await r.json()).results || [];
  } catch (err) {
    return FALLBACK_TRAITS;
  }
  const samples = results
    .filter((x) => x.type === "text" && (x.content || "").trim().length >= 40)
    .slice(0, 3)
    .map((x) => x.content.trim().slice(0, 1500));
  if (!samples.length) return FALLBACK_TRAITS;
  try {
    const raw = await nvChat(
      "You are a writing-style analyst. Given real social posts by one author, distill their voice so a " +
        "ghostwriter can imitate it. Describe only what the samples show, do not idealize. Respond with ONLY a " +
        'JSON object: {"tone": str, "cadence": str, "emojiUsage": str, "signaturePhrases": [str], "sentenceLength": str}. ' +
        "signaturePhrases: recurring phrases or verbal tics actually present in the samples, empty array if none recur.",
      `Posts by ${founder}:\n` + samples.map((s, i) => `--- sample ${i + 1} ---\n${s}`).join("\n"),
      500
    );
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return FALLBACK_TRAITS;
    const traits = JSON.parse(m[0]);
    if (!traits.tone) return FALLBACK_TRAITS;
    return traits;
  } catch (err) {
    return FALLBACK_TRAITS;
  }
}

function voiceBlock(traits) {
  if (!traits) return "";
  const phrases = (traits.signaturePhrases || []).slice(0, 5).map((p) => `"${p}"`).join(", ");
  return (
    `\nWrite in the founder's real voice, distilled from their public posts:` +
    `\n- Tone: ${traits.tone}` +
    `\n- Cadence: ${traits.cadence}` +
    `\n- Sentence length: ${traits.sentenceLength}` +
    `\n- Emoji usage: ${traits.emojiUsage}` +
    (phrases ? `\n- Signature phrases to weave in only where they fit naturally: ${phrases}` : "") +
    `\nNever mention this profile or that you are imitating anyone.`
  );
}

function ghHeaders() {
  const h = {
    Accept: "application/vnd.github+json",
    "User-Agent": "caden-demo",
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function gh(url) {
  const r = await fetch(url, { headers: ghHeaders() });
  if (r.status === 403 || r.status === 429) {
    throw new Error("GitHub rate limit hit. Add a GITHUB_TOKEN env var or wait a minute.");
  }
  if (r.status === 404) throw new Error("Repo not found. Is it public?");
  if (!r.ok) throw new Error(`GitHub API error ${r.status}`);
  return r.json();
}

function parseRepo(input) {
  const m = String(input || "").trim().match(/(?:github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/);
  if (!m) throw new Error("Could not parse the repo. Use owner/name or a github.com URL.");
  return { owner: m[1], name: m[2] };
}

// "vercel/next.js" -> single repo. "anomalyco" (or a github.com/anomalyco URL)
// -> org mode: we scan every repo in the org pushed inside the range.
function parseTarget(input) {
  const cleaned = String(input || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^(www\.)?github\.com\//, "")
    .replace(/^\/+|\/+$/g, "");
  if (!cleaned) throw new Error("Repo or org is required.");
  return cleaned.includes("/") ? { kind: "repo", value: cleaned } : { kind: "org", value: cleaned };
}

// Org-wide pull: list repos by recent push (works for orgs and users), keep
// the ones active in range, then reuse the single-repo fetcher per repo.
async function fetchOrgData(org, from, to) {
  let repos;
  try {
    repos = await gh(`https://api.github.com/orgs/${org}/repos?sort=pushed&per_page=30`);
  } catch (e) {
    repos = await gh(`https://api.github.com/users/${org}/repos?sort=pushed&per_page=30`);
  }
  const active = (repos || [])
    .filter((r) => r.pushed_at && r.pushed_at.slice(0, 10) >= from && !r.fork)
    .slice(0, 5);
  if (!active.length) {
    throw new Error(`No repos in ${org} were pushed between ${from} and ${to}.`);
  }
  const datas = [];
  for (const r of active) {
    try {
      datas.push(await fetchGithubData(r.full_name, from, to));
    } catch (e) {
      // one dead repo never kills the org run
    }
  }
  if (!datas.length) throw new Error(`Could not read any repo in ${org}.`);
  return datas;
}

async function fetchGithubData(repoInput, from, to) {
  const { owner, name } = parseRepo(repoInput);
  const meta = await gh(`https://api.github.com/repos/${owner}/${name}`);

  const search = await gh(
    `https://api.github.com/search/issues?q=repo:${owner}/${name}+is:pr+is:merged+merged:${from}..${to}&per_page=60&sort=updated`
  );
  const prs = (search.items || []).map((p) => ({
    number: p.number,
    title: p.title,
    author: p.user && p.user.login,
    merged: p.closed_at,
    body: (p.body || "").slice(0, 600),
  }));

  let commits = [];
  for (let page = 1; page <= 2; page++) {
    const batch = await gh(
      `https://api.github.com/repos/${owner}/${name}/commits?since=${from}T00:00:00Z&until=${to}T23:59:59Z&per_page=100&page=${page}`
    );
    commits = commits.concat(
      batch.map((c) => ({
        sha: c.sha.slice(0, 7),
        message: (c.commit.message || "").split("\n")[0].slice(0, 160),
        author: (c.commit.author && c.commit.author.name) || "",
      }))
    );
    if (batch.length < 100) break;
  }

  const releasesRaw = await gh(`https://api.github.com/repos/${owner}/${name}/releases?per_page=20`);
  const releases = releasesRaw
    .filter((r) => r.published_at && r.published_at >= `${from}T00:00:00Z` && r.published_at <= `${to}T23:59:59Z`)
    .map((r) => ({ tag: r.tag_name, name: r.name, published: r.published_at, body: (r.body || "").slice(0, 1500) }));

  return {
    repo: {
      full_name: meta.full_name,
      description: meta.description,
      language: meta.language,
      stars: meta.stargazers_count,
    },
    prs,
    commits,
    releases,
  };
}

function digest(data, from, to) {
  const lines = [];
  lines.push(`Repo: ${data.repo.full_name} (${data.repo.language || "unknown language"})`);
  if (data.repo.description) lines.push(`Description: ${data.repo.description}`);
  lines.push(`Date range: ${from} to ${to}`);
  lines.push(`\n== Merged PRs (${data.prs.length}) ==`);
  for (const p of data.prs) {
    lines.push(`#${p.number} ${p.title} (by ${p.author}, merged ${String(p.merged).slice(0, 10)})`);
    if (p.body) lines.push(`  body: ${p.body.replace(/\s+/g, " ")}`);
  }
  lines.push(`\n== Commits (${data.commits.length}) ==`);
  for (const c of data.commits) lines.push(`${c.sha} ${c.message} (${c.author})`);
  lines.push(`\n== Releases in range (${data.releases.length}) ==`);
  for (const r of data.releases) {
    lines.push(`${r.tag} ${r.name || ""} published ${String(r.published).slice(0, 10)}`);
    if (r.body) lines.push(`  notes: ${r.body.replace(/\s+/g, " ")}`);
  }
  return lines.join("\n");
}

// Org mode: one digest covering every active repo, clearly sectioned so the
// summarizer can group by repo and the writers can credit specific projects.
function digestOrg(org, datas, from, to) {
  const header = [
    `Organization: ${org}`,
    `Repos with activity in range: ${datas.map((d) => d.repo.full_name).join(", ")}`,
    `Date range: ${from} to ${to}`,
  ].join("\n");
  const sections = datas.map(
    (d) => `\n\n######## REPO ${d.repo.full_name} ########\n${digest(d, from, to)}`
  );
  return header + sections.join("");
}

// One streaming call to Kimi K3 via NVIDIA. Forwards text deltas to the client
// tagged with the artifact name, returns the full text.
async function runAgent(res, artifact, system, user, effort) {
  sse(res, { type: "stage", stage: artifact, status: "start" });

  // Kimi's per-model quota can be fully exhausted (429 on every request),
  // so retry briefly, then fall through to the next model in the list.
  let r;
  outer: for (const model of MODELS) {
    const body = {
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 16384,
      temperature: 1,
      stream: true,
    };
    // Kimi accepts reasoning_effort. Nemotron must have thinking disabled or
    // it spends the entire token budget reasoning and streams no content.
    if (model.startsWith("moonshotai/")) body.reasoning_effort = effort || "medium";
    if (model.startsWith("nvidia/")) body.chat_template_kwargs = { thinking: false };
    for (let attempt = 0; attempt < 2; attempt++) {
      r = await fetch(NVIDIA_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(body),
      });
      if (r.status !== 429) break outer;
      await r.text().catch(() => {});
      await new Promise((ok) => setTimeout(ok, 3000 * (attempt + 1)));
    }
  }

  if (!r.ok) {
    const body = await r.text();
    if (r.status === 401 || r.status === 403) throw new Error("NVIDIA API key rejected. Check NVIDIA_API_KEY.");
    if (r.status === 429) throw new Error("NVIDIA API rate limit hit on every model. Wait a minute and run again.");
    throw new Error(`NVIDIA API error ${r.status}: ${body.slice(0, 200)}`);
  }

  let full = "";
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const chunk = JSON.parse(payload);
        const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
        // Kimi K3 streams internal reasoning as reasoning_content. Only the
        // final answer content is forwarded to the page.
        const text = delta && delta.content;
        if (text) {
          full += text;
          sse(res, { type: "delta", artifact, text });
        }
      } catch (e) {
        // partial JSON line, ignore
      }
    }
  }

  sse(res, { type: "stage", stage: artifact, status: "done" });
  return full;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  try {
    if (!process.env.NVIDIA_API_KEY) {
      throw new Error("NVIDIA_API_KEY is not configured on the server.");
    }
    const { repo, from, to, metrics, founder } = req.body || {};
    if (!repo || !from || !to) throw new Error("repo, from, and to are required.");

    // 1. Pull the work. A bare org or user name means org mode: scan every
    // repo pushed in range, so the founder never has to pick one.
    sse(res, { type: "stage", stage: "fetch", status: "start" });
    const target = parseTarget(repo);
    let datas;
    if (target.kind === "org") {
      datas = await fetchOrgData(target.value, from, to);
    } else {
      datas = [await fetchGithubData(target.value, from, to)];
    }
    const counts = datas.reduce(
      (acc, d) => ({
        prs: acc.prs + d.prs.length,
        commits: acc.commits + d.commits.length,
        releases: acc.releases + d.releases.length,
      }),
      { prs: 0, commits: 0, releases: 0 }
    );
    if (counts.prs + counts.commits + counts.releases === 0) {
      throw new Error("No merged PRs, commits, or releases found in that date range.");
    }
    sse(res, {
      type: "stage",
      stage: "fetch",
      status: "done",
      detail:
        (datas.length > 1 ? `${datas.length} repos in ${target.value}, ` : "") +
        `${counts.prs} merged PRs, ${counts.commits} commits, ${counts.releases} releases`,
    });

    // 1.5 Voice profiler: learn the founder's writing voice from their posts
    let traits = null;
    if ((founder || "").trim()) {
      sse(res, { type: "stage", stage: "voice", status: "start" });
      traits = await buildVoiceProfile(founder.trim());
      sse(res, {
        type: "stage",
        stage: "voice",
        status: "done",
        detail: traits && traits.signaturePhrases && traits.signaturePhrases.length
          ? `voice matched: ${traits.tone}`
          : "voice profile built",
      });
    }
    const voiceMatch = voiceBlock(traits);

    const workDigest =
      datas.length > 1 ? digestOrg(target.value, datas, from, to) : digest(datas[0], from, to);
    const repoLabel = datas.length > 1 ? `the ${target.value} organization` : datas[0].repo.full_name;
    const metricsBlock = (metrics || "").trim()
      ? `Founder-provided metrics (the only numbers you may use):\n${metrics.trim()}`
      : "The founder provided no metrics. Do not invent any numbers beyond counts of PRs, commits, and releases visible in the data.";

    // 2. Summarizer agent maps the work
    const summary = await runAgent(
      res,
      "summary",
      `You are the summarizer agent inside caden, a founder autopilot. You read a repo's shipped work and produce a work map that writer agents will use. Be concrete. Cite PR numbers. Group by theme. Separate user facing changes from internal work. Note the scale of activity honestly. ${VOICE_RULES}`,
      `Map the following work for the writers. Output sections: THEMES (grouped shipped work with PR references), USER FACING (what a customer would notice), INTERNAL (infra, refactors, fixes), SCALE (honest counts).\n\n${workDigest}`,
      "low"
    );

    const writerInput = `Work map from the summarizer agent:\n${summary}\n\n${metricsBlock}\n\nSource: ${repoLabel}. Date range: ${from} to ${to}.`;

    // 3. Three writers, sequential: the NVIDIA key rejects concurrent
    // requests with 429, so parallel writers kill the whole run.
    await runAgent(
      res,
      "investor_update",
      `You are the investor update writer inside caden. Write the monthly investor update email a founder would actually send. Structure: subject line, one paragraph TLDR, SHIPPED (grounded in the work map with PR references), METRICS (only founder-provided numbers, omit the section entirely if none), ASKS, NEXT. Write in first person as the founder. Plain text email, no markdown headers except simple uppercase section labels. ${VOICE_RULES}${voiceMatch}`,
      writerInput,
      "low"
    );
    await runAgent(
      res,
      "posts",
      `You are the build in public writer inside caden. Produce exactly two pieces: first a LinkedIn post (150 to 220 words, first person founder voice, grounded in real shipped work, at most 2 hashtags, no emoji spam), then an X thread of 5 to 7 numbered tweets telling the story of what shipped. Label them "LINKEDIN POST" and "X THREAD". Real diffs, not vibes. ${VOICE_RULES}${voiceMatch}`,
      writerInput,
      "low"
    );
    await runAgent(
      res,
      "changelog",
      `You are the changelog writer inside caden. Produce a clean markdown changelog for this date range with sections Added, Changed, Fixed (omit empty sections). Each entry is one line, references PR numbers like (#123) where known. Lead with a one line summary of the period. ${VOICE_RULES}${voiceMatch}`,
      writerInput,
      "low"
    );

    sse(res, { type: "done" });
  } catch (err) {
    sse(res, { type: "error", message: err.message || "Something broke. Try again." });
  } finally {
    res.end();
  }
}
