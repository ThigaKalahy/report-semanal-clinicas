export const COOKIE_NAME = "app_auth";
const TOKEN_DURATION_SEC = 30 * 24 * 60 * 60; // 30 dias

async function hmacHex(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createAuthToken(password: string): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_DURATION_SEC;
  const sig = await hmacHex(password, `${expiresAt}:gestfy-auth`);
  return `${expiresAt}.${sig}`;
}

export async function verifyAuthToken(
  token: string,
  password: string
): Promise<boolean> {
  const dotIdx = token.indexOf(".");
  if (dotIdx === -1) return false;
  const expiresAt = parseInt(token.slice(0, dotIdx), 10);
  const sig = token.slice(dotIdx + 1);
  if (isNaN(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return false;
  const expected = await hmacHex(password, `${expiresAt}:gestfy-auth`);
  if (expected.length !== sig.length) return false;
  // Constant-time comparison
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return diff === 0;
}
