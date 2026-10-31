import type {MetadataRoute} from "next";

const origin="https://wedontcarecars.com";
// Only canonical, public, stable navigation pages. No staging or admin URLs.
export default function sitemap():MetadataRoute.Sitemap{
  const urls=[
    ["/",1.0,"weekly"],
    ["/inventory",0.9,"daily"],
    ["/get-approved",0.8,"monthly"],
    ["/schedule-test-drive",0.8,"monthly"],
    ["/contact",0.7,"monthly"],
    ["/about",0.6,"monthly"],
    ["/privacy",0.2,"yearly"],
    ["/terms",0.2,"yearly"]
  ] as const;
  return urls.map(([path,priority,changeFrequency])=>({
    url:origin+path,
    priority,
    changeFrequency
  }));
}
