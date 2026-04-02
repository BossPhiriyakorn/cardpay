import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";
import Sponsor from "@/models/Sponsor";

const USERNAME_RE = /^[a-z0-9_]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: {
    username?: string;
    password?: string;
    companyName?: string;
    contactEmail?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const username = String(body.username ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const companyName = String(body.companyName ?? "").trim();
  const contactEmail = String(body.contactEmail ?? "").trim().toLowerCase();

  if (!USERNAME_RE.test(username)) {
    return NextResponse.json(
      { ok: false, error: "invalid_username" },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { ok: false, error: "password_too_short" },
      { status: 400 }
    );
  }
  if (!companyName || companyName.length > 200) {
    return NextResponse.json(
      { ok: false, error: "invalid_company_name" },
      { status: 400 }
    );
  }
  if (contactEmail && !EMAIL_RE.test(contactEmail)) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const existing = await Sponsor.findOne({ portalUsername: username })
      .select("_id")
      .lean();
    if (existing) {
      return NextResponse.json({ ok: false, error: "username_taken" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await Sponsor.create({
      companyName,
      status: "active",
      portalUsername: username,
      portalPasswordHash: passwordHash,
      contactEmail: contactEmail || "",
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: number }).code : 0;
    if (code === 11000) {
      return NextResponse.json({ ok: false, error: "username_taken" }, { status: 409 });
    }
    console.error("[sponsor/auth/register]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}
