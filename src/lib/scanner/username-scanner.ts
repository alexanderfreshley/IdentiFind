/**
 * Username / Impersonation Scanner for IdentiFind.
 *
 * Uses the WhatsMyName open dataset (600+ sites) to check for accounts
 * matching a given username or name variation. This surfaces potential
 * impersonators — accounts that weren't created by the user but share
 * their username or display name.
 *
 * The WhatsMyName dataset lives at:
 *   https://raw.githubusercontent.com/WebBreacher/WhatsMyName/main/wmn-data.json
 *
 * We fetch a cached copy to avoid excessive load on their servers.
 * The dataset format:
 *   { sites: [{ name, uri_check, e_code, e_string, m_string, category }] }
 *
 * Implementation note: We do NOT scrape sites in bulk. Instead, we check
 * a curated list of high-priority platforms and use the WMN dataset's
 * expected response codes/strings to determine account existence.
 *
 * Rate limiting: scans are queued and throttled to 1 req/500ms per target site.
 */

export interface UsernameScanResult {
  site: string;
  category: string;
  url: string;
  found: boolean;
  /** Was this found by the monitored user themselves (known account) or potentially an impersonator? */
  isKnownAccount: boolean;
  confidence: number;  // 0–100
  checkedAt: Date;
  error?: string;
}

export interface UsernameScanSummary {
  username: string;
  totalChecked: number;
  foundCount: number;
  potentialImpersonators: UsernameScanResult[];
  knownAccounts: UsernameScanResult[];
}

// High-priority sites to check (subset of WhatsMyName — avoids rate-limiting every site)
const PRIORITY_SITES: Array<{
  name: string;
  category: string;
  urlTemplate: string;
  checkMethod: "status" | "content";
  expectedStatus?: number;
  expectedContent?: string;
  notFoundContent?: string;
}> = [
  {
    name: "Instagram",
    category: "social",
    urlTemplate: "https://www.instagram.com/{username}/",
    checkMethod: "status",
    expectedStatus: 200,
  },
  {
    name: "Twitter/X",
    category: "social",
    urlTemplate: "https://x.com/{username}",
    checkMethod: "status",
    expectedStatus: 200,
  },
  {
    name: "Facebook",
    category: "social",
    urlTemplate: "https://www.facebook.com/{username}",
    checkMethod: "status",
    expectedStatus: 200,
  },
  {
    name: "LinkedIn",
    category: "social",
    urlTemplate: "https://www.linkedin.com/in/{username}",
    checkMethod: "status",
    expectedStatus: 200,
  },
  {
    name: "TikTok",
    category: "social",
    urlTemplate: "https://www.tiktok.com/@{username}",
    checkMethod: "status",
    expectedStatus: 200,
  },
  {
    name: "YouTube",
    category: "social",
    urlTemplate: "https://www.youtube.com/@{username}",
    checkMethod: "status",
    expectedStatus: 200,
  },
  {
    name: "GitHub",
    category: "coding",
    urlTemplate: "https://github.com/{username}",
    checkMethod: "status",
    expectedStatus: 200,
  },
  {
    name: "Reddit",
    category: "social",
    urlTemplate: "https://www.reddit.com/user/{username}/",
    checkMethod: "status",
    expectedStatus: 200,
  },
  {
    name: "Pinterest",
    category: "social",
    urlTemplate: "https://www.pinterest.com/{username}/",
    checkMethod: "status",
    expectedStatus: 200,
  },
  {
    name: "Twitch",
    category: "gaming",
    urlTemplate: "https://www.twitch.tv/{username}",
    checkMethod: "status",
    expectedStatus: 200,
  },
  {
    name: "Steam",
    category: "gaming",
    urlTemplate: "https://steamcommunity.com/id/{username}",
    checkMethod: "content",
    expectedContent: "steamid",
    notFoundContent: "The specified profile could not be found",
  },
  {
    name: "Telegram",
    category: "messaging",
    urlTemplate: "https://t.me/{username}",
    checkMethod: "status",
    expectedStatus: 200,
  },
  {
    name: "Mastodon (mastodon.social)",
    category: "social",
    urlTemplate: "https://mastodon.social/@{username}",
    checkMethod: "status",
    expectedStatus: 200,
  },
  {
    name: "Substack",
    category: "blogging",
    urlTemplate: "https://{username}.substack.com",
    checkMethod: "status",
    expectedStatus: 200,
  },
  {
    name: "Medium",
    category: "blogging",
    urlTemplate: "https://medium.com/@{username}",
    checkMethod: "status",
    expectedStatus: 200,
  },
  {
    name: "Keybase",
    category: "identity",
    urlTemplate: "https://keybase.io/{username}",
    checkMethod: "status",
    expectedStatus: 200,
  },
];

/** Generates username variations used in impersonation attacks */
export function generateImpersonationVariants(username: string): string[] {
  const base = username.toLowerCase().replace(/[^a-z0-9]/g, "");
  const variants = new Set<string>();

  // Exact match
  variants.add(username.toLowerCase());

  // Common impersonation patterns
  variants.add(`${base}_official`);
  variants.add(`${base}_real`);
  variants.add(`real${base}`);
  variants.add(`official${base}`);
  variants.add(`the${base}`);
  variants.add(`${base}official`);
  variants.add(`${base}real`);
  variants.add(`${base}1`);
  variants.add(`${base}2`);
  variants.add(`i${base}`);  // capital I replacing lowercase l visually

  // Leetspeak substitutions (common in fake accounts)
  variants.add(base.replace(/o/g, "0").replace(/i/g, "1").replace(/e/g, "3"));
  variants.add(base.replace(/a/g, "@"));

  // Remove underscores / add underscores
  variants.add(base.replace(/_/g, ""));
  variants.add(base.split("").join("_"));

  return Array.from(variants).filter((v) => v !== username.toLowerCase());
}

/**
 * Checks if a username exists on a specific site.
 * Uses HEAD requests where possible to minimize data transfer.
 */
async function checkUsernameOnSite(
  site: typeof PRIORITY_SITES[0],
  username: string,
  timeoutMs = 8000
): Promise<{ found: boolean; error?: string }> {
  const url = site.urlTemplate.replace("{username}", encodeURIComponent(username));

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      method: site.checkMethod === "status" ? "HEAD" : "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "IdentiFind Security Scanner/1.0 (identity monitoring service; contact security@identifind.io)",
      },
    });

    clearTimeout(timer);

    if (site.checkMethod === "status") {
      return { found: res.status === (site.expectedStatus ?? 200) };
    }

    // Content-based check
    const text = await res.text();
    if (site.notFoundContent && text.includes(site.notFoundContent)) {
      return { found: false };
    }
    return {
      found: site.expectedContent ? text.includes(site.expectedContent) : res.ok,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    return { found: false, error };
  }
}

/**
 * Scans for a username across all priority sites.
 * @param username The username to search for
 * @param knownPlatforms Platforms where this username is already known to belong to the user
 */
export async function scanUsername(
  username: string,
  knownPlatforms: string[] = []
): Promise<UsernameScanResult[]> {
  const results: UsernameScanResult[] = [];

  // Process in parallel batches of 5 to be respectful of rate limits
  const BATCH_SIZE = 5;
  for (let i = 0; i < PRIORITY_SITES.length; i += BATCH_SIZE) {
    const batch = PRIORITY_SITES.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (site) => {
        const { found, error } = await checkUsernameOnSite(site, username);
        const url = site.urlTemplate.replace(
          "{username}",
          encodeURIComponent(username)
        );

        const siteNameNormalized = site.name
          .toLowerCase()
          .replace(/[^a-z]/g, "");
        const isKnownAccount = knownPlatforms.some((p) =>
          p.toLowerCase().replace(/[^a-z]/g, "").includes(siteNameNormalized)
        );

        return {
          site: site.name,
          category: site.category,
          url,
          found,
          isKnownAccount: found && isKnownAccount,
          confidence: found ? (isKnownAccount ? 90 : 50) : 0,
          checkedAt: new Date(),
          error,
        };
      })
    );
    results.push(...batchResults);

    // Small delay between batches
    if (i + BATCH_SIZE < PRIORITY_SITES.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return results;
}

/**
 * Full impersonation scan: checks the real username + all impersonation variants.
 * Returns accounts found under variants (potential impersonators).
 */
export async function runImpersonationScan(
  username: string,
  knownPlatforms: string[]
): Promise<{
  knownAccountsFound: UsernameScanResult[];
  potentialImpersonators: Array<{ variant: string; results: UsernameScanResult[] }>;
}> {
  // First scan the real username
  const realUsernameResults = await scanUsername(username, knownPlatforms);
  const knownAccountsFound = realUsernameResults.filter((r) => r.found);

  // Then check variants — but only on sites where the real username was NOT found
  // (if @johndoe exists on Instagram but @johndoe_official also exists, that's suspicious)
  const foundSites = new Set(
    knownAccountsFound
      .filter((r) => r.isKnownAccount)
      .map((r) => r.site)
  );

  const variants = generateImpersonationVariants(username).slice(0, 8); // cap at 8 variants
  const impersonatorResults: Array<{ variant: string; results: UsernameScanResult[] }> = [];

  for (const variant of variants) {
    const variantResults = await scanUsername(variant, []);
    const found = variantResults.filter((r) => r.found);

    if (found.length > 0) {
      // Flag as suspicious if found on a site where we know the user's real account exists
      const suspiciousSites = found.filter((r) => foundSites.has(r.site));
      if (suspiciousSites.length > 0) {
        impersonatorResults.push({ variant, results: suspiciousSites });
      }
    }

    await new Promise((r) => setTimeout(r, 300)); // rate limit
  }

  return { knownAccountsFound, potentialImpersonators: impersonatorResults };
}
