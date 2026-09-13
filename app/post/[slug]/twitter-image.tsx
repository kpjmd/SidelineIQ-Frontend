// X reads twitter:image; the card is the same one Open Graph gets. Route
// segment config must be declared here, not re-exported — Next reads it
// statically from this file.
export { default, alt, size, contentType } from './opengraph-image';
export const revalidate = 60;
