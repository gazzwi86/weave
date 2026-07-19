import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

// Dev-only sink for instrumentation-client.ts: appends browser runtime errors
// to logs/dev/client-errors.jsonl (gitignored) so they outlive the browser
// session. 404s in production. Re-serialising the parsed JSON (never the raw
// body) keeps one entry per line — no log injection via embedded newlines.
const LOG_DIR = path.join(process.cwd(), "..", "..", "logs", "dev");
const MAX_BODY_BYTES = 16_384;

export async function POST(req: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return new Response(null, { status: 404 });
  }
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }
  let entry: unknown;
  try {
    entry = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  await mkdir(LOG_DIR, { recursive: true });
  await appendFile(path.join(LOG_DIR, "client-errors.jsonl"), `${JSON.stringify(entry)}\n`);
  return new Response(null, { status: 204 });
}
