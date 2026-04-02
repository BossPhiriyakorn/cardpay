import { NextResponse } from "next/server";

const NEXTAUTH_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.callback-url",
  "__Secure-next-auth.callback-url",
  "authjs.callback-url",
  "__Secure-authjs.callback-url",
  "next-auth.csrf-token",
  "__Host-next-auth.csrf-token",
  "authjs.csrf-token",
  "__Host-authjs.csrf-token",
];

export function clearNextAuthCookies(response: NextResponse) {
  for (const name of NEXTAUTH_COOKIE_NAMES) {
    response.cookies.delete(name);
  }
  return response;
}
