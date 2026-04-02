import { NextResponse } from "next/server";

import { clearNextAuthCookies } from "@/lib/auth/nextauth-cookie-utils";
import { getUserSession } from "@/lib/auth/require-user-session";
import { clearUserAuthCookies } from "@/lib/auth/user-jwt";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";

export async function GET() {
  const session = await getUserSession();
  if (!session?.userId) {
    const response = NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    clearUserAuthCookies(response);
    clearNextAuthCookies(response);
    return response;
  }

  await connectToDatabase();
  const user = await User.findById(session.userId)
    .select("name image firstName lastName lineUid registrationCompleted")
    .lean();

  if (!user) {
    const response = NextResponse.json({ ok: false, error: "user_not_found" }, { status: 401 });
    clearUserAuthCookies(response);
    clearNextAuthCookies(response);
    return response;
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: String(user._id),
      name: String(user.name ?? ""),
      image: String(user.image ?? ""),
      firstName: String(user.firstName ?? ""),
      lastName: String(user.lastName ?? ""),
      lineUid: String(user.lineUid ?? ""),
      registrationCompleted: user.registrationCompleted !== false,
    },
  });
}
