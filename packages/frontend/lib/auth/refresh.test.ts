import { afterEach, describe, expect, it, vi } from "vitest";

import { refreshAccessToken, shouldRefresh } from "./refresh";
import type { WeaveJWT } from "./refresh";

const BASE_TOKEN: WeaveJWT = {
  accessToken: "old-access-token",
  refreshToken: "valid-refresh-token",
  expiresAt: Math.floor(Date.now() / 1000) + 10, // 10s left — inside the 30s threshold
};

const MOCK_OIDC_CONFIG = {
  tokenUrl: "https://mock-oidc.local/token",
  clientId: "weave-dev",
  clientSecret: "dev-secret",
};

function mockFetchJsonResponse(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("shouldRefresh", () => {
  it("is true when fewer than 30s remain before expiry", () => {
    const nowMs = Date.now();
    expect(shouldRefresh(nowMs / 1000 + 10, nowMs)).toBe(true);
  });

  it("is false when more than 30s remain before expiry", () => {
    const nowMs = Date.now();
    expect(shouldRefresh(nowMs / 1000 + 300, nowMs)).toBe(false);
  });
});

describe("refreshAccessToken", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("test_jwt_auto_refresh: exchanges the refresh token for a new access token", async () => {
    const fetchMock = mockFetchJsonResponse({
      access_token: "new-access-token",
      refresh_token: "new-refresh-token",
      expires_in: 300,
    });

    const result = await refreshAccessToken(BASE_TOKEN, MOCK_OIDC_CONFIG);

    expect(fetchMock).toHaveBeenCalledWith(
      MOCK_OIDC_CONFIG.tokenUrl,
      expect.objectContaining({ method: "POST" })
    );
    expect(result.accessToken).toBe("new-access-token");
    expect(result.refreshToken).toBe("new-refresh-token");
    expect(result.error).toBeUndefined();
    expect(result.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("test_expired_jwt_no_refresh_redirects: no refresh token means no network call and an error flag", async () => {
    const fetchMock = mockFetchJsonResponse({});

    const result = await refreshAccessToken(
      { ...BASE_TOKEN, refreshToken: undefined },
      MOCK_OIDC_CONFIG
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.error).toBe("RefreshTokenError");
  });

  it("test_expired_jwt_no_refresh_redirects: a revoked refresh token also yields an error flag", async () => {
    mockFetchJsonResponse({}, 400);

    const result = await refreshAccessToken(BASE_TOKEN, MOCK_OIDC_CONFIG);

    expect(result.error).toBe("RefreshTokenError");
  });
});
