import assert from "node:assert/strict";
import fs from "node:fs";

const required = ["/financing", "/reviews", "/about", "/inventory/[slug]", "/get-approved", "/schedule-test-drive", "/vehicle/[id]"];
for (const route of required) {
  const file = "app" + route + "/page.tsx";
  assert.ok(fs.existsSync(file), "Broken public route: " + route);
}
const home = fs.readFileSync("app/Exact2vfDHome.tsx", "utf8");
assert.ok(!home.includes("const fallback:Vehicle"), "Do not advertise fictional/unverified vehicle stock");
assert.ok(!home.includes("/inventory/${v.slug}"), "Marketing slugs must not be used as canonical vehicle URLs");
assert.ok(home.includes("/vehicle/${encodeURIComponent(String(v.id))}"), "Live published vehicles must use canonical ID route");
assert.ok(home.includes("Verified listings are currently unavailable"), "No-inventory state must be visible");
console.log("PASS: seven WDCC public paths exist; only verified inventory is linked, with no fabricated listings");
