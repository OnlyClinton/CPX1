const ORIGIN = "https://wdcc-stopgap-hero-preview.vercel.app";
const ORIGIN_HOST = "wdcc-stopgap-hero-preview.vercel.app";
const DEV_HOST = "dev.wedontcarecars.com";

function toOriginUrl(requestUrl) {
  const incoming = new URL(requestUrl);
  const target = new URL(ORIGIN);
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  return target;
}

function rewriteLocation(headers, incoming) {
  const location = headers.get("location");
  if (!location) return;

  try {
    const target = new URL(location, ORIGIN);
    if (target.hostname !== ORIGIN_HOST) return;

    target.protocol = "https:";
    target.hostname = incoming.hostname;
    target.port = "";
    headers.set("location", target.toString());
  } catch {
    // Preserve non-URL Location values unchanged.
  }
}

function applyDevelopmentHeaders(headers, incoming, isHtml) {
  rewriteLocation(headers, incoming);
  headers.set("x-wdcc-environment", "development");
  headers.set("x-wdcc-dev-frontdoor", "cloudflare");
  headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  headers.set("access-control-allow-origin", incoming.origin);

  if (isHtml) {
    headers.set("cache-control", "no-store, max-age=0");
    headers.delete("content-length");
    headers.delete("etag");
  }
}

class DevelopmentMeta {
  element(element) {
    element.append(
      '<meta name="robots" content="noindex,nofollow,noarchive"><meta name="wdcc-environment" content="development">',
      { html: true },
    );
  }
}

export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    const isCandidate = incoming.hostname.endsWith(".workers.dev");

    if (incoming.hostname !== DEV_HOST && !isCandidate) {
      return new Response("Unknown development host", { status: 421 });
    }

    if (incoming.pathname === "/robots.txt") {
      return new Response("User-agent: *\nDisallow: /\n", {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
          "x-wdcc-environment": "development",
          "x-wdcc-dev-frontdoor": "cloudflare",
          "x-robots-tag": "noindex, nofollow, noarchive",
        },
      });
    }

    try {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-forwarded-host", incoming.host);
      requestHeaders.set("x-forwarded-proto", "https");
      requestHeaders.set("x-wdcc-environment", "development");
      requestHeaders.delete("cf-worker");

      const init = {
        method: request.method,
        headers: requestHeaders,
        redirect: "manual",
      };

      if (request.method !== "GET" && request.method !== "HEAD") {
        init.body = request.body;
      }

      const originResponse = await fetch(
        new Request(toOriginUrl(request.url).toString(), init),
      );
      const responseHeaders = new Headers(originResponse.headers);
      const contentType = originResponse.headers.get("content-type") || "";
      const isHtml = contentType.includes("text/html");

      applyDevelopmentHeaders(responseHeaders, incoming, isHtml);

      if (!isHtml) {
        return new Response(originResponse.body, {
          status: originResponse.status,
          statusText: originResponse.statusText,
          headers: responseHeaders,
        });
      }

      const transformed = new HTMLRewriter()
        .on("head", new DevelopmentMeta())
        .transform(originResponse);

      return new Response(transformed.body, {
        status: transformed.status,
        statusText: transformed.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      return new Response("WDCC development origin is temporarily unavailable.", {
        status: 502,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
          "x-wdcc-environment": "development",
          "x-wdcc-dev-frontdoor": "cloudflare",
          "x-wdcc-dev-error": error instanceof Error ? error.name : "unknown",
        },
      });
    }
  },
};
