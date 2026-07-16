// Node's fetch resolves "localhost" IPv6-first ([::1]); dev uvicorn binds
// IPv4-only (127.0.0.1). That mismatch refuses the connection and surfaces
// as a proxy 502. Normalize any localhost hostname to the IPv4 loopback.
export function backendApiUrl(): string {
  const raw = process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000";
  const url = new URL(raw);
  if (url.hostname === "localhost") {
    url.hostname = "127.0.0.1";
  }
  return url.toString().replace(/\/$/, "");
}
