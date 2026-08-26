import { NextResponse } from "next/server";

const DEFAULT_ANDROID_APK =
  "https://github.com/OnlyClinton/CPX1/releases/download/wdcc-dealer-app-v2/WDCC-Dealer-v2.apk";

function installerUrl() {
  const configured = process.env.WDCC_ANDROID_APK_URL?.trim();
  if (!configured) return new URL(DEFAULT_ANDROID_APK);

  try {
    const candidate = new URL(configured);
    if (candidate.protocol !== "https:") return new URL(DEFAULT_ANDROID_APK);
    return candidate;
  } catch {
    return new URL(DEFAULT_ANDROID_APK);
  }
}

export const dynamic = "force-dynamic";

export async function GET() {
  const response = NextResponse.redirect(installerUrl(), 307);
  response.headers.set("Cache-Control", "public, max-age=300, s-maxage=300");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

