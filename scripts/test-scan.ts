/**
 * End-to-end scan pipeline test for IdentiFind.
 *
 * Tests every scanner that can fire without a full DB/auth session:
 *   ✅ IntelX       (INTELX_API_KEY configured)
 *   ✅ Hunter.io    (HUNTER_API_KEY configured)
 *   ✅ crt.sh       (no key required)
 *   ✅ Username scanner (no key required — HEAD requests)
 *   ⏭ HIBP         (key not yet configured — skip)
 *   ⏭ DeHashed     (key not yet configured — skip)
 *   ⏭ Leak-Lookup  (key not yet configured — skip)
 *   ⏭ PII brokers  (keys not yet configured — skip)
 *
 * Usage:
 *   npx tsx scripts/test-scan.ts [email] [username]
 *
 * Defaults (safe test subject):
 *   email    → alexander.freshley@gmail.com
 *   username → alexfreshley
 */

import "dotenv/config";
import {
  queryIntelX,
  queryLookalikeDomains,
} from "../src/lib/scanner/breach-scanner";
import { queryHunter } from "../src/lib/scanner/pii-scanner";
import { scanUsername } from "../src/lib/scanner/username-scanner";

// ─── Config ───────────────────────────────────────────────────────────────────

const EMAIL    = process.argv[2] ?? "alexander.freshley@gmail.com";
const USERNAME = process.argv[3] ?? "alexfreshley";
const NAME     = "alexfreshley"; // used for domain lookalike search

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PASS  = "\x1b[32m✓\x1b[0m";
const FAIL  = "\x1b[31m✗\x1b[0m";
const SKIP  = "\x1b[33m⏭\x1b[0m";
const INFO  = "\x1b[36mℹ\x1b[0m";

function section(title: string) {
  console.log(`\n\x1b[1m${"─".repeat(60)}\x1b[0m`);
  console.log(`\x1b[1m  ${title}\x1b[0m`);
  console.log(`\x1b[1m${"─".repeat(60)}\x1b[0m`);
}

function assert(label: string, condition: boolean, detail?: string) {
  const icon = condition ? PASS : FAIL;
  console.log(`  ${icon} ${label}${detail ? `  → ${detail}` : ""}`);
  if (!condition) process.exitCode = 1;
}

function skip(label: string, reason: string) {
  console.log(`  ${SKIP} ${label}  (${reason})`);
}

function info(msg: string) {
  console.log(`  ${INFO} ${msg}`);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function testIntelX() {
  section("IntelX — dark web / paste search");

  const key = process.env.INTELX_API_KEY;
  if (!key) {
    skip("IntelX email query", "INTELX_API_KEY not set");
    skip("IntelX username query", "INTELX_API_KEY not set");
    return;
  }

  info(`Querying email: ${EMAIL}`);
  try {
    const emailResults = await queryIntelX(EMAIL, "email");
    assert(
      "IntelX email query returns an array",
      Array.isArray(emailResults),
      `got ${typeof emailResults}`
    );
    assert(
      "Each record has required fields",
      emailResults.every(
        (r) =>
          typeof r.sourceId === "string" &&
          typeof r.sourceName === "string" &&
          typeof r.confidence === "number" &&
          Array.isArray(r.dataClasses)
      ),
      `${emailResults.length} record(s)`
    );
    if (emailResults.length > 0) {
      const r = emailResults[0];
      info(`First result: "${r.breachName}" (confidence ${r.confidence}, isDarkWeb=${r.isDarkWeb})`);
    } else {
      info("No IntelX hits for this email (this is fine — clean result is valid)");
    }
  } catch (err) {
    assert("IntelX email query did not throw", false, String(err));
  }

  info(`Querying username: ${USERNAME}`);
  try {
    const userResults = await queryIntelX(USERNAME, "username");
    assert(
      "IntelX username query returns an array",
      Array.isArray(userResults),
      `${userResults.length} record(s)`
    );
    if (userResults.length > 0) {
      info(`First result: "${userResults[0].breachName}"`);
    } else {
      info("No IntelX hits for this username");
    }
  } catch (err) {
    assert("IntelX username query did not throw", false, String(err));
  }
}

async function testHunter() {
  section("Hunter.io — email exposure check");

  const key = process.env.HUNTER_API_KEY;
  if (!key) {
    skip("Hunter.io query", "HUNTER_API_KEY not set");
    return;
  }

  info(`Querying email: ${EMAIL}`);
  try {
    const results = await queryHunter(EMAIL);
    assert(
      "Hunter.io query returns an array",
      Array.isArray(results),
      `got ${typeof results}`
    );
    assert(
      "Each record has sourceId and confidence",
      results.every(
        (r) => typeof r.sourceId === "string" && typeof r.confidence === "number"
      ),
      `${results.length} record(s)`
    );
    if (results.length > 0) {
      const r = results[0];
      const profileCount = Object.keys(r.socialProfiles ?? {}).length;
      info(`Found ${profileCount} public profile source(s) for this email`);
      if (profileCount > 0) {
        const domains = Object.keys(r.socialProfiles!).slice(0, 3).join(", ");
        info(`Sample domains: ${domains}`);
      }
    } else {
      info("No Hunter.io sources found for this email (clean result)");
    }
  } catch (err) {
    assert("Hunter.io query did not throw", false, String(err));
  }
}

async function testCertTransparency() {
  section("Certificate Transparency — lookalike domain detection");

  info(`Searching crt.sh for domains containing: "${NAME}"`);
  try {
    const results = await queryLookalikeDomains(NAME);
    assert(
      "crt.sh query returns an array",
      Array.isArray(results),
      `got ${typeof results}`
    );
    assert(
      "Each record has required fields",
      results.every(
        (r) =>
          typeof r.sourceId === "string" &&
          typeof r.confidence === "number" &&
          Array.isArray(r.dataClasses)
      ),
      `${results.length} record(s)`
    );
    if (results.length > 0) {
      info(`${results.length} lookalike domain(s) found in last 90 days:`);
      for (const r of results.slice(0, 3)) {
        info(`  → ${r.rawData?.commonName} (confidence ${r.confidence})`);
      }
    } else {
      info(`No lookalike domains found for "${NAME}" (clean result)`);
    }
  } catch (err) {
    assert("crt.sh query did not throw", false, String(err));
  }
}

async function testUsernameScanner() {
  section("Username Scanner — cross-platform presence check");

  info(`Checking username "${USERNAME}" across 16 priority sites (30–60s)...`);
  try {
    const results = await scanUsername(USERNAME, []);
    assert(
      "Username scanner returns an array",
      Array.isArray(results),
      `got ${typeof results}`
    );
    assert(
      "Results cover expected sites",
      results.length >= 10,
      `${results.length} site(s) checked`
    );
    assert(
      "Each result has required fields",
      results.every(
        (r) =>
          typeof r.site === "string" &&
          typeof r.found === "boolean" &&
          typeof r.confidence === "number" &&
          r.checkedAt instanceof Date
      )
    );

    const found    = results.filter((r) => r.found);
    const notFound = results.filter((r) => !r.found);
    const errored  = results.filter((r) => r.error);

    info(`${found.length} site(s) where "@${USERNAME}" exists:`);
    for (const r of found) {
      info(`  → ${r.site}: ${r.url}`);
    }
    info(`${notFound.length} site(s) returned no match`);
    if (errored.length > 0) {
      info(`${errored.length} site(s) errored (timeouts / bot protection — expected):`);
      for (const r of errored) {
        info(`  → ${r.site}: ${r.error}`);
      }
    }
  } catch (err) {
    assert("Username scanner did not throw", false, String(err));
  }
}

function testSkippedApis() {
  section("Skipped APIs — keys not yet configured");
  const missing = [
    ["HIBP_API_KEY",         "Have I Been Pwned"],
    ["DEHASHED_API_KEY",     "DeHashed"],
    ["LEAKLOOKUP_API_KEY",   "Leak-Lookup"],
    ["PDL_API_KEY",          "PeopleDataLabs"],
    ["FULLCONTACT_API_KEY",  "FullContact"],
    ["WHITEPAGES_API_KEY",   "Whitepages Pro"],
    ["PIPL_API_KEY",         "Pipl"],
    ["SPOKEO_API_KEY",       "Spokeo"],
    ["BEENVERIFIED_API_KEY", "BeenVerified"],
  ];
  for (const [envVar, name] of missing) {
    if (!process.env[envVar]) {
      skip(name, `set ${envVar} in .env to enable`);
    } else {
      info(`${name} key is configured — will run in full scan`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n\x1b[1m\x1b[35m IdentiFind — End-to-End Scan Test\x1b[0m");
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Username: ${USERNAME}`);
  console.log(`  Date:     ${new Date().toISOString()}`);

  await testIntelX();
  await testHunter();
  await testCertTransparency();
  await testUsernameScanner();
  testSkippedApis();

  section("Summary");
  if (process.exitCode === 1) {
    console.log("  \x1b[31m✗ Some tests failed — see above for details.\x1b[0m\n");
  } else {
    console.log("  \x1b[32m✓ All active tests passed.\x1b[0m\n");
  }
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
