import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

import { ADMIN_TOKEN_COOKIE, USER_TOKEN_COOKIE } from "@/lib/auth/token-constants";

function getPublicBaseUrl(request: NextRequest): string {
  return (
    process.env.APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    request.nextUrl.origin
  ).replace(/\/$/, "");
}

function needsUserAppGate(pathname: string): boolean {
  if (pathname === "/") return true;
  return (
    pathname.startsWith("/user") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/campaigns")
  );
}

function redirectToCustomLineLogin(request: NextRequest) {
  const baseUrl = getPublicBaseUrl(request);
  const reqUrl = request.nextUrl;
  let callbackUrl = reqUrl.searchParams.get("callbackUrl")?.trim() ?? "";
  if (!callbackUrl) {
    callbackUrl = `${baseUrl}/user`;
  }
  const lineLogin = new URL("/api/auth/line", baseUrl);
  try {
    const resolved = new URL(callbackUrl, baseUrl);
    const appOrigin = new URL(baseUrl).origin;
    lineLogin.searchParams.set(
      "callbackUrl",
      resolved.origin === appOrigin ? resolved.toString() : `${baseUrl}/user`
    );
  } catch {
    lineLogin.searchParams.set("callbackUrl", `${baseUrl}/user`);
  }
  // 302 so any accidental POST to NextAuth sign-in becomes a GET to our OAuth start.
  return NextResponse.redirect(lineLogin, 302);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /**
   * NextAuth LINE uses redirect_uri …/api/auth/callback/line and sets next-auth cookies only.
   * This app gates /user on flexshare_user_token from …/api/auth/line/callback (LINE Console).
   * Sending users through /api/auth/signin/line caused loops and redirect_uri mismatch.
   */
  if (pathname === "/api/auth/signin" || pathname.startsWith("/api/auth/signin/")) {
    return redirectToCustomLineLogin(request);
  }

  if (pathname === "/api/auth/callback/line") {
    const sp = request.nextUrl.searchParams;
    if (sp.get("error")) {
      return NextResponse.redirect(
        new URL("/register?error=line_oauth_denied", getPublicBaseUrl(request)),
        302
      );
    }
    if (!sp.get("code")?.trim()) {
      return redirectToCustomLineLogin(request);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/cms")) {
    if (pathname.startsWith("/cms/login")) {
      return NextResponse.next();
    }

    const token = request.cookies.get(ADMIN_TOKEN_COOKIE)?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/cms/login", request.url));
    }

    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret || secret.length < 32) {
      return NextResponse.redirect(new URL("/cms/login?error=config", request.url));
    }

    try {
      await jwtVerify(token, new TextEncoder().encode(secret), {
        algorithms: ["HS256"],
      });
    } catch {
      return NextResponse.redirect(new URL("/cms/login", request.url));
    }

    return NextResponse.next();
  }

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/share")
  ) {
    return NextResponse.next();
  }

  const isRegister = pathname.startsWith("/register");
  const needsGate = needsUserAppGate(pathname);

  if (!isRegister && !needsGate) {
    return NextResponse.next();
  }

  const userToken = request.cookies.get(USER_TOKEN_COOKIE)?.value;

  // Do not verify USER_JWT in Edge: the secret is often missing at `next build` while present at
  // `next start`, which makes verification fail forever and loops OAuth. /api/auth/me runs on Node
  // with the real env and validates the cookie instead.

  if (isRegister) {
    if (!userToken) {
      const baseUrl = getPublicBaseUrl(request);
      const lineLogin = new URL("/api/auth/line", baseUrl);
      lineLogin.searchParams.set(
        "callbackUrl",
        new URL("/register", baseUrl).toString()
      );
      return NextResponse.redirect(lineLogin);
    }

    try {
      const registerState = await fetch(new URL("/api/auth/me", getPublicBaseUrl(request)), {
        headers: { cookie: request.headers.get("cookie") ?? "" },
        cache: "no-store",
      });
      if (!registerState.ok) {
        const response = NextResponse.redirect(new URL("/api/auth/line?callbackUrl=/register", getPublicBaseUrl(request)));
        response.cookies.delete(USER_TOKEN_COOKIE);
        return response;
      }
      const data = (await registerState.json()) as {
        ok?: boolean;
        user?: { registrationCompleted?: boolean };
      };
      if (data.user?.registrationCompleted !== false) {
        return NextResponse.redirect(new URL("/user", request.url));
      }
    } catch {
      return NextResponse.next();
    }
    return NextResponse.next();
  }

  if (needsGate) {
    if (!userToken) {
      const baseUrl = getPublicBaseUrl(request);
      const lineLogin = new URL("/api/auth/line", baseUrl);
      lineLogin.searchParams.set("callbackUrl", new URL(pathname, baseUrl).toString());
      return NextResponse.redirect(lineLogin);
    }
    try {
      const authState = await fetch(new URL("/api/auth/me", getPublicBaseUrl(request)), {
        headers: { cookie: request.headers.get("cookie") ?? "" },
        cache: "no-store",
      });
      if (!authState.ok) {
        const response = NextResponse.redirect(new URL("/api/auth/line", getPublicBaseUrl(request)));
        response.cookies.delete(USER_TOKEN_COOKIE);
        return response;
      }
      const data = (await authState.json()) as {
        ok?: boolean;
        user?: { registrationCompleted?: boolean };
      };
      if (data.user?.registrationCompleted === false) {
        return NextResponse.redirect(new URL("/register", request.url));
      }
    } catch {
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/auth/signin",
    "/api/auth/signin/:path*",
    "/api/auth/callback/line",
    "/cms/:path*",
    "/register",
    "/register/:path*",
    "/user",
    "/user/:path*",
    "/profile/:path*",
    "/profile",
    "/campaigns/:path*",
    "/campaigns",
    "/sponsor/:path*",
    "/sponsor",
    "/",
  ],
};
