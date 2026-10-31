import type {MetadataRoute} from "next";

// Index the public storefront. Security for private routes must be enforced
// by authentication, not robots.txt or search-engine noindex tags.
export default function robots():MetadataRoute.Robots{
  return {
    rules:{
      userAgent:"*",
      allow:"/",
      disallow:["/api/","/admin","/dealer","/login","/forgot-password","/reset-password","/change-password"]
    },
    sitemap:"https://wedontcarecars.com/sitemap.xml",
    host:"https://wedontcarecars.com"
  };
}
