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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
