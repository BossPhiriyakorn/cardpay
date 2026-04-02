import type { NextAuthOptions } from "next-auth";
import LineProvider from "next-auth/providers/line";
import { cookies } from "next/headers";

import {
  ADMIN_LINE_CONNECT_STATE_COOKIE,
  ADMIN_LINE_CONNECT_TARGET_COOKIE,
  ADMIN_LINE_CONNECT_TARGET_VALUE,
} from "@/lib/auth/admin-line-connect-cookies";
import { verifyAdminLineConnectState } from "@/lib/auth/admin-line-connect-state";
import { requireAdminSession } from "@/lib/auth/require-admin-session";
import { connectToDatabase } from "@/lib/mongodb";
import { generateUniqueReferralCode } from "@/lib/referral-code";
import CmsAdmin from "@/models/CmsAdmin";
import User from "@/models/User";

type LineProfile = {
  sub?: string;
  name?: string;
  picture?: string;
};

const isSecureAuthCookie =
  process.env.NEXTAUTH_URL?.startsWith("https://") ||
  process.env.APP_URL?.startsWith("https://") ||
  process.env.NODE_ENV === "production";

const authCookiePrefix = isSecureAuthCookie ? "__Secure-" : "";

function crossSiteCookieOptions(httpOnly: boolean) {
  return {
    httpOnly,
    sameSite: "none" as const,
    path: "/",
    secure: isSecureAuthCookie,
  };
}

export const authOptions: NextAuthOptions = {
  /** Middleware sends /api/auth/signin* to /api/auth/line so LINE uses …/line/callback + user JWT. */
  pages: {
    signIn: "/",
  },
  providers: [
    LineProvider({
      clientId: process.env.LINE_CLIENT_ID ?? "",
      clientSecret: process.env.LINE_CLIENT_SECRET ?? "",
      // LINE in-app browser / mobile callback can lose OAuth state cookies.
      // We disable provider state checks here so sign-in still completes on mobile.
      checks: ["none"],
    }),
  ],
  cookies: {
    sessionToken: {
      name: `${authCookiePrefix}next-auth.session-token`,
      options: crossSiteCookieOptions(true),
    },
    callbackUrl: {
      name: `${authCookiePrefix}next-auth.callback-url`,
      options: crossSiteCookieOptions(false),
    },
    csrfToken: {
      name: isSecureAuthCookie ? "__Host-next-auth.csrf-token" : "next-auth.csrf-token",
      options: {
        ...crossSiteCookieOptions(false),
        path: "/",
      },
    },
    state: {
      name: `${authCookiePrefix}next-auth.state`,
      options: crossSiteCookieOptions(true),
    },
    nonce: {
      name: `${authCookiePrefix}next-auth.nonce`,
      options: crossSiteCookieOptions(true),
    },
    pkceCodeVerifier: {
      name: `${authCookiePrefix}next-auth.pkce.code_verifier`,
      options: crossSiteCookieOptions(true),
    },
  },
  jwt: {
    /** ผู้ใช้ที่ล็อกอินผ่าน LINE มีอายุ session 5 วัน */
    maxAge: 60 * 60 * 24 * 5,
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 5,
  },
  callbacks: {
    async signIn({ user, profile }) {
      const lineProfile = profile as LineProfile | undefined;
      const lineUid = lineProfile?.sub;
      const cookieStore = await cookies();
      const connectTarget =
        cookieStore.get(ADMIN_LINE_CONNECT_TARGET_COOKIE)?.value ?? "";
      const connectState =
        cookieStore.get(ADMIN_LINE_CONNECT_STATE_COOKIE)?.value ?? "";

      if (connectTarget === ADMIN_LINE_CONNECT_TARGET_VALUE) {
        if (!lineUid) {
          return "/api/auth/admin/line/complete?status=invalid_profile";
        }

        try {
          const admin = await requireAdminSession();
          if (!admin.ok) {
            return "/api/auth/admin/line/complete?status=session_expired";
          }

          const stateAdminId = await verifyAdminLineConnectState(connectState);
          if (stateAdminId !== admin.id) {
            return "/api/auth/admin/line/complete?status=state_mismatch";
          }

          await connectToDatabase();
          const duplicateAdmin = await CmsAdmin.findOne({
            _id: { $ne: admin.id },
            lineNotifyUserId: lineUid,
          })
            .select("_id")
            .lean();
          if (duplicateAdmin?._id) {
            return "/api/auth/admin/line/complete?status=duplicate";
          }

          await CmsAdmin.findByIdAndUpdate(admin.id, {
            $set: {
              lineNotifyUserId: lineUid,
              lineNotifyEnabled: true,
            },
          });

          return "/api/auth/admin/line/complete?status=success";
        } catch (error) {
          console.error("[authOptions.signIn][admin_connect]", error);
          return "/api/auth/admin/line/complete?status=failed";
        }
      }

      if (!lineUid) {
        return false;
      }

      await connectToDatabase();

      const existingUser = await User.findOne({ lineUid }).select("_id");

      if (!existingUser) {
        await User.create({
          lineUid,
          name: user.name ?? lineProfile?.name ?? "",
          image: user.image ?? lineProfile?.picture ?? "",
          role: "user",
          walletBalance: 0,
          referralCode: await generateUniqueReferralCode(),
          registrationCompleted: false,
        });
      } else {
        const lineImage = user.image ?? lineProfile?.picture;
        const updateSet: Record<string, string> = {};
        if (lineImage) {
          updateSet.image = lineImage;
        }
        const existingReferralCode = String(
          (await User.findById(existingUser._id).select("referralCode").lean())?.referralCode ?? ""
        ).trim();
        if (!existingReferralCode) {
          updateSet.referralCode = await generateUniqueReferralCode();
        }
        if (Object.keys(updateSet).length > 0) {
          await User.updateOne(
            { _id: existingUser._id },
            { $set: updateSet }
          );
        }
      }

      return true;
    },
    async jwt({ token, profile, trigger, account }) {
      if (account?.access_token) {
        token.lineAccessToken = account.access_token as string;
      }

      const lineProfile = profile as LineProfile | undefined;
      const lineUid = lineProfile?.sub ?? token.lineUid;

      if (trigger === "update" && token.uid) {
        await connectToDatabase();
        const refreshed = await User.findById(token.uid).select(
          "role registrationCompleted image"
        );
        if (refreshed) {
          token.role = refreshed.role;
          token.registrationCompleted = refreshed.registrationCompleted !== false;
          if (refreshed.image) token.picture = refreshed.image;
        }
        return token;
      }

      if (!lineUid) {
        return token;
      }

      await connectToDatabase();
      const dbUser = await User.findOne({ lineUid }).select(
        "_id role registrationCompleted image"
      );

      if (dbUser) {
        token.uid = String(dbUser._id);
        token.role = dbUser.role;
        token.lineUid = lineUid;
        token.registrationCompleted = dbUser.registrationCompleted !== false;
        if (dbUser.image) token.picture = dbUser.image;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string | undefined) ?? "";
        session.user.role =
          (token.role as "user" | "sponsor" | "admin" | undefined) ?? "user";
        session.user.lineUid = (token.lineUid as string | undefined) ?? "";
        session.user.registrationCompleted =
          (token.registrationCompleted as boolean | undefined) !== false;
        if (token.picture) {
          session.user.image = String(token.picture);
        }
      }

      return session;
    },
  },
};
