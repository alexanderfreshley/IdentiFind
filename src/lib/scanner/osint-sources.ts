/**
 * OSINT Source Registry for IdentiFind.
 *
 * Catalogs all data sources used in scanning, their categories, reliability
 * ratings, and API integration notes. Sources drawn from:
 *   - OSINT Framework (osintframework.com)
 *   - Bellingcat Toolkit
 *   - Soxoj's OSINT namecheckers list
 *   - Commercial threat intel platforms
 *
 * Sources are tagged by type so the confidence scorer can weight them
 * appropriately — a confirmed hit on a licensed breach dataset carries
 * more weight than a username availability check on an obscure site.
 */

export type OsintSourceCategory =
  | "username_enum"    // checks if a username exists on a platform
  | "breach_data"      // leaked credential databases
  | "dark_web"         // dark web / paste site monitoring
  | "pii_broker"       // public people-search / data broker sites
  | "social_search"    // searches within social media APIs
  | "domain_intel"     // domain/WHOIS/cert transparency
  | "reputation";      // fraud/abuse scoring

export interface OsintSource {
  id: string;
  name: string;
  url: string;
  category: OsintSourceCategory;
  /** 1–5 reliability rating based on data freshness and false-positive rate */
  reliability: 1 | 2 | 3 | 4 | 5;
  requiresApiKey: boolean;
  envKey?: string;         // env variable name for the API key
  rateLimit?: string;      // e.g. "1req/s", "100req/day"
  notes?: string;
  /** Whether IdentiFind has a built-in API adapter for this source */
  hasAdapter: boolean;
}

export const OSINT_SOURCES: OsintSource[] = [
  // ─── Username Enumeration ─────────────────────────────────────────────────
  {
    id: "whatsmyname",
    name: "WhatsMyName",
    url: "https://whatsmyname.app",
    category: "username_enum",
    reliability: 5,
    requiresApiKey: false,
    rateLimit: "reasonable use",
    notes:
      "Open dataset of 600+ sites. We use the public JSON dataset from " +
      "github.com/WebBreacher/WhatsMyName to check username existence without " +
      "hitting their web UI.",
    hasAdapter: true,
  },
  {
    id: "namechk",
    name: "Namechk",
    url: "https://namechk.com",
    category: "username_enum",
    reliability: 3,
    requiresApiKey: false,
    rateLimit: "web scraping — use sparingly",
    notes: "Checks username availability across social networks and domains.",
    hasAdapter: false,
  },
  {
    id: "usersearch",
    name: "UserSearch.org",
    url: "https://usersearch.org",
    category: "username_enum",
    reliability: 3,
    requiresApiKey: false,
    notes: "Free username search aggregator.",
    hasAdapter: false,
  },

  // ─── Breach Data ──────────────────────────────────────────────────────────
  {
    id: "hibp",
    name: "Have I Been Pwned (HIBP)",
    url: "https://haveibeenpwned.com",
    category: "breach_data",
    reliability: 5,
    requiresApiKey: true,
    envKey: "HIBP_API_KEY",
    rateLimit: "1req/1.5s",
    notes:
      "Industry-standard breach notification service. Checks email addresses " +
      "against 13+ billion records from 700+ breaches. API costs ~$3.50/month.",
    hasAdapter: true,
  },
  {
    id: "dehashed",
    name: "DeHashed",
    url: "https://dehashed.com",
    category: "breach_data",
    reliability: 5,
    requiresApiKey: true,
    envKey: "DEHASHED_API_KEY",
    rateLimit: "varies by plan",
    notes:
      "Searches 15+ billion records by email, username, IP, phone, name, etc. " +
      "Provides hash values; never returns plaintext passwords.",
    hasAdapter: true,
  },
  {
    id: "leaklookup",
    name: "Leak-Lookup",
    url: "https://leak-lookup.com",
    category: "breach_data",
    reliability: 4,
    requiresApiKey: true,
    envKey: "LEAKLOOKUP_API_KEY",
    rateLimit: "plan-dependent",
    notes: "Alternative breach database with username and email search.",
    hasAdapter: true,
  },

  // ─── Dark Web Monitoring ──────────────────────────────────────────────────
  {
    id: "intelx",
    name: "Intelligence X (IntelX)",
    url: "https://intelx.io",
    category: "dark_web",
    reliability: 5,
    requiresApiKey: true,
    envKey: "INTELX_API_KEY",
    rateLimit: "plan-dependent",
    notes:
      "Indexes dark web, Tor, I2P, data leaks, and paste sites. " +
      "Provides licensed access to breach and dark web data. " +
      "Free tier available with limited results.",
    hasAdapter: true,
  },
  {
    id: "spycloud",
    name: "SpyCloud",
    url: "https://spycloud.com",
    category: "dark_web",
    reliability: 5,
    requiresApiKey: true,
    envKey: "SPYCLOUD_API_KEY",
    rateLimit: "enterprise plan",
    notes:
      "Commercial threat intel with recaptured darknet data. " +
      "Monitors for stolen credentials and ATO risk.",
    hasAdapter: false,   // enterprise only; add on request
  },
  {
    id: "darkfail",
    name: "dark.fail (paste monitoring)",
    url: "https://dark.fail",
    category: "dark_web",
    reliability: 3,
    requiresApiKey: false,
    notes: "Directory of active dark web sites. Used for reference, not direct querying.",
    hasAdapter: false,
  },

  // ─── PII / Data Broker ────────────────────────────────────────────────────
  {
    id: "pipl",
    name: "Pipl",
    url: "https://pipl.com",
    category: "pii_broker",
    reliability: 5,
    requiresApiKey: true,
    envKey: "PIPL_API_KEY",
    rateLimit: "plan-dependent",
    notes:
      "Comprehensive people intelligence API. Returns current + past addresses, " +
      "phones, relatives, social profiles, and employment history.",
    hasAdapter: true,
  },
  {
    id: "pdl",
    name: "PeopleDataLabs",
    url: "https://www.peopledatalabs.com",
    category: "pii_broker",
    reliability: 5,
    requiresApiKey: true,
    envKey: "PDL_API_KEY",
    rateLimit: "100 free credits/month",
    notes:
      "3B+ person records database. Excellent address history and employment data. " +
      "Free tier available with 100 API credits/month.",
    hasAdapter: true,
  },
  {
    id: "whitepages",
    name: "Whitepages Pro",
    url: "https://pro.whitepages.com",
    category: "pii_broker",
    reliability: 4,
    requiresApiKey: true,
    envKey: "WHITEPAGES_API_KEY",
    rateLimit: "~$0.10/query",
    notes:
      "Consumer-focused address and phone lookup. Returns current + historical " +
      "addresses, phone numbers, and linked family members.",
    hasAdapter: true,
  },
  {
    id: "fullcontact",
    name: "FullContact",
    url: "https://www.fullcontact.com",
    category: "pii_broker",
    reliability: 4,
    requiresApiKey: true,
    envKey: "FULLCONTACT_API_KEY",
    rateLimit: "plan-dependent; free tier available",
    notes:
      "Social and professional profile enrichment. Given an email, returns " +
      "linked social profiles, employer, location, and education.",
    hasAdapter: true,
  },
  {
    id: "hunter",
    name: "Hunter.io",
    url: "https://hunter.io",
    category: "pii_broker",
    reliability: 4,
    requiresApiKey: true,
    envKey: "HUNTER_API_KEY",
    rateLimit: "25 free searches/month",
    notes:
      "Email intelligence platform. Returns websites and sources where an email " +
      "address appears publicly, and linked professional profiles.",
    hasAdapter: true,
  },
  {
    id: "spokeo",
    name: "Spokeo",
    url: "https://www.spokeo.com",
    category: "pii_broker",
    reliability: 3,
    requiresApiKey: true,
    envKey: "SPOKEO_API_KEY",
    rateLimit: "partner API; query-based pricing",
    notes:
      "Consumer people-search aggregator. Returns address, phone, relatives, " +
      "and social profiles. Requires partner/reseller API access.",
    hasAdapter: true,
  },
  {
    id: "beenverified",
    name: "BeenVerified",
    url: "https://www.beenverified.com",
    category: "pii_broker",
    reliability: 3,
    requiresApiKey: true,
    envKey: "BEENVERIFIED_API_KEY",
    rateLimit: "reseller API; query-based pricing",
    notes:
      "Public records aggregator. Returns addresses, phones, relatives, " +
      "criminal records, and social profiles. Requires reseller partnership.",
    hasAdapter: true,
  },
  {
    id: "intelius",
    name: "Intelius",
    url: "https://intelius.com",
    category: "pii_broker",
    reliability: 3,
    requiresApiKey: false,
    notes: "Public people-search site. No public API — manual lookup reference only.",
    hasAdapter: false,
  },
  {
    id: "peoplesearchnow",
    name: "PeopleSearchNow",
    url: "https://www.peoplesearchnow.com",
    category: "pii_broker",
    reliability: 2,
    requiresApiKey: false,
    notes: "Free people-search aggregator. No public API — manual lookup reference only.",
    hasAdapter: false,
  },

  // ─── Domain Intelligence ──────────────────────────────────────────────────
  {
    id: "cert_transparency",
    name: "Certificate Transparency (crt.sh)",
    url: "https://crt.sh",
    category: "domain_intel",
    reliability: 5,
    requiresApiKey: false,
    rateLimit: "reasonable use",
    notes:
      "Monitors TLS certificate issuances for lookalike/typosquat domains " +
      "that could be used for phishing against the user's identity.",
    hasAdapter: true,
  },
  {
    id: "dnstwist",
    name: "DNSTwist (typosquat detection)",
    url: "https://dnstwist.it",
    category: "domain_intel",
    reliability: 4,
    requiresApiKey: false,
    notes: "Generates typosquat domain variations. Run locally via CLI.",
    hasAdapter: false,
  },
];

export const OSINT_SOURCES_BY_ID = Object.fromEntries(
  OSINT_SOURCES.map((s) => [s.id, s])
);

/** Returns only sources that have a built-in adapter and can be queried */
export const QUERYABLE_SOURCES = OSINT_SOURCES.filter((s) => s.hasAdapter);
