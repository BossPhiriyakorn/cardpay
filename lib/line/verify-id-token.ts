/**
 * ยืนยัน LIFF / LINE Login ID token ผ่าน LINE API (ต้องใช้ Channel ID เดียวกับที่ออก token)
 * https://developers.line.biz/en/reference/line-login/#verify-id-token
 */

export type LineVerifiedProfile = {
  sub: string;
  name?: string;
  picture?: string;
};

export async function verifyLineIdToken(
  idToken: string
): Promise<LineVerifiedProfile> {
  const clientId = process.env.LINE_CLIENT_ID?.trim() ?? "";
  if (!clientId) {
    throw new Error("LINE_CLIENT_ID is not configured");
  }
  const body = new URLSearchParams({
    id_token: idToken.trim(),
    client_id: clientId,
  });
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`line_verify_failed:${res.status}:${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    sub?: string;
    name?: string;
    picture?: string;
  };
  if (!data.sub) {
    throw new Error("line_verify_missing_sub");
  }
  return {
    sub: data.sub,
    name: data.name,
    picture: data.picture,
  };
}
