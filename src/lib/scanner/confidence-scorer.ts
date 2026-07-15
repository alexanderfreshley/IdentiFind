/**
 * Confidence Scoring Engine for IdentiFind.
 *
 * Assigns a 0–100 confidence score to each scan finding based on:
 *   - Source reliability (HIBP > IntelX > username check)
 *   - Number of corroborating sources
 *   - Recency of the data
 *   - Signal specificity (exact email match > username variation)
 *   - Type of data exposed (password > PII > email-only)
 *
 * Confidence tiers:
 *   90–100 → CONFIRMED   (multiple independent high-reliability sources)
 *   70–89  → HIGH        (single high-reliability source or 2 medium sources)
 *   50–69  → MEDIUM      (one medium source or corroborating signals)
 *   30–49  → LOW         (weak or ambiguous signals)
 *   0–29   → SPECULATIVE (automated pattern match, unverified)
 */

import type { BreachRecord } from "./breach-scanner";
import type { UsernameScanResult } from "./username-scanner";
import { OSINT_SOURCES_BY_ID } from "./osint-sources";

export type ConfidenceTier = "CONFIRMED" | "HIGH" | "MEDIUM" | "LOW" | "SPECULATIVE";

export interface ScoredFinding {
  type: "breach" | "impersonation" | "lookalike_domain" | "dark_web";
  title: string;
  description: string;
  confidence: number;
  tier: ConfidenceTier;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  sources: string[];          // source IDs that contributed
  corroborationCount: number; // number of independent sources confirming
  data: Record<string, unknown>;
  recommendedAction?: string;
}

/** Maps confidence score to tier */
export function scoreToTier(score: number): ConfidenceTier {
  if (score >= 90) return "CONFIRMED";
  if (score >= 70) return "HIGH";
  if (score >= 50) return "MEDIUM";
  if (score >= 30) return "LOW";
  return "SPECULATIVE";
}

/** Base reliability weight per source (1–5 from OsintSource.reliability) */
function sourceWeight(sourceId: string): number {
  const source = OSINT_SOURCES_BY_ID[sourceId];
  return source ? source.reliability * 20 : 50; // 20–100 scale
}

/** Recency bonus: fresher data = higher confidence */
function recencyBonus(date?: Date): number {
  if (!date) return 0;
  const ageDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays < 30) return 15;
  if (ageDays < 180) return 10;
  if (ageDays < 365) return 5;
  return 0;
}

/**
 * Scores a collection of breach records for a single query target.
 * Corroboration across multiple independent sources raises confidence.
 */
export function scoreBreachRecords(records: BreachRecord[]): ScoredFinding[] {
  if (records.length === 0) return [];

  // Group records by breach name
  const byBreach = new Map<string, BreachRecord[]>();
  for (const r of records) {
    const key = r.breachName || r.sourceName;
    if (!byBreach.has(key)) byBreach.set(key, []);
    byBreach.get(key)!.push(r);
  }

  // Also compute cross-source corroboration
  const uniqueSources = new Set(records.map((r) => r.sourceId));

  return Array.from(byBreach.entries()).map(([breachName, recs]) => {
    const primary = recs[0];
    const sources = [...new Set(recs.map((r) => r.sourceId))];

    // Base confidence from source reliability
    let confidence = Math.max(...sources.map(sourceWeight));

    // Corroboration bonus: multiple independent sources add confidence
    if (uniqueSources.size >= 3) confidence = Math.min(100, confidence + 20);
    else if (uniqueSources.size >= 2) confidence = Math.min(100, confidence + 10);

    // Recency bonus
    confidence = Math.min(100, confidence + recencyBonus(primary.breachDate));

    // Password exposure raises severity and confidence
    const passwordExposed = recs.some((r) => r.passwordExposed);
    if (passwordExposed) confidence = Math.min(100, confidence + 10);

    const severity =
      primary.isDarkWeb && passwordExposed
        ? "CRITICAL"
        : primary.isDarkWeb || passwordExposed
        ? "HIGH"
        : primary.isPaste
        ? "MEDIUM"
        : "LOW";

    const dataClasses = [...new Set(recs.flatMap((r) => r.dataClasses))];

    return {
      type: (primary.isPaste ? "breach" : primary.isDarkWeb ? "dark_web" : "breach") as ScoredFinding["type"],
      title: `Data found in breach: ${breachName}`,
      description: `Your ${primary.queryType} was found in "${breachName}". Exposed data includes: ${dataClasses.join(", ")}.${passwordExposed ? " Passwords were exposed — change immediately." : ""}`,
      confidence,
      tier: scoreToTier(confidence),
      severity,
      sources,
      corroborationCount: sources.length,
      data: {
        breachName,
        breachDate: primary.breachDate,
        dataClasses,
        passwordExposed,
        isDarkWeb: primary.isDarkWeb,
        isPaste: primary.isPaste,
        query: primary.query,
        queryType: primary.queryType,
      },
      recommendedAction: passwordExposed
        ? "Change your password on all sites where you use this credential immediately. Enable MFA."
        : primary.isDarkWeb
        ? "Monitor for fraudulent activity. Consider placing a credit freeze."
        : "Be alert for phishing emails targeting this address.",
    };
  });
}

/**
 * Scores username scan results to identify potential impersonators.
 */
export function scoreImpersonationResults(
  variant: string,
  results: UsernameScanResult[]
): ScoredFinding[] {
  const found = results.filter((r) => r.found && !r.isKnownAccount);
  if (found.length === 0) return [];

  return found.map((result) => {
    // Confidence starts at the site check's base confidence
    let confidence = result.confidence;

    // Platform-specific adjustments
    const highValuePlatforms = ["Instagram", "Twitter/X", "LinkedIn", "Facebook", "GitHub"];
    if (highValuePlatforms.includes(result.site)) {
      confidence = Math.min(100, confidence + 15);
    }

    // Variant similarity adjustments (closer to original = higher risk)
    const suspiciousPatterns = ["_official", "_real", "real", "official", "the"];
    const variantLower = variant.toLowerCase();
    if (suspiciousPatterns.some((p) => variantLower.includes(p))) {
      confidence = Math.min(100, confidence + 10);
    }

    return {
      type: "impersonation" as const,
      title: `Possible impersonator on ${result.site}`,
      description: `An account with username "@${variant}" exists on ${result.site}. This may be an impersonator using a variant of your username.`,
      confidence,
      tier: scoreToTier(confidence),
      severity: confidence >= 70 ? "HIGH" : "MEDIUM",
      sources: ["whatsmyname"],
      corroborationCount: 1,
      data: {
        variant,
        platform: result.site,
        url: result.url,
        category: result.category,
      },
      recommendedAction: `Verify whether you own the account at ${result.url}. If not, report it to ${result.site} as impersonation.`,
    };
  });
}

/**
 * Scores certificate transparency (lookalike domain) results.
 */
export function scoreLookalikeDomains(records: BreachRecord[]): ScoredFinding[] {
  return records.map((r) => {
    const domain = (r.rawData?.commonName as string) ?? "";
    let confidence = r.confidence;

    // Active cert (not expired) is more suspicious
    const notAfter = r.rawData?.notAfter as string | undefined;
    if (notAfter && new Date(notAfter) > new Date()) {
      confidence = Math.min(100, confidence + 15);
    }

    return {
      type: "lookalike_domain" as const,
      title: `Lookalike domain detected: ${domain}`,
      description: `A TLS certificate was issued for "${domain}", which closely resembles your identity. This could be used for phishing attacks targeting your contacts or customers.`,
      confidence,
      tier: scoreToTier(confidence),
      severity: "HIGH",
      sources: ["cert_transparency"],
      corroborationCount: 1,
      data: r.rawData ?? {},
      recommendedAction: `Investigate whether you control ${domain}. If not, report to Google Safe Browsing (safebrowsing.google.com/safebrowsing/report_phish/) and the hosting registrar.`,
    };
  });
}

/**
 * Combines all scored findings and deduplicates, prioritizing higher-confidence
 * records when the same breach appears in multiple sources.
 */
export function mergeAndDeduplicateFindings(
  findingSets: ScoredFinding[][]
): ScoredFinding[] {
  const merged = findingSets.flat();

  // Deduplicate by title (same breach from multiple sources → keep highest confidence)
  const byTitle = new Map<string, ScoredFinding>();
  for (const finding of merged) {
    const existing = byTitle.get(finding.title);
    if (!existing || finding.confidence > existing.confidence) {
      byTitle.set(finding.title, {
        ...finding,
        // Merge sources from both entries
        sources: existing
          ? [...new Set([...existing.sources, ...finding.sources])]
          : finding.sources,
        corroborationCount: existing
          ? Math.max(existing.corroborationCount, finding.corroborationCount)
          : finding.corroborationCount,
      });
    }
  }

  // Sort: CRITICAL > HIGH > MEDIUM > LOW, then by confidence descending
  const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  return Array.from(byTitle.values()).sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.confidence - a.confidence;
  });
}
