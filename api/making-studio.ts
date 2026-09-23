import type { VercelRequest, VercelResponse } from "@vercel/node";

const canonicalApiUrl = process.env.CANONICAL_API_URL?.replace(/\/$/, "");

function readRawCookie(req: VercelRequest, name: string): string {
  const match = String(req.headers.cookie || "").match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]+)`)
  );
  return match?.[1] || "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("cache-control", "no-store");

  if (!canonicalApiUrl) {
    return res.status(503).json({
      success: false,
      error: "CANONICAL_API_URL is not configured",
      code: "CANONICAL_API_UNAVAILABLE",
    });
  }

  const adminSession = readRawCookie(req, "admin_session");
  if (!adminSession) {
    return res.status(401).json({
      success: false,
      error: "Owner authentication required",
      code: "OWNER_AUTH_REQUIRED",
    });
  }

  const action = String(req.query.action || req.body?.action || "status");
  const target = new URL("/api/making-studio", canonicalApiUrl);
  for (const [key, value] of Object.entries(req.query)) {
    if (Array.isArray(value)) {
      value.forEach(entry => target.searchParams.append(key, String(entry)));
    } else if (value !== undefined) {
      target.searchParams.set(key, String(value));
    }
  }
  target.searchParams.set("action", action);

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: {
        cookie: `admin_session=${adminSession}`,
        "content-type": "application/json",
        "x-renatural-client": "making-studio",
      },
      body:
        req.method === "GET" || req.method === "HEAD"
          ? undefined
          : JSON.stringify(req.body || {}),
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });

    const responseBody = await upstream.text();
    res.status(upstream.status);
    res.setHeader(
      "content-type",
      upstream.headers.get("content-type") || "application/json"
    );
    return res.send(responseBody);
  } catch (error) {
    console.error("[MakingStudioProxy] canonical API request failed", {
      error: error instanceof Error ? error.name : "unknown_error",
    });
    return res.status(502).json({
      success: false,
      error: "Canonical API request failed",
      code: "CANONICAL_API_REQUEST_FAILED",
    });
  }
}
