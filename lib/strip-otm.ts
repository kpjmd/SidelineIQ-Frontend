/**
 * Strips OTM-specific structured annotations from clinical_summary text.
 * The agent embeds bracket annotations and all-caps section headers for
 * internal classification — these should not render on the web.
 */
export function stripOTMAnnotations(text: string): string {
  return text
    // OTM bracket annotation: [ALL CAPS LABEL: content] — remove entirely
    .replace(/\[([A-Z][A-Z\s/]+):[^\]]*\]/g, '')
    // OTM / all-caps section header lines ending in colon
    .replace(/^(?:[A-Z][A-Z\s\-]+:)\s*$/gm, '')
    // Collapse extra blank lines left behind
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Strips both OTM annotations and markdown for plain-text previews (feed cards).
 */
export function stripForPreview(text: string): string {
  return stripOTMAnnotations(text)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
