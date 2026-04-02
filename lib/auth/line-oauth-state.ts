import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const SEP = ".";

function getLineOAuthStateSecret(): string {
  const s =
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.USER_JWT_SECRET?.trim() ||
    "";
  if (s.length < 16) {
    throw new Error("NEXTAUTH_SECRET or USER_JWT_SECRET required for LINE OAuth state");
  }
  return s;
}

/** Cryptographic OAuth state so callback can validate without relying on cookies (LINE in-app / strict clients). */
export function createSignedLineOAuthState(): string {
  const nonce = randomBytes(24).toString("base64url");
  const secret = getLineOAuthStateSecret();
  const sig = createHmac("sha256", secret).update(nonce).digest("base64url");
  return `${nonce}${SEP}${sig}`;
}

export function verifySignedLineOAuthState(state: string): boolean {
  if (!state?.trim() || !state.includes(SEP)) {
    return false;
  }
  const i = state.indexOf(SEP);
  const nonce = state.slice(0, i);
  const sig = state.slice(i + SEP.length);
  if (!nonce || !sig) {
    return false;
  }
  let secret: string;
  try {
    secret = getLineOAuthStateSecret();
  } catch {
    return false;
  }
  const expected = createHmac("sha256", secret).update(nonce).digest("base64url");
  if (sig.length !== expected.length) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}
