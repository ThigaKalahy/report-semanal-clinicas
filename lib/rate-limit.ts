// In-memory rate limiter — resets on process restart (adequate for single-instance deploys)
// Key is arbitrary (session cookie, IP, etc.); limit = max requests per window (ms).

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

const WINDOW_MS = 60_000; // 1 minute

/** Returns true if the request is within limit, false if it should be blocked. */
export function checkRateLimit(key: string, limit = 10): boolean {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || now >= bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count++;
  return true;
}

/** Header → rate-limit key: prefer auth cookie, fall back to IP. */
export function rateLimitKey(headers: Headers): string {
  // Use the auth cookie as session identifier so the limit is per-user, not per-IP
  const cookie = headers.get("cookie") ?? "";
  const match = cookie.match(/gestfy-auth=([^;]+)/);
  if (match) return `session:${match[1].slice(0, 32)}`;

  // Fallback: forwarded IP or direct IP
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    headers.get("x-real-ip") ??
    "unknown";
  return `ip:${ip}`;
}

/** Returns a 429 Response when the limit is exceeded. */
export function tooManyRequests(): Response {
  return new Response("Muitas requisições. Aguarde um minuto e tente novamente.", {
    status: 429,
    headers: { "content-type": "text/plain; charset=utf-8", "retry-after": "60" },
  });
}
