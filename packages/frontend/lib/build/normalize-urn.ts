/** Next.js hands `useParams()` the raw route segment as-is: a hard load
 * decodes it first, but a client-side `<Link>` navigation does not -- so
 * a URN param arrives already percent-encoded on soft nav, and re-encoding
 * it verbatim double-encodes it. Decode first (no-op if it wasn't encoded)
 * so `encodeURIComponent` always sees the raw value.
 */
export function normalizeUrn(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
