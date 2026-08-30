// Activity aggregation for Cadence: GitHub (required) plus optional sources
// (Linear, Notion, Vercel, Stripe metrics, Figma, PostHog). GitHub failures
// propagate; optional-source failures degrade gracefully with a
// human-readable message in sourceErrors.
//
// Tokens pass straight through to the source fetchers — never stored or logged.

import { fetchFigmaActivity } from "@/lib/figma";
import { fetchGoogleDriveActivity } from "@/lib/google";
import { fetchRepoActivity } from "@/lib/github";
import { fetchLinearActivity } from "@/lib/linear";
import { fetchWebMentions } from "@/lib/linkup";
import { fetchNotionActivity } from "@/lib/notion";
import { fetchPosthogSnapshot } from "@/lib/posthog";
import { fetchRevenueSnapshot } from "@/lib/stripe-metrics";
import { fetchVercelDeployments } from "@/lib/vercel";
import type {
  FigmaFileActivity,
  GoogleDriveFile,
  GenerateRequest,
  LinearIssue,
  NotionPage,
  PosthogSnapshot,
  RepoActivity,
  RevenueSnapshot,
  VercelDeployment,
  WebMention,
} from "@/lib/types";

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "unexpected error";
}

export async function gatherActivity(
  req: GenerateRequest
): Promise<{ activity: RepoActivity; sourceErrors: string[] }> {
  const sourceErrors: string[] = [];

  // Optional sources run in parallel with GitHub. Their failures never fail
  // the request — collect the message and continue with an empty result.
  const linearPromise: Promise<LinearIssue[] | undefined> = req.linearApiKey
    ? fetchLinearActivity(req.linearApiKey, req.since, req.until).catch(
        (error: unknown) => {
          sourceErrors.push(`Linear: ${errorMessage(error)}`);
          return [] as LinearIssue[];
        }
      )
    : Promise.resolve(undefined);

  const notionPromise: Promise<NotionPage[] | undefined> = req.notionToken
    ? fetchNotionActivity(req.notionToken, req.since, req.until).catch(
        (error: unknown) => {
          sourceErrors.push(`Notion: ${errorMessage(error)}`);
          return [] as NotionPage[];
        }
      )
    : Promise.resolve(undefined);

  const vercelPromise: Promise<VercelDeployment[] | undefined> = req.vercelToken
    ? fetchVercelDeployments(req.vercelToken, req.since, req.until, req.vercelProjectId).catch(
        (error: unknown) => {
          sourceErrors.push(`Vercel: ${errorMessage(error)}`);
          return [] as VercelDeployment[];
        }
      )
    : Promise.resolve(undefined);

  const revenuePromise: Promise<RevenueSnapshot | undefined> = req.stripeMetricsKey
    ? fetchRevenueSnapshot(req.stripeMetricsKey, req.since, req.until).catch(
        (error: unknown) => {
          sourceErrors.push(`Stripe: ${errorMessage(error)}`);
          return undefined;
        }
      )
    : Promise.resolve(undefined);

  // Figma needs both a token and a team id — a token alone can't list files.
  let figmaPromise: Promise<FigmaFileActivity[] | undefined> = Promise.resolve(undefined);
  if (req.figmaToken && req.figmaTeamId) {
    figmaPromise = fetchFigmaActivity(req.figmaToken, req.figmaTeamId, req.since, req.until).catch(
      (error: unknown) => {
        sourceErrors.push(`Figma: ${errorMessage(error)}`);
        return [] as FigmaFileActivity[];
      }
    );
  } else if (req.figmaToken) {
    sourceErrors.push("Figma: figmaTeamId is required alongside figmaToken to list team files.");
  }

  // PostHog needs both a personal API key and a project id.
  let posthogPromise: Promise<PosthogSnapshot | undefined> = Promise.resolve(undefined);
  if (req.posthogKey && req.posthogProjectId) {
    posthogPromise = fetchPosthogSnapshot(
      req.posthogKey,
      req.posthogProjectId,
      req.since,
      req.until,
      req.posthogHost
    ).catch((error: unknown) => {
      sourceErrors.push(`PostHog: ${errorMessage(error)}`);
      return undefined;
    });
  } else if (req.posthogKey) {
    sourceErrors.push("PostHog: posthogProjectId is required alongside posthogKey to query analytics.");
  }

  const googlePromise: Promise<GoogleDriveFile[] | undefined> = req.googleToken
    ? fetchGoogleDriveActivity(req.googleToken, req.since, req.until).catch(
        (error: unknown) => {
          sourceErrors.push(`Google: ${errorMessage(error)}`);
          return [] as GoogleDriveFile[];
        }
      )
    : Promise.resolve(undefined);

  // Linkup press/web mentions — server-side key, zero user setup. Query by the
  // company name when given, else the repo name from the URL.
  let linkupPromise: Promise<WebMention[] | undefined> = Promise.resolve(undefined);
  if (process.env.LINKUP_API_KEY) {
    const repoName = req.repoUrl.replace(/\/+$/, "").split("/").pop()?.replace(/\.git$/, "");
    const query = req.company?.trim() || repoName;
    if (query) {
      linkupPromise = fetchWebMentions(query, req.since, req.until).catch((error: unknown) => {
        sourceErrors.push(`Linkup: ${errorMessage(error)}`);
        return [] as WebMention[];
      });
    }
  }

  // GitHub is required — let its errors propagate. The optional promises above
  // already have catch handlers attached, so no unhandled rejections occur if
  // GitHub throws first.
  const [activity, linearIssues, notionPages, deployments, revenue, figmaFiles, posthog, webMentions, googleDocs] =
    await Promise.all([
      fetchRepoActivity(req.repoUrl, req.since, req.until),
      linearPromise,
      notionPromise,
      vercelPromise,
      revenuePromise,
      figmaPromise,
      posthogPromise,
      linkupPromise,
      googlePromise,
    ]);

  if (linearIssues) activity.linearIssues = linearIssues;
  if (notionPages) activity.notionPages = notionPages;
  if (deployments) activity.deployments = deployments;
  if (revenue) activity.revenue = revenue;
  if (figmaFiles) activity.figmaFiles = figmaFiles;
  if (posthog) activity.posthog = posthog;
  if (webMentions && webMentions.length > 0) activity.webMentions = webMentions;
  if (googleDocs) activity.googleDocs = googleDocs;

  return { activity, sourceErrors };
}
