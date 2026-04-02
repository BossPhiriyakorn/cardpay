import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import {
  getSponsorCookieMaxAgeSeconds,
  signSponsorAccessToken,
} from "@/lib/auth/sponsor-jwt";
import { SPONSOR_TOKEN_COOKIE } from "@/lib/auth/token-constants";
import { connectToDatabase } from "@/lib/mongodb";
import Sponsor from "@/models/Sponsor";

export async function POST(request: Request) {
  let body: { username?: string; password?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const username = String(body.username ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  if (!username || !password) {
    return NextResponse.json({ ok: false, error: "missing_credentials" }, { status: 400 });
  }

  try {
    await connectToDatabase();
  } catch (e) {
    console.error("[sponsor/auth/login] DB:", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }

  const sponsor = await Sponsor.findOne({
    portalUsername: username,
    status: "active",
  }).select("+portalPasswordHash");

  if (!sponsor?.portalPasswordHash) {
    return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
  }

  const match = await bcrypt.compare(password, sponsor.portalPasswordHash);
  if (!match) {
    return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
  }

  let token: string;
  try {
    token = await signSponsorAccessToken(String(sponsor._id));
  } catch (e) {
    console.error("[sponsor/auth/login] JWT:", e);
    return NextResponse.json({ ok: false, error: "token_config" }, { status: 503 });
  }

  const maxAge = getSponsorCookieMaxAgeSeconds();
  const response = NextResponse.json({
    ok: true,
    companyName: String(sponsor.companyName ?? ""),
    sponsorId: String(sponsor._id),
  });
  response.cookies.set(SPONSOR_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  return response;
}
