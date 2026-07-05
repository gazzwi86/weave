/** Raised for any CE-READ-1 failure (unauthorised, non-2xx, or timeout) so
 * callers can distinguish "no graph" from "couldn't load the graph" (AC-2). */
export class CeReadError extends Error {}
