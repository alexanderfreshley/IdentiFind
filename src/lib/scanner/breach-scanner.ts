/**
 * Breach Data Scanner for IdentiFind.
 *
 * Queries multiple licensed breach intelligence APIs:
 *   1. Have I Been Pwned (HIBP) — email breach lookup
 *   2. DeHashed — email + username breach lookup with hash data
 *   3. Leak-Lookup — email + username breach lookup
 *   4. Intelligence X (IntelX) — dark web / paste site search
 *   5. Certificate Transparency (crt.sh) — lookalike domain detection
 *
 * All API calls use only LICENSED data sources. No direct access to
 * criminal forums or sites hosting stolen data is performed.
 *
 * Results are normalized to a common BreachRecord format and confidence-scored.
 */

export interface BreachRecord {
  sourceId: string;         // matches OsintSource.id
  sourceName: string;
  breachName?: string;      // name of the specific breach/dataset
  breachDate?: Date;
  dataClasses: string[];    // e.g. ["Email addresses", "Passwords", "Phone numbers"]
  query: string;            // what was searched (email / username)
  queryType: "email" | "username" | "phone" | "domain" | "ip";
  isPaste?: boolean;        // true if found in a paste site
  isDarkWeb?: boolean;
  passwordExposed?: boolean; // true if password hash/plaintext was in the leak
  confidence: number;       // 0–100
  rawData?: Record<string, unknown>;
}

export interface BreachScanSummary {
  email: string;
  totalBreaches: number;
  passwordExposed: boolean;
  darkWebHits: number;
  earliestBreach?: Date;
  mostRecentBreach?: Date;
  dataClasses: string[];    // unique set across all breaches
  records: BreachRecord[];
}

// ─── HIBP ─────────────────────────────────────────────────────────────────────

interface HibpBreach {
  Name: string;
  Title: string;
  Domain: string;
  BreachDate: string;
  AddedDate: string;
  DataClasses: string[];
  IsSensitive: boolean;
  IsVerified: boolean;
  IsFabricated: boolean;
  IsSpamList: boolean;
}

/**
 * Queries the HIBP API v3 for a given email address.
 * Requires HIBP_API_KEY in environment.
 * Rate limit: 1 request per 1.5 seconds.
 */
export async function queryHibp(email: string): Promise<BreachRecord[]> {
  const apiKey = process.env.HIBP_API_KEY;
  if (!apiKey) {
    console.warn("[HIBP] API key not configured — skipping.");
    return [];
  }

  const res = await fetch(
    `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
    {
      headers: {
        "hibp-api-key": apiKey,
        "User-Agent": "IdentiFind-SecurityScanner/1.0",
      },
    }
  );

  if (res.status === 404) return []; // no breaches found
  if (res.status === 429) {
    throw new Error("HIBP rate limit exceeded. Retry after 1.5 seconds.");
  }
  if (!res.ok) {
    throw new Error(`HIBP API error: ${res.status} ${res.statusText}`);
  }

  const breaches: HibpBreach[] = await res.json();

  return breaches
    .filter((b) => b.IsVerified && !b.IsFabricated && !b.IsSpamList)
    .map((b) => ({
      sourceId: "hibp",
      sourceName: "Have I Been Pwned",
      breachName: b.Title,
      breachDate: new Date(b.BreachDate),
      dataClasses: b.DataClasses,
      query: email,
      queryType: "email" as const,
      isPaste: false,
      isDarkWeb: false,
      passwordExposed: b.DataClasses.some((d) =>
        ["Passwords", "Password hints"].includes(d)
      ),
      confidence: 95,  // HIBP is highly reliable
      rawData: { hibpName: b.Name, domain: b.Domain, isSensitive: b.IsSensitive },
    }));
}

// ─── HIBP Paste check ─────────────────────────────────────────────────────────

interface HibpPaste {
  Source: string;
  Id: string;
  Date: string | null;
  EmailCount: number;
}

export async function queryHibpPastes(email: string): Promise<BreachRecord[]> {
  const apiKey = process.env.HIBP_API_KEY;
  if (!apiKey) return [];

  const res = await fetch(
    `https://haveibeenpwned.com/api/v3/pasteaccount/${encodeURIComponent(email)}`,
    {
      headers: {
        "hibp-api-key": apiKey,
        "User-Agent": "IdentiFind-SecurityScanner/1.0",
      },
    }
  );

  if (res.status === 404) return [];
  if (!res.ok) return [];

  const pastes: HibpPaste[] = await res.json();
  return pastes.map((p) => ({
    sourceId: "hibp",
    sourceName: "Have I Been Pwned (Pastes)",
    breachName: `Paste: ${p.Source}`,
    breachDate: p.Date ? new Date(p.Date) : undefined,
    dataClasses: ["Email addresses"],
    query: email,
    queryType: "email" as const,
    isPaste: true,
    isDarkWeb: false,
    passwordExposed: false,
    confidence: 80,
    rawData: { source: p.Source, id: p.Id, emailCount: p.EmailCount },
  }));
}

// ─── DeHashed ─────────────────────────────────────────────────────────────────

interface DeHashedEntry {
  id: string;
  email?: string;
  username?: string;
  name?: string;
  hashed_password?: string;
  database_name?: string;
  obtained_from?: string;
}

interface DeHashedResponse {
  balance: number;
  entries: DeHashedEntry[] | null;
  success: boolean;
  took: string;
  total: number;
}

export async function queryDeHashed(
  query: string,
  queryType: "email" | "username"
): Promise<BreachRecord[]> {
  const apiKey = process.env.DEHASHED_API_KEY;
  const apiEmail = process.env.DEHASHED_API_EMAIL;

  if (!apiKey || !apiEmail) {
    console.warn("[DeHashed] Credentials not configured — skipping.");
    return [];
  }

  const field = queryType === "email" ? "email" : "username";
  const params = new URLSearchParams({ query: `${field}:"${query}"` });

  const res = await fetch(
    `https://api.dehashed.com/search?${params}`,
    {
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${apiEmail}:${apiKey}`).toString("base64"),
        Accept: "application/json",
      },
    }
  );

  if (!res.ok) {
    throw new Error(`DeHashed API error: ${res.status} ${res.statusText}`);
  }

  const data: DeHashedResponse = await res.json();
  if (!data.success || !data.entries) return [];

  // Group by database_name
  const byDatabase = new Map<string, DeHashedEntry[]>();
  for (const entry of data.entries) {
    const db = entry.database_name || "Unknown Database";
    if (!byDatabase.has(db)) byDatabase.set(db, []);
    byDatabase.get(db)!.push(entry);
  }

  return Array.from(byDatabase.entries()).map(([dbName, entries]) => {
    const hasPassword = entries.some((e) => !!e.hashed_password);
    const dataClasses: string[] = ["Email addresses"];
    if (hasPassword) dataClasses.push("Passwords (hashed)");
    if (entries.some((e) => e.name)) dataClasses.push("Names");
    if (entries.some((e) => e.username)) dataClasses.push("Usernames");

    return {
      sourceId: "dehashed",
      sourceName: "DeHashed",
      breachName: dbName,
      dataClasses,
      query,
      queryType,
      isPaste: false,
      isDarkWeb: true,  // DeHashed indexes dark web / underground sources
      passwordExposed: hasPassword,
      confidence: 85,
      rawData: { total: data.total, entriesInDb: entries.length },
    };
  });
}

// ─── Leak-Lookup ──────────────────────────────────────────────────────────────

interface LeakLookupResponse {
  success: boolean;
  found: number;
  sources?: Record<string, number>;
}

export async function queryLeakLookup(email: string): Promise<BreachRecord[]> {
  const apiKey = process.env.LEAKLOOKUP_API_KEY;
  if (!apiKey) {
    console.warn("[Leak-Lookup] API key not configured — skipping.");
    return [];
  }

  const res = await fetch("https://leak-lookup.com/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      key: apiKey,
      type: "email_address",
      query: email,
    }),
  });

  if (!res.ok) return [];

  const data: LeakLookupResponse = await res.json();
  if (!data.success || !data.found || !data.sources) return [];

  return Object.entries(data.sources).map(([source, count]) => ({
    sourceId: "leaklookup",
    sourceName: "Leak-Lookup",
    breachName: source,
    dataClasses: ["Email addresses"],
    query: email,
    queryType: "email" as const,
    isPaste: false,
    isDarkWeb: false,
    passwordExposed: false,
    confidence: 75,
    rawData: { count },
  }));
}

// ─── Intelligence X ───────────────────────────────────────────────────────────

interface IntelXSearchResponse {
  id: string;  // search job ID
  status: number;
}

interface IntelXResultResponse {
  status: number;
  records: Array<{
    systemid: string;
    storageid: string;
    name: string;
    date: string;
    bucket: string;
    type: number;
    media: number;
    added: string;
    tags: string[];
  }>;
}

/**
 * Queries Intelligence X for mentions of an email/username on dark web and paste sites.
 * Uses the two-step search API: initiate → poll → retrieve results.
 */
export async function queryIntelX(
  query: string,
  queryType: "email" | "username"
): Promise<BreachRecord[]> {
  const apiKey = process.env.INTELX_API_KEY;
  if (!apiKey) {
    console.warn("[IntelX] API key not configured — skipping.");
    return [];
  }

  const base =
    process.env.INTELX_API_BASE || "https://2.intelx.io";

  try {
    // Step 1: Start search
    const searchRes = await fetch(`${base}/intelligent/search`, {
      method: "POST",
      headers: {
        "x-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        term: query,
        maxresults: 20,
        media: 0,     // all media types
        target: 0,    // all targets (includes darknet, pastes, social)
        timeout: 20,
        sort: 4,      // sort by date descending
        termtype: queryType === "email" ? 1 : 0,
      }),
    });

    if (!searchRes.ok) return [];
    const { id }: IntelXSearchResponse = await searchRes.json();

    // Step 2: Poll for results (with timeout)
    await new Promise((r) => setTimeout(r, 3000));
    const resultRes = await fetch(
      `${base}/intelligent/search/result?id=${id}&limit=20&offset=0`,
      { headers: { "x-key": apiKey } }
    );

    if (!resultRes.ok) return [];
    const results: IntelXResultResponse = await resultRes.json();

    if (!results.records?.length) return [];

    // Group by bucket type (darknet vs paste vs other)
    const bucketMap = new Map<string, typeof results.records>();
    for (const record of results.records) {
      const bucket = record.bucket || "unknown";
      if (!bucketMap.has(bucket)) bucketMap.set(bucket, []);
      bucketMap.get(bucket)!.push(record);
    }

    return Array.from(bucketMap.entries()).map(([bucket, records]) => {
      const isDarkNet = ["darknet", "tor", "i2p"].includes(
        bucket.toLowerCase()
      );
      const isPaste = bucket.toLowerCase().includes("paste");

      const latestDate = records
        .map((r) => new Date(r.date))
        .filter((d) => !isNaN(d.getTime()))
        .sort((a, b) => b.getTime() - a.getTime())[0];

      return {
        sourceId: "intelx",
        sourceName: "Intelligence X",
        breachName: `${bucket} (${records.length} result${records.length > 1 ? "s" : ""})`,
        breachDate: latestDate,
        dataClasses: ["Email addresses"],
        query,
        queryType,
        isPaste,
        isDarkWeb: isDarkNet,
        passwordExposed: false,
        confidence: isDarkNet ? 70 : 60,  // dark web hits are higher confidence
        rawData: {
          bucket,
          count: records.length,
          sampleNames: records.slice(0, 3).map((r) => r.name),
        },
      };
    });
  } catch (err) {
    console.error("[IntelX] Query failed:", err);
    return [];
  }
}

// ─── Certificate Transparency (lookalike domains) ─────────────────────────────

interface CrtShRecord {
  issuer_ca_id: number;
  issuer_name: string;
  common_name: string;
  name_value: string;
  id: number;
  entry_timestamp: string;
  not_before: string;
  not_after: string;
}

/**
 * Searches crt.sh for TLS certificates issued to domains containing the
 * user's name/brand — a reliable signal of lookalike/phishing domains.
 */
export async function queryLookalikeDomains(
  name: string
): Promise<BreachRecord[]> {
  try {
    const res = await fetch(
      `https://crt.sh/?q=%25${encodeURIComponent(name)}%25&output=json`,
      {
        headers: { Accept: "application/json" },
      }
    );

    if (!res.ok) return [];
    const records: CrtShRecord[] = await res.json();

    // Filter to recent certs (last 90 days) and remove known-good domains
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const suspicious = records
      .filter((r) => new Date(r.entry_timestamp) > cutoff)
      .filter(
        (r) =>
          !r.common_name.startsWith("*.") &&
          r.name_value.toLowerCase().includes(name.toLowerCase())
      )
      .slice(0, 10);

    if (!suspicious.length) return [];

    return suspicious.map((r) => ({
      sourceId: "cert_transparency",
      sourceName: "Certificate Transparency (crt.sh)",
      breachName: `Lookalike domain: ${r.common_name}`,
      breachDate: new Date(r.entry_timestamp),
      dataClasses: ["Domain names"],
      query: name,
      queryType: "domain" as const,
      isPaste: false,
      isDarkWeb: false,
      passwordExposed: false,
      // Confidence based on how closely the domain matches
      confidence: r.common_name.includes(name) ? 65 : 40,
      rawData: {
        commonName: r.common_name,
        issuer: r.issuer_name,
        notBefore: r.not_before,
        notAfter: r.not_after,
      },
    }));
  } catch {
    return [];
  }
}
