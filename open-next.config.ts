// The Cloudflare adapter is installed by the isolated preview and production
// workflows, not by the Vercel-origin dependency set.
// @ts-ignore -- resolved when @opennextjs/cloudflare is installed by CI.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
