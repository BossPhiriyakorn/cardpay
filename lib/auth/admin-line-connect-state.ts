import { SignJWT, jwtVerify } from "jose";

function getSecretBytes(): Uint8Array {
  const s = process.env.ADMIN_JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error("ADMIN_JWT_SECRET is missing or too short");
  }
  return new TextEncoder().encode(s);
}

type AdminLineStatePayload = {
  sub: string;
  typ: "admin-line-connect";
};

export async function signAdminLineConnectState(adminId: string): Promise<string> {
  return new SignJWT({ typ: "admin-line-connect" } as AdminLineStatePayload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(adminId)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getSecretBytes());
}

export async function verifyAdminLineConnectState(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, getSecretBytes(), {
    algorithms: ["HS256"],
  });
  if (payload.typ !== "admin-line-connect" || typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("invalid_admin_line_connect_state");
  }
  return payload.sub;
}
