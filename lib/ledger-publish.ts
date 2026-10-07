/**
 * The frontend's calls into the agents service for the ledger: distribute a
 * published forecast (commit + X + Farcaster), post an approved reply, look up
 * nflverse ids. Same contract as lib/social-publish.ts: Bearer AGENTS_API_SECRET,
 * a bounded timeout, and NEVER throws — the caller surfaces the outcome.
 *
 * Nothing here carries content. The agents read the row (or the approved
 * proposal) from the database by id; a body with text in it would be content
 * going out that no record confirmed.
 */
import type { LedgerDistributeOutcome, LedgerIngestSummary, LedgerScoreboardResponse, NflverseLookup } from './ledger-types';

const TIMEOUT_MS = 60_000;

export interface AgentsCall<T> {
  ok: boolean;
  status: number;
  body: T | null;
  error?: string;
}

async function callAgents<T>(path: string, init: { method: 'GET' | 'POST'; body?: unknown }): Promise<AgentsCall<T>> {
  const secret = process.env.AGENTS_API_SECRET;
  if (!secret) {
    const error = 'AGENTS_API_SECRET is not configured';
    console.error(`[Ledger] ${error}`);
    return { ok: false, status: 503, body: null, error };
  }
  const agentsUrl = process.env.AGENTS_URL ?? 'https://sidelineiq-agents-production.up.railway.app';
  const url = `${agentsUrl}${path}`;
  let res: Response;
  let text: string;
  try {
    res = await fetch(url, {
      method: init.method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    text = await res.text();
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[Ledger] Could not reach ${url}: ${error}`);
    return { ok: false, status: 502, body: null, error: `Could not reach the agents service: ${error}` };
  }
  let body: T | null = null;
  try {
    body = text ? (JSON.parse(text) as T) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const error = (body as { error?: string } | null)?.error ?? `Agents service returned ${res.status}: ${text.slice(0, 300)}`;
    console.error(`[Ledger] ${init.method} ${path} → ${res.status}: ${error}`);
    return { ok: false, status: res.status, body, error };
  }
  return { ok: true, status: res.status, body };
}

/** POST /admin/ledger/publish/:id. dryRun renders and sends nothing; the agents' env can force dry run regardless. */
export function triggerLedgerPublish(
  forecastId: string,
  opts: { dryRun: boolean; forceStandalone?: boolean },
): Promise<AgentsCall<LedgerDistributeOutcome>> {
  return callAgents<LedgerDistributeOutcome>(`/admin/ledger/publish/${forecastId}`, {
    method: 'POST',
    body: { dry_run: opts.dryRun, force_standalone: opts.forceStandalone === true },
  });
}

export interface ReplyPostOutcome {
  success: boolean;
  proposal_id: string;
  platform: 'x' | 'farcaster';
  text: string;
  posted_id?: string;
  error?: string;
}

/** POST /admin/ledger/reply/:id — posts an APPROVED proposal; the body carries nothing. */
export function triggerReplyPost(proposalId: string): Promise<AgentsCall<ReplyPostOutcome>> {
  return callAgents<ReplyPostOutcome>(`/admin/ledger/reply/${proposalId}`, { method: 'POST' });
}

/** GET /admin/ledger/nflverse-ids?espn_id= — "unresolved" is an answer; a non-ok call is not. */
export function lookupNflverseIds(espnId: string): Promise<AgentsCall<{ success: boolean; lookup: NflverseLookup }>> {
  return callAgents(`/admin/ledger/nflverse-ids?espn_id=${encodeURIComponent(espnId)}`, { method: 'GET' });
}

/**
 * POST /admin/ledger/ingest, always as a SHADOW pass from this site: the agents
 * read every source and return what they would propose, and file nothing. The
 * scheduled loop is the only thing that files proposals, and only in `on`.
 */
export function triggerLedgerIngestShadow(): Promise<AgentsCall<LedgerIngestSummary>> {
  return callAgents<LedgerIngestSummary>('/admin/ledger/ingest', { method: 'POST', body: { mode: 'shadow' } });
}

/** GET /admin/ledger/scoreboard — both boards, the card line, and the two card texts. */
export function fetchLedgerScoreboard(since: string | null): Promise<AgentsCall<LedgerScoreboardResponse>> {
  const q = since ? `?since=${encodeURIComponent(since)}` : '';
  return callAgents<LedgerScoreboardResponse>(`/admin/ledger/scoreboard${q}`, { method: 'GET' });
}
