export const LINE_OAUTH_STATE_COOKIE = "line_oauth_state";
export const LINE_OAUTH_TARGET_COOKIE = "line_oauth_target";
export const LINE_OAUTH_CALLBACK_URL_COOKIE = "line_oauth_callback_url";

export const LINE_OAUTH_TARGET_USER_LOGIN = "user_login";
export const LINE_OAUTH_TARGET_ADMIN_CONNECT = "admin_connect";

export function getLineOauthCookieOptions(maxAgeSec?: number) {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? ("none" as const) : ("lax" as const),
    path: "/",
    maxAge: maxAgeSec ?? 10 * 60,
  };
}
