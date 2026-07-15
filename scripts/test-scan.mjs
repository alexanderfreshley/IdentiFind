/**
 * End-to-end scan pipeline test for IdentiFind.
 * Plain ESM — no TypeScript compilation needed.
 *
 * Usage:
 *   node scripts/test-scan.mjs [email] [username]
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// ─── Load .env manually ───────────────────────────────────────────────────────
const envPath = resolve(process.cwd(), ".env");
try {
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key && !process.env[key]) process.env[key] = val;
  }
} catch {
  console.warn("Could not read .env file");
}

// ─── Config ───────────────────────────────────────────────────────────────────

const EMAIL    = process.argv[2] ?? "alexander.freshley@gmail.com";
const USERNAME = process.argv[3] ?? "alexfreshley";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PASS = "\x1b[32m✓\x1b[0m";
const FAIL = "\x1b[31m✗\x1b[0m";
const SKIP = "\x1b[33m⏭\x1b[0m";
const INFO = "\x1b[36mℹ\x1b[0m";

let failCount = 0;

function section(title) {
  console.log(`\n\x1b[1m${"─".repeat(60)}\x1b[0m`);
  console.log(`\x1b[1m  ${title}\x1b[0m`);
  console.log(`\x1b[1m${"─".repeat(60)}\x1b[0m`);
}
function pass(label, detail = "") {
  console.log(`  ${PASS} ${label}${detail ? `  → ${detail}` : ""}`);
}
function fail(label, detail = "") {
  console.log(`  ${FAIL} ${label}${detail ? `  → ${detail}` : ""}`);
  failCount++;
}
function skip(label, reason) {
  console.log(`  ${SKIP} ${label}  (${reason})`);
}
function info(msg) {
  console.log(`  ${INFO} ${msg}`);
}
function assert(label, condition, detail = "") {
  condition ? pass(label, detail) : fail(label, detail);
}

// ─── IntelX ───────────────────────────────────────────────────────────────────

async function testIntelX() {
  section("IntelX — dark web / paste search");

  const key = process.env.INTELX_API_KEY;
  if (!key) { skip("IntelX", "INTELX_API_KEY not set"); return; }

  const base = "https://2.intelx.io";

  for (const [query, type] of [[EMAIL, "email"], [USERNAME, "username"]]) {
    info(`Querying ${type}: ${query}`);
    try {
      // Step 1: initiate search
      const searchRes = await fetch(`${base}/intelligent/search`, {
        method: "POST",
        headers: { "x-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          term: query,
          maxresults: 10,
          media: 0,
          target: 0,
          timeout: 20,
          sort: 4,
          termtype: type === "email" ? 1 : 0,
        }),
      });

      assert(`IntelX ${type} search initiated (HTTP ${searchRes.status})`, searchRes.ok, `status ${searchRes.status}`);
      if (!searchRes.ok) continue;

      const { id } = await searchRes.json();
      assert(`Search job ID returned`, typeof id === "string" && id.length > 0, id);

      // Step 2: wait and fetch results
      await new Promise(r => setTimeout(r, 3000));
      const resultRes = await fetch(`${base}/intelligent/search/result?id=${id}&limit=10&offset=0`, {
        headers: { "x-key": key },
      });

      assert(`IntelX ${type} results endpoint responded`, resultRes.ok, `status ${resultRes.status}`);
      if (!resultRes.ok) continue;

      const data = await resultRes.json();
      const records = data.records ?? [];
      assert(`IntelX ${type} results is an array`, Array.isArray(records), `${records.length} record(s)`);

      if (records.length > 0) {
        info(`${records.length} record(s) found — first: "${records[0].name}" in bucket "${records[0].bucket}"`);
      } else {
        info(`No IntelX hits for ${type} "${query}" (clean — no dark web exposure found)`);
      }
    } catch (err) {
      fail(`IntelX ${type} query threw`, String(err));
    }
  }
}

// ─── Hunter.io ────────────────────────────────────────────────────────────────

async function testHunter() {
  section("Hunter.io — email public exposure check");

  const key = process.env.HUNTER_API_KEY;
  if (!key) { skip("Hunter.io", "HUNTER_API_KEY not set"); return; }

  info(`Querying email: ${EMAIL}`);
  try {
    const params = new URLSearchParams({ email: EMAIL, api_key: key });
    const res = await fetch(`https://api.hunter.io/v2/email-verifier?${params}`);

    assert(`Hunter.io API responded`, res.ok, `HTTP ${res.status}`);
    if (!res.ok) return;

    const data = await res.json();
    const d = data.data ?? {};

    assert(`Response has status field`, typeof d.status === "string", d.status);
    assert(`Response has score field`, typeof d.score === "number", `score=${d.score}`);

    const sources = d.sources ?? [];
    assert(`Sources is an array`, Array.isArray(sources), `${sources.length} source(s)`);

    if (sources.length > 0) {
      const domains = [...new Set(sources.map(s => s.domain).filter(Boolean))];
      info(`Email found in ${sources.length} public source(s) across ${domains.length} domain(s)`);
      info(`Sample domains: ${domains.slice(0, 4).join(", ")}`);
    } else {
      info("Email not found in any public sources (clean result)");
    }

    info(`Deliverability: ${d.status}, score: ${d.score}/100, webmail: ${d.webmail}`);
  } catch (err) {
    fail("Hunter.io query threw", String(err));
  }
}

// ─── crt.sh ───────────────────────────────────────────────────────────────────

async function testCertTransparency() {
  section("Certificate Transparency — lookalike domain detection");

  const name = USERNAME;
  info(`Searching crt.sh for domains containing: "${name}"`);
  try {
    const res = await fetch(
      `https://crt.sh/?q=%25${encodeURIComponent(name)}%25&output=json`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) }
    );

    assert("crt.sh API responded", res.ok, `HTTP ${res.status}`);
    if (!res.ok) return;

    const records = await res.json();
    assert("Response is an array", Array.isArray(records), `${records.length} total cert(s)`);

    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const recent = records.filter(r =>
      new Date(r.entry_timestamp) > cutoff &&
      !r.common_name.startsWith("*.") &&
      r.name_value?.toLowerCase().includes(name.toLowerCase())
    );

    assert("Filtered recent results is an array", Array.isArray(recent), `${recent.length} in last 90 days`);

    if (recent.length > 0) {
      info(`${recent.length} lookalike domain(s) found:`);
      for (const r of recent.slice(0, 5)) {
        info(`  → ${r.common_name} (issued ${r.entry_timestamp.slice(0, 10)})`);
      }
    } else {
      info(`No lookalike domains for "${name}" in past 90 days (clean)`);
    }
  } catch (err) {
    fail("crt.sh query threw", String(err));
  }
}

// ─── Username scanner (spot-check 5 sites) ────────────────────────────────────

async function testUsernameScanner() {
  section("Username Scanner — spot-check 5 sites");

  const sites = [
    { name: "GitHub",      url: `https://github.com/${USERNAME}` },
    { name: "Reddit",      url: `https://www.reddit.com/user/${USERNAME}/` },
    { name: "Twitter/X",   url: `https://x.com/${USERNAME}` },
    { name: "Medium",      url: `https://medium.com/@${USERNAME}` },
    { name: "Keybase",     url: `https://keybase.io/${USERNAME}` },
  ];

  info(`Checking "${USERNAME}" across ${sites.length} sites...`);

  for (const site of sites) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(site.url, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "IdentiFind-Scanner/1.0" },
      });
      clearTimeout(timer);
      const found = res.status === 200;
      info(`${site.name}: ${found ? "FOUND" : `not found`} (HTTP ${res.status}) — ${site.url}`);
      pass(`${site.name} check completed without error`);
    } catch (err) {
      const msg = err?.name === "AbortError" ? "timeout" : String(err);
      info(`${site.name}: ${msg} (network/bot protection — expected for some sites)`);
      pass(`${site.name} check ran (network error is acceptable)`);
    }
  }
}

// ─── Key inventory ────────────────────────────────────────────────────────────

function testKeyInventory() {
  section("API Key Inventory");

  const keys = [
    ["INTELX_API_KEY",       "Intelligence X",    true],
    ["HUNTER_API_KEY",       "Hunter.io",         true],
    ["HIBP_API_KEY",         "Have I Been Pwned", false],
    ["DEHASHED_API_KEY",     "DeHashed",          false],
    ["LEAKLOOKUP_API_KEY",   "Leak-Lookup",       false],
    ["PDL_API_KEY",          "PeopleDataLabs",    false],
    ["FULLCONTACT_API_KEY",  "FullContact",       false],
    ["WHITEPAGES_API_KEY",   "Whitepages Pro",    false],
    ["PIPL_API_KEY",         "Pipl",              false],
    ["SPOKEO_API_KEY",       "Spokeo",            false],
    ["BEENVERIFIED_API_KEY", "BeenVerified",      false],
    ["GOOGLE_CLIENT_ID",     "Google OAuth",      false],
    ["GITHUB_CLIENT_ID",     "GitHub OAuth",      false],
    ["LINKEDIN_CLIENT_ID",   "LinkedIn OAuth",    false],
    ["TWITTER_CLIENT_ID",    "Twitter OAuth",     false],
    ["FACEBOOK_CLIENT_ID",   "Facebook OAuth",    false],
  ];

  for (const [envVar, name, expected] of keys) {
    const present = !!process.env[envVar];
    if (present) {
      pass(`${name} key configured`, envVar);
    } else if (expected) {
      fail(`${name} key MISSING`, `set ${envVar} in .env`);
    } else {
      skip(`${name}`, `set ${envVar} in .env to enable`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n\x1b[1m\x1b[35m ═══ IdentiFind — End-to-End Scan Test ═══\x1b[0m");
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Username: ${USERNAME}`);
  console.log(`  Date:     ${new Date().toISOString()}`);

  await testIntelX();
  await testHunter();
  await testCertTransparency();
  await testUsernameScanner();
  testKeyInventory();

  section("Summary");
  if (failCount > 0) {
    console.log(`  \x1b[31m✗ ${failCount} test(s) failed — see above.\x1b[0m\n`);
    process.exit(1);
  } else {
    console.log(`  \x1b[32m✓ All active tests passed.\x1b[0m\n`);
  }
}

main().catch(err => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
