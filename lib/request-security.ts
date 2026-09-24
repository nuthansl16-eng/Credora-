import "server-only";

import crypto from "node:crypto";

/** Reject cross-site browser requests to state-changing application APIs. */
export function assertSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;

  try {
    const expected = new URL(process.env.NEXT_PUBLIC_APP_URL ?? req.url).origin;
    return new URL(origin).origin === expected;
  } catch {
    return false;
  }
}

export function hasJsonContentType(req: Request): boolean {
  const contentType = req.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  return contentType === "application/json";
}

export function contentLengthWithin(req: Request, maxBytes: number): boolean {
  const value = req.headers.get("content-length");
  if (!value) return true;
  const length = Number(value);
  return Number.isSafeInteger(length) && length >= 0 && length <= maxBytes;
}

export function timingSafeEqualText(left: string | null, right: string | undefined): boolean {
  if (!left || !right) return false;
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Prefer platform-provided client IP headers. Never trust an arbitrary comma-separated
 * x-forwarded-for chain from an untrusted direct deployment. Rate limits are only a
 * secondary control, never an authorization boundary. */
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-vercel-forwarded-for")?.split(",", 1)[0]?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ||
    "unknown"
  ).slice(0, 128);
}
