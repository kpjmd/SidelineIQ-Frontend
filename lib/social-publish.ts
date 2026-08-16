import type { InjuryPost } from '@/lib/types';

/**
 * Tells the agents backend to publish an approved post to Farcaster and X.
 *
 * Shared by BOTH approval routes on purpose. They used to diverge: the review
 * queue's "Quick approve" notified the agents service, while the review form's
 * Approve button only wrote the review row — same queue, two buttons, one of
 * which silently never published. Anything that approves a post belongs here.
 *
 * Never throws. The approval itself has already committed by the time this
 * runs, so a social failure must not roll it back — but it must not be reported
 * as success either. Callers are expected to surface the outcome.
 */

export interface SocialPublishOutcome {
  ok: boolean;
  /** Platforms that actually accepted the post. */
  platforms?: string[];
  error?: string;
}

interface AgentsPlatformResult {
  platform?: string;
  success?: boolean;
  error?: string;
}

interface AgentsApproveResponse {
  success?: boolean;
  error?: string;
  result?: {
    platform_results?: AgentsPlatformResult[];
  };
}

const TIMEOUT_MS = 25_000;

export async function triggerSocialPublish(
  postId: string,
  post: InjuryPost | Record<string, unknown>,
): Promise<SocialPublishOutcome> {
  const secret = process.env.AGENTS_API_SECRET;
  if (!secret) {
    // Without this guard the header goes out as literally "Bearer undefined",
    // the agents service returns 401 with no log line of its own, and the MD
    // sees a successful approval.
    const error = 'AGENTS_API_SECRET is not configured — social publish not attempted';
    console.error(`[Approve] ${error}`);
    return { ok: false, error };
  }

  const agentsUrl =
    process.env.AGENTS_URL ?? 'https://sidelineiq-agents-production.up.railway.app';
  const socialUrl = `${agentsUrl}/admin/approve/${postId}`;

  let res: Response;
  let bodyText: string;
  try {
    res = await fetch(socialUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ post }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    bodyText = await res.text();
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[Approve] Could not reach ${socialUrl}: ${error}`);
    return { ok: false, error: `Could not reach the agents service: ${error}` };
  }

  if (!res.ok) {
    // This is the branch that did not exist. The status was logged and then
    // thrown away, so a 401 read exactly like a 200 for five days.
    const error = `Agents service returned ${res.status}: ${bodyText.slice(0, 300)}`;
    console.error(`[Approve] Social publish rejected for post ${postId} — ${error}`);
    return { ok: false, error };
  }

  // A 200 still does not mean the cast landed: the pipeline swallows
  // per-platform failures and reports the post as published regardless. The
  // only real answer is in platform_results.
  let parsed: AgentsApproveResponse;
  try {
    parsed = JSON.parse(bodyText) as AgentsApproveResponse;
  } catch {
    console.error(`[Approve] Unreadable agents response for post ${postId}: ${bodyText.slice(0, 300)}`);
    return { ok: false, error: 'Agents service returned an unreadable response' };
  }

  const platformResults = parsed.result?.platform_results ?? [];
  const reached = platformResults
    .filter((r) => r.success && r.platform && r.platform !== 'web')
    .map((r) => r.platform as string);

  if (reached.length === 0) {
    const detail = platformResults
      .filter((r) => r.platform !== 'web')
      .map((r) => `${r.platform}=${r.error ?? 'failed'}`)
      .join('; ');
    const error = detail || parsed.error || 'the post reached no social platform';
    console.error(`[Approve] Post ${postId} reached 0 social platforms — ${error}`);
    return { ok: false, error };
  }

  console.log(`[Approve] Post ${postId} published to: ${reached.join(', ')}`);
  return { ok: true, platforms: reached };
}
