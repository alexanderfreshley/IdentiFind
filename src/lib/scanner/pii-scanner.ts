/**
 * PII Broker Scanner for IdentiFind.
 *
 * Queries multiple people-intelligence and data broker APIs to surface
 * publicly exposed Personally Identifiable Information (PII) associated
 * with a user's email address or name — including home addresses, past
 * addresses, phone numbers, relatives, and professional history.
 *
 * Sources (all via licensed APIs — no scraping):
 *   1. Pipl             — comprehensive people intelligence
 *   2. PeopleDataLabs   — 3B+ person records, strong on addresses/employment
 *   3. Whitepages Pro   — consumer address & phone lookup
 *   4. FullContact      — social + professional profile enrichment
 *   5. Hunter.io        — email + associated person data
 *   6. Spokeo Partner   — address & relatives (partner API)
 *   7. BeenVerified     — public records aggregator (partner API)
 *
 * All queries use only the authenticated user's own data (email, name from
 * their IdentiFind profile). Results surface what's already public, so users
 * know what bad actors can find about them.
 */

export interface PiiAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  /** ISO date string or year range string */
  firstSeen?: string;
  lastSeen?: string;
  isCurrent?: boolean;
}

export interface PiiRecord {
  sourceId: string;
  sourceName: string;
  query: string;
  queryType: "email" | "name" | "phone";

  // Identity
  fullName?: string;
  age?: number;
  ageRange?: string;
  gender?: string;

  // Addresses
  currentAddress?: PiiAddress;
  pastAddresses?: PiiAddress[];

  // Contact
  phones?: string[];
  emails?: string[];

  // Relatives & associates
  relatives?: string[];
  associates?: string[];

  // Professional
  employer?: string;
  jobTitle?: string;
  education?: string[];

  // Social profiles found
  socialProfiles?: Record<string, string>; // platform → URL

  confidence: number;
  rawData?: Record<string, unknown>;
}

export interface PiiScanSummary {
  totalSourcesQueried: number;
  sourcesWithHits: number;
  currentAddressExposed: boolean;
  pastAddressCount: number;
  phonesExposed: number;
  relativesExposed: string[];
  socialProfilesFound: Record<string, string>;
  records: PiiRecord[];
}

// ─── Pipl ─────────────────────────────────────────────────────────────────────

interface PiplPerson {
  names?: Array<{ display?: string }>;
  emails?: Array<{ address?: string }>;
  phones?: Array<{ display?: string }>;
  addresses?: Array<{
    display?: string;
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    "@valid_since"?: string;
    "@last_seen"?: string;
    "@current"?: boolean;
  }>;
  relationships?: Array<{ names?: Array<{ display?: string }> }>;
  jobs?: Array<{ display?: string; title?: string; organization?: string }>;
  educations?: Array<{ display?: string }>;
  user_ids?: Array<{ content?: string }>;
  urls?: Array<{ url?: string; "@domain"?: string }>;
  dob?: { display?: string };
  gender?: { content?: string };
}

interface PiplResponse {
  person?: PiplPerson;
  possible_persons?: PiplPerson[];
  "@http_status_code": number;
  error?: string;
  warnings?: string[];
}

export async function queryPipl(
  email: string,
  name?: string
): Promise<PiiRecord[]> {
  const apiKey = process.env.PIPL_API_KEY;
  if (!apiKey) {
    console.warn("[Pipl] API key not configured — skipping.");
    return [];
  }

  try {
    const params = new URLSearchParams({ key: apiKey, pretty: "false" });
    const searchFields: Record<string, unknown>[] = [];

    if (email) searchFields.push({ "@type": "EmailAddress", "address": email });
    if (name) {
      const parts = name.trim().split(" ");
      if (parts.length >= 2) {
        searchFields.push({
          "@type": "Name",
          "first": parts[0],
          "last": parts[parts.length - 1],
        });
      }
    }

    const body = JSON.stringify({ person: { "@fields": searchFields } });

    const res = await fetch(`https://api.pipl.com/search/?${params}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return [];
    const data: PiplResponse = await res.json();

    const person = data.person ?? data.possible_persons?.[0];
    if (!person) return [];

    const addresses = person.addresses ?? [];
    const currentAddr = addresses.find((a) => a["@current"]);
    const pastAddrs = addresses.filter((a) => !a["@current"]);

    const socialProfiles: Record<string, string> = {};
    for (const u of person.urls ?? []) {
      if (u["@domain"] && u.url) {
        socialProfiles[u["@domain"]] = u.url;
      }
    }

    return [
      {
        sourceId: "pipl",
        sourceName: "Pipl",
        query: email,
        queryType: "email",
        fullName: person.names?.[0]?.display,
        age: person.dob?.display
          ? new Date().getFullYear() -
            new Date(person.dob.display).getFullYear()
          : undefined,
        gender: person.gender?.content,
        currentAddress: currentAddr
          ? {
              street: currentAddr.street,
              city: currentAddr.city,
              state: currentAddr.state,
              zip: currentAddr.zip,
              country: currentAddr.country,
              isCurrent: true,
              lastSeen: currentAddr["@last_seen"],
            }
          : undefined,
        pastAddresses: pastAddrs.map((a) => ({
          street: a.street,
          city: a.city,
          state: a.state,
          zip: a.zip,
          country: a.country,
          isCurrent: false,
          firstSeen: a["@valid_since"],
          lastSeen: a["@last_seen"],
        })),
        phones: person.phones
          ?.map((p) => p.display)
          .filter(Boolean) as string[],
        emails: person.emails
          ?.map((e) => e.address)
          .filter(Boolean) as string[],
        relatives: person.relationships?.flatMap(
          (r) => r.names?.map((n) => n.display ?? "") ?? []
        ).filter(Boolean),
        employer: person.jobs?.[0]?.organization,
        jobTitle: person.jobs?.[0]?.title,
        education: person.educations
          ?.map((e) => e.display)
          .filter(Boolean) as string[],
        socialProfiles,
        confidence: 90,
        rawData: { source: "pipl", addressCount: addresses.length },
      },
    ];
  } catch (err) {
    console.error("[Pipl] Query failed:", err);
    return [];
  }
}

// ─── PeopleDataLabs ───────────────────────────────────────────────────────────

interface PdlAddress {
  street_address?: string;
  city?: string;
  region?: string;
  postal_code?: string;
  country?: string;
  first_seen?: string;
  last_seen?: string;
}

interface PdlResponse {
  status: number;
  likelihood?: number;
  data?: {
    full_name?: string;
    first_name?: string;
    last_name?: string;
    age?: number;
    gender?: string;
    emails?: string[];
    phone_numbers?: string[];
    addresses?: PdlAddress[];
    location_names?: string[];
    job_title?: string;
    job_company_name?: string;
    inferred_salary?: string;
    education?: Array<{ school?: { name?: string } }>;
    profiles?: Array<{ url?: string; network?: string }>;
    birth_year?: number;
  };
}

export async function queryPeopleDataLabs(
  email: string
): Promise<PiiRecord[]> {
  const apiKey = process.env.PDL_API_KEY;
  if (!apiKey) {
    console.warn("[PeopleDataLabs] API key not configured — skipping.");
    return [];
  }

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      email,
      pretty: "false",
      min_likelihood: "4",
    });

    const res = await fetch(
      `https://api.peopledatalabs.com/v5/person/enrich?${params}`,
      { signal: AbortSignal.timeout(12000) }
    );

    if (res.status === 404) return [];
    if (!res.ok) return [];

    const data: PdlResponse = await res.json();
    if (!data.data || (data.likelihood ?? 0) < 4) return [];

    const p = data.data;
    const addresses = p.addresses ?? [];
    const currentAddr = addresses[0]; // PDL orders by recency
    const pastAddrs = addresses.slice(1);

    const socialProfiles: Record<string, string> = {};
    for (const profile of p.profiles ?? []) {
      if (profile.network && profile.url) {
        socialProfiles[profile.network] = profile.url;
      }
    }

    return [
      {
        sourceId: "pdl",
        sourceName: "PeopleDataLabs",
        query: email,
        queryType: "email",
        fullName: p.full_name,
        age: p.age,
        gender: p.gender,
        currentAddress: currentAddr
          ? {
              street: currentAddr.street_address,
              city: currentAddr.city,
              state: currentAddr.region,
              zip: currentAddr.postal_code,
              country: currentAddr.country,
              isCurrent: true,
              firstSeen: currentAddr.first_seen,
              lastSeen: currentAddr.last_seen,
            }
          : undefined,
        pastAddresses: pastAddrs.map((a) => ({
          street: a.street_address,
          city: a.city,
          state: a.region,
          zip: a.postal_code,
          country: a.country,
          isCurrent: false,
          firstSeen: a.first_seen,
          lastSeen: a.last_seen,
        })),
        phones: p.phone_numbers,
        emails: p.emails,
        employer: p.job_company_name,
        jobTitle: p.job_title,
        education: p.education
          ?.map((e) => e.school?.name)
          .filter(Boolean) as string[],
        socialProfiles,
        confidence: Math.min(100, (data.likelihood ?? 5) * 15),
        rawData: {
          likelihood: data.likelihood,
          addressCount: addresses.length,
          inferred_salary: p.inferred_salary,
        },
      },
    ];
  } catch (err) {
    console.error("[PeopleDataLabs] Query failed:", err);
    return [];
  }
}

// ─── Whitepages Pro ───────────────────────────────────────────────────────────

interface WhitepagesPerson {
  id?: { key?: string };
  names?: Array<{ first_name?: string; last_name?: string; full_name?: string }>;
  age_range?: string;
  gender?: string;
  current_addresses?: Array<{
    id?: { key?: string };
    street_line_1?: string;
    city?: string;
    state_code?: string;
    postal_code?: string;
    country_code?: string;
    is_active?: boolean;
    delivery_point?: string;
  }>;
  historical_addresses?: Array<{
    street_line_1?: string;
    city?: string;
    state_code?: string;
    postal_code?: string;
    valid_for?: { start?: string; stop?: string };
  }>;
  phones?: Array<{ id?: { key?: string } }>;
  associated_people?: Array<{
    name?: string;
    relation?: string;
  }>;
}

interface WhitepagesResponse {
  results?: WhitepagesPerson[];
  messages?: string[];
  error?: { name?: string; message?: string };
}

export async function queryWhitepages(
  name: string,
  city?: string,
  state?: string
): Promise<PiiRecord[]> {
  const apiKey = process.env.WHITEPAGES_API_KEY;
  if (!apiKey) {
    console.warn("[Whitepages] API key not configured — skipping.");
    return [];
  }

  try {
    const params = new URLSearchParams({ api_key: apiKey, name });
    if (city) params.set("city", city);
    if (state) params.set("state_code", state);

    const res = await fetch(
      `https://proapi.whitepages.com/3.3/person.json?${params}`,
      { signal: AbortSignal.timeout(12000) }
    );

    if (!res.ok) return [];
    const data: WhitepagesResponse = await res.json();
    if (!data.results?.length) return [];

    return data.results.slice(0, 3).map((person) => {
      const currentAddr = person.current_addresses?.[0];
      const pastAddrs = person.historical_addresses ?? [];
      const relatives = person.associated_people
        ?.map((p) => p.name ?? "")
        .filter(Boolean) ?? [];

      return {
        sourceId: "whitepages",
        sourceName: "Whitepages Pro",
        query: name,
        queryType: "name" as const,
        fullName: person.names?.[0]?.full_name,
        ageRange: person.age_range,
        gender: person.gender,
        currentAddress: currentAddr
          ? {
              street: currentAddr.street_line_1,
              city: currentAddr.city,
              state: currentAddr.state_code,
              zip: currentAddr.postal_code,
              country: currentAddr.country_code,
              isCurrent: true,
            }
          : undefined,
        pastAddresses: pastAddrs.map((a) => ({
          street: a.street_line_1,
          city: a.city,
          state: a.state_code,
          zip: a.postal_code,
          isCurrent: false,
          firstSeen: a.valid_for?.start,
          lastSeen: a.valid_for?.stop,
        })),
        relatives,
        confidence: 80,
        rawData: {
          phoneCount: person.phones?.length ?? 0,
          addressCount: (person.current_addresses?.length ?? 0) + pastAddrs.length,
        },
      };
    });
  } catch (err) {
    console.error("[Whitepages] Query failed:", err);
    return [];
  }
}

// ─── FullContact ──────────────────────────────────────────────────────────────

interface FullContactResponse {
  fullName?: string;
  age?: number;
  gender?: string;
  location?: string;
  employment?: Array<{ name?: string; title?: string; current?: boolean }>;
  education?: Array<{ name?: string }>;
  details?: {
    profiles?: Record<string, { url?: string; username?: string }>;
    phones?: Array<{ value?: string }>;
    addresses?: Array<{
      label?: string;
      addressLine1?: string;
      city?: string;
      region?: string;
      postalCode?: string;
      country?: string;
    }>;
    emails?: Array<{ value?: string }>;
  };
}

export async function queryFullContact(email: string): Promise<PiiRecord[]> {
  const apiKey = process.env.FULLCONTACT_API_KEY;
  if (!apiKey) {
    console.warn("[FullContact] API key not configured — skipping.");
    return [];
  }

  try {
    const res = await fetch("https://api.fullcontact.com/v3/person.enrich", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(12000),
    });

    if (res.status === 404) return [];
    if (!res.ok) return [];

    const data: FullContactResponse = await res.json();

    const socialProfiles: Record<string, string> = {};
    for (const [platform, profile] of Object.entries(
      data.details?.profiles ?? {}
    )) {
      if (profile?.url) socialProfiles[platform] = profile.url;
    }

    const addresses = data.details?.addresses ?? [];
    const currentAddr = addresses.find((a) => a.label === "home") ?? addresses[0];
    const pastAddrs = addresses.filter((a) => a !== currentAddr);

    const currentJob = data.employment?.find((e) => e.current);

    return [
      {
        sourceId: "fullcontact",
        sourceName: "FullContact",
        query: email,
        queryType: "email",
        fullName: data.fullName,
        age: data.age,
        gender: data.gender,
        currentAddress: currentAddr
          ? {
              street: currentAddr.addressLine1,
              city: currentAddr.city,
              state: currentAddr.region,
              zip: currentAddr.postalCode,
              country: currentAddr.country,
              isCurrent: true,
            }
          : undefined,
        pastAddresses: pastAddrs.map((a) => ({
          street: a.addressLine1,
          city: a.city,
          state: a.region,
          zip: a.postalCode,
          country: a.country,
          isCurrent: false,
        })),
        phones: data.details?.phones
          ?.map((p) => p.value)
          .filter(Boolean) as string[],
        emails: data.details?.emails
          ?.map((e) => e.value)
          .filter(Boolean) as string[],
        employer: currentJob?.name,
        jobTitle: currentJob?.title,
        education: data.education?.map((e) => e.name ?? "").filter(Boolean),
        socialProfiles,
        confidence: 75,
        rawData: { location: data.location },
      },
    ];
  } catch (err) {
    console.error("[FullContact] Query failed:", err);
    return [];
  }
}

// ─── Hunter.io ────────────────────────────────────────────────────────────────

interface HunterEmailVerifyResponse {
  data?: {
    status?: string;
    score?: number;
    email?: string;
    regexp?: boolean;
    gibberish?: boolean;
    disposable?: boolean;
    webmail?: boolean;
    mx_records?: boolean;
    smtp_server?: boolean;
    smtp_check?: boolean;
    accept_all?: boolean;
    block?: boolean;
    sources?: Array<{
      domain?: string;
      uri?: string;
      extracted_on?: string;
      last_seen_on?: string;
    }>;
  };
}

export async function queryHunter(email: string): Promise<PiiRecord[]> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) {
    console.warn("[Hunter.io] API key not configured — skipping.");
    return [];
  }

  try {
    const params = new URLSearchParams({ email, api_key: apiKey });
    const res = await fetch(
      `https://api.hunter.io/v2/email-verifier?${params}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!res.ok) return [];
    const data: HunterEmailVerifyResponse = await res.json();

    if (!data.data?.sources?.length) return [];

    const sources = data.data.sources;
    const domains = [...new Set(sources.map((s) => s.domain).filter(Boolean))];

    if (domains.length === 0) return [];

    return [
      {
        sourceId: "hunter",
        sourceName: "Hunter.io",
        query: email,
        queryType: "email",
        socialProfiles: Object.fromEntries(
          sources
            .filter((s) => s.uri && s.domain)
            .slice(0, 10)
            .map((s) => [s.domain!, s.uri!])
        ),
        confidence: Math.min(90, (data.data.score ?? 50)),
        rawData: {
          status: data.data.status,
          score: data.data.score,
          sourceCount: sources.length,
          domains,
          webmail: data.data.webmail,
          disposable: data.data.disposable,
        },
      },
    ];
  } catch (err) {
    console.error("[Hunter.io] Query failed:", err);
    return [];
  }
}

// ─── Spokeo (Partner API) ─────────────────────────────────────────────────────

interface SpokeoResponse {
  results?: Array<{
    name?: string;
    age?: number;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    phones?: string[];
    relatives?: string[];
  }>;
}

export async function querySpokeo(
  name: string,
  email?: string
): Promise<PiiRecord[]> {
  const apiKey = process.env.SPOKEO_API_KEY;
  if (!apiKey) {
    console.warn("[Spokeo] API key not configured — skipping.");
    return [];
  }

  try {
    const params = new URLSearchParams({ api_key: apiKey });
    if (email) params.set("email", email);
    else params.set("name", name);

    const res = await fetch(
      `https://api.spokeo.com/residential/v3/search?${params}`,
      { signal: AbortSignal.timeout(12000) }
    );

    if (!res.ok) return [];
    const data: SpokeoResponse = await res.json();
    if (!data.results?.length) return [];

    return data.results.slice(0, 3).map((r) => ({
      sourceId: "spokeo",
      sourceName: "Spokeo",
      query: email ?? name,
      queryType: email ? ("email" as const) : ("name" as const),
      fullName: r.name,
      age: r.age,
      currentAddress: r.address
        ? {
            street: r.address,
            city: r.city,
            state: r.state,
            zip: r.zip,
            isCurrent: true,
          }
        : undefined,
      phones: r.phones,
      relatives: r.relatives,
      confidence: 70,
      rawData: {},
    }));
  } catch (err) {
    console.error("[Spokeo] Query failed:", err);
    return [];
  }
}

// ─── BeenVerified (Reseller API) ─────────────────────────────────────────────

interface BeenVerifiedResponse {
  data?: {
    person?: {
      firstName?: string;
      lastName?: string;
      age?: number;
      addresses?: Array<{
        streetLine1?: string;
        city?: string;
        state?: string;
        zip?: string;
        startDate?: string;
        endDate?: string;
        isCurrent?: boolean;
      }>;
      phones?: Array<{ number?: string }>;
      relatives?: Array<{ name?: string }>;
    };
  };
}

export async function queryBeenVerified(email: string): Promise<PiiRecord[]> {
  const apiKey = process.env.BEENVERIFIED_API_KEY;
  if (!apiKey) {
    console.warn("[BeenVerified] API key not configured — skipping.");
    return [];
  }

  try {
    const res = await fetch(
      `https://api.beenverified.com/v2/search/email?email=${encodeURIComponent(email)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(12000),
      }
    );

    if (!res.ok) return [];
    const data: BeenVerifiedResponse = await res.json();
    const person = data.data?.person;
    if (!person) return [];

    const currentAddr = person.addresses?.find((a) => a.isCurrent);
    const pastAddrs = (person.addresses ?? []).filter((a) => !a.isCurrent);

    return [
      {
        sourceId: "beenverified",
        sourceName: "BeenVerified",
        query: email,
        queryType: "email",
        fullName:
          person.firstName && person.lastName
            ? `${person.firstName} ${person.lastName}`
            : undefined,
        age: person.age,
        currentAddress: currentAddr
          ? {
              street: currentAddr.streetLine1,
              city: currentAddr.city,
              state: currentAddr.state,
              zip: currentAddr.zip,
              isCurrent: true,
              firstSeen: currentAddr.startDate,
              lastSeen: currentAddr.endDate,
            }
          : undefined,
        pastAddresses: pastAddrs.map((a) => ({
          street: a.streetLine1,
          city: a.city,
          state: a.state,
          zip: a.zip,
          isCurrent: false,
          firstSeen: a.startDate,
          lastSeen: a.endDate,
        })),
        phones: person.phones
          ?.map((p) => p.number)
          .filter(Boolean) as string[],
        relatives: person.relatives
          ?.map((r) => r.name)
          .filter(Boolean) as string[],
        confidence: 80,
        rawData: {},
      },
    ];
  } catch (err) {
    console.error("[BeenVerified] Query failed:", err);
    return [];
  }
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * Runs all configured PII broker scans in parallel.
 * Sources that don't have API keys configured are silently skipped.
 */
export async function runPiiScan(
  email: string,
  name?: string
): Promise<PiiScanSummary> {
  const [
    piplResults,
    pdlResults,
    whitepagesResults,
    fullContactResults,
    hunterResults,
    spokeoResults,
    beenVerifiedResults,
  ] = await Promise.allSettled([
    queryPipl(email, name),
    queryPeopleDataLabs(email),
    name ? queryWhitepages(name) : Promise.resolve([]),
    queryFullContact(email),
    queryHunter(email),
    name ? querySpokeo(name, email) : Promise.resolve([]),
    queryBeenVerified(email),
  ]);

  const allRecords: PiiRecord[] = [
    ...(piplResults.status === "fulfilled" ? piplResults.value : []),
    ...(pdlResults.status === "fulfilled" ? pdlResults.value : []),
    ...(whitepagesResults.status === "fulfilled" ? whitepagesResults.value : []),
    ...(fullContactResults.status === "fulfilled" ? fullContactResults.value : []),
    ...(hunterResults.status === "fulfilled" ? hunterResults.value : []),
    ...(spokeoResults.status === "fulfilled" ? spokeoResults.value : []),
    ...(beenVerifiedResults.status === "fulfilled" ? beenVerifiedResults.value : []),
  ];

  const sourcesWithHits = allRecords.length;

  const allCurrentAddresses = allRecords
    .map((r) => r.currentAddress)
    .filter(Boolean) as PiiAddress[];

  const allPastAddresses = allRecords.flatMap(
    (r) => r.pastAddresses ?? []
  );

  const allPhones = [
    ...new Set(allRecords.flatMap((r) => r.phones ?? [])),
  ];

  const allRelatives = [
    ...new Set(allRecords.flatMap((r) => r.relatives ?? [])),
  ];

  const allSocialProfiles = allRecords.reduce(
    (acc, r) => ({ ...acc, ...(r.socialProfiles ?? {}) }),
    {} as Record<string, string>
  );

  return {
    totalSourcesQueried: 7,
    sourcesWithHits,
    currentAddressExposed: allCurrentAddresses.length > 0,
    pastAddressCount: allPastAddresses.length,
    phonesExposed: allPhones.length,
    relativesExposed: allRelatives,
    socialProfilesFound: allSocialProfiles,
    records: allRecords,
  };
}

/**
 * Converts PII scan results into ScoredFindings for the security finding system.
 */
export function scorePiiFindings(
  summary: PiiScanSummary
): Array<{
  title: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: "DATA_EXPOSURE" | "PRIVACY";
}> {
  const findings: Array<{
    title: string;
    description: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    category: "DATA_EXPOSURE" | "PRIVACY";
  }> = [];

  if (summary.currentAddressExposed) {
    const sources = summary.records
      .filter((r) => r.currentAddress)
      .map((r) => r.sourceName)
      .join(", ");

    findings.push({
      title: "Current home address exposed in public databases",
      description:
        `Your current home address is publicly accessible via data broker sites (${sources}). ` +
        `This enables stalking, doxxing, and physical security risks. Consider submitting opt-out ` +
        `requests to each data broker or using a service like DeleteMe or Kanary.`,
      severity: "HIGH",
      category: "PRIVACY",
    });
  }

  if (summary.pastAddressCount > 0) {
    findings.push({
      title: `${summary.pastAddressCount} past home address${summary.pastAddressCount > 1 ? "es" : ""} exposed`,
      description:
        `${summary.pastAddressCount} of your past residential address${summary.pastAddressCount > 1 ? "es are" : " is"} ` +
        `indexed in public people-search databases. Past addresses can be used to social-engineer ` +
        `identity verification systems (e.g., banks that ask for a previous address).`,
      severity: "MEDIUM",
      category: "PRIVACY",
    });
  }

  if (summary.phonesExposed > 0) {
    findings.push({
      title: `${summary.phonesExposed} phone number${summary.phonesExposed > 1 ? "s" : ""} exposed in data broker records`,
      description:
        `${summary.phonesExposed} phone number${summary.phonesExposed > 1 ? "s are" : " is"} publicly linked to your identity ` +
        `in people-search databases. This enables targeted SIM-swap attacks, vishing (voice phishing), ` +
        `and SMS-based fraud.`,
      severity: "MEDIUM",
      category: "DATA_EXPOSURE",
    });
  }

  if (summary.relativesExposed.length > 0) {
    const relativeList = summary.relativesExposed.slice(0, 5).join(", ");
    findings.push({
      title: "Family members and associates exposed in public records",
      description:
        `${summary.relativesExposed.length} people are publicly linked to you as relatives or associates ` +
        `(${relativeList}${summary.relativesExposed.length > 5 ? ", and more" : ""}). ` +
        `Attackers use family member data to answer security questions and build social engineering pretexts.`,
      severity: "LOW",
      category: "PRIVACY",
    });
  }

  if (Object.keys(summary.socialProfilesFound).length > 3) {
    const profileCount = Object.keys(summary.socialProfilesFound).length;
    findings.push({
      title: `${profileCount} social and web profiles aggregated by data brokers`,
      description:
        `Data broker sites have aggregated ${profileCount} online profiles linked to your email address. ` +
        `This creates a detailed digital footprint attackers can use for targeted spear-phishing, ` +
        `impersonation, and account takeover attempts.`,
      severity: "LOW",
      category: "PRIVACY",
    });
  }

  return findings;
}
