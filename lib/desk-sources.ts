import type { DeskSource } from './types';

// source_attribution is stored as an opaque JSON value, and the mcp linter only
// asks whether it is non-empty (linter.ts structuredSourcesPresent). The editor
// owns the shape: an array of { label, url }. Anything else read back from the
// column — null (every post so far), a string, an object — is treated as "no
// sources entered" rather than guessed at.
export function normalizeSources(raw: unknown): DeskSource[] {
  if (!Array.isArray(raw)) return [];
  const out: DeskSource[] = [];
  for (const item of raw) {
    if (item && typeof item === 'object') {
      const { label, url } = item as Record<string, unknown>;
      out.push({
        label: typeof label === 'string' ? label : '',
        url: typeof url === 'string' ? url : '',
      });
    }
  }
  return out;
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// What gets saved: rows with a valid http(s) URL, trimmed. The linter only asks
// whether source_attribution is non-empty, so a blank row or a half-typed URL
// persisted here would clear missing_source_attribution without attributing
// anything. Rows that fail stay in the editor's local state (so typing is never
// eaten) and simply do not reach the database until they are valid.
export function sourcesForSave(sources: DeskSource[]): DeskSource[] {
  return sources
    .map((s) => ({ label: s.label.trim(), url: s.url.trim() }))
    .filter((s) => isHttpUrl(s.url));
}

export function countValidSources(sources: DeskSource[]): number {
  return sourcesForSave(sources).length;
}
