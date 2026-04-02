export function getAppBaseUrl() {
  return (
    process.env.APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function getLineLoginConfig() {
  return {
    channelId: process.env.LINE_CLIENT_ID?.trim() ?? "",
    channelSecret: process.env.LINE_CLIENT_SECRET?.trim() ?? "",
  };
}

export function getLineLoginRedirectUri() {
  return `${getAppBaseUrl()}/api/auth/line/callback`;
}

export function getAdminLineConnectRedirectUri() {
  return getLineLoginRedirectUri();
}
