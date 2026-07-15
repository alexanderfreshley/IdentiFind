/**
 * Scan Orchestrator for IdentiFind.
 *
 * Coordinates all OSINT scanners for a given identity profile:
 *   1. PII broker scan (Pipl, PDL, Whitepages, FullContact, Hunter, Spokeo, BeenVerified)
 *   2. Breach database queries (HIBP, DeHashed, Leak-Lookup, IntelX)
 *   3. Username / impersonation scan across 15+ sites
 *   4. Certificate transparency for lookalike domains
 *   5. Scores and deduplicates all findings
 *   6. Persists results to the database
 */

import crypto from "crypto";
import { db } from "@/lib/db";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit";
import {
  queryHibp,
  queryHibpPastes,
  queryDeHashed,
  queryLeakLookup,
  queryIntelX,
  queryLookalikeDomains,
} from "./breach-scanner";
import { runImpersonationScan } from "./username-scanner";
import {
  scoreBreachRecords,
  scoreImpersonationResults,
  scoreLookalikeDomains,
  mergeAndDeduplicateFindings,
  type ScoredFinding,
} from "./confidence-scorer";
import { runPiiScan, scorePiiFindings } from "./pii-scanner";

// ─── Site name → SocialPlatform enum mapping ─────────────────────────────────
// The username scanner uses human-readable site names; the DB expects enum values.

const SITE_TO_PLATFORM: Record<string, string | null> = {
  "Instagram": "INSTAGRAM",
  "Twitter/X": "TWITTER_X",
  "Facebook": "FACEBOOK",
  "LinkedIn": "LINKEDIN",
  "TikTok": "TIKTOK",
  "YouTube": "YOUTUBE",
  "GitHub": "GITHUB",
  "Reddit": "REDDIT",
  "Discord": "DISCORD",
  // Sites with no matching SocialPlatform enum — stored as SecurityFindings instead
  "Pinterest": null,
  "Twitch": null,
  "Steam": null,
  "Telegram": null,
  "Mastodon (mastodon.social)": null,
  "Substack": null,
  "Medium": null,
  "Keybase": null,
};

function mapSiteToPlatform(siteName: string): string | null {
  return SITE_TO_PLATFORM[siteName] ?? null;
}

/** Stable 25-char ID for upsert — avoids collisions from string truncation */
function alertId(profileId: string, platform: string, variant: string): string {
  return crypto
    .createHash("sha256")
    .update(`${profileId}|${platform}|${variant}`)
    .digest("hex")
    .slice(0, 25);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScanResult {
  profileId: string;
  userId: string;
  findings: ScoredFinding[];
  breachCount: number;
  impersonatorCount: number;
  lookalikeDomainCount: number;
  darkWebHits: number;
  piiExposureCount: number;
  riskScore: number;
  completedAt: Date;
}

// ─── Main scan ────────────────────────────────────────────────────────────────

export async function runFullScan(
  identityProfileId: string,
  userId: string
): Promise<ScanResult> {
  const profile = await db.identityProfile.findUnique({
    where: { id: identityProfileId },
    include: {
      user: { select: { email: true, name: true } },
      socialAccounts: { where: { isActive: true } },
    },
  });

  if (!profile) throw new Error(`Profile not found: ${identityProfileId}`);

  const userEmail = profile.user.email ?? "";
  const userName = profile.user.name ?? profile.displayName ?? "";
  const socialAccounts = profile.socialAccounts;
  const allUsernames = [
    ...new Set(socialAccounts.map((a) => a.username).filter(Boolean)),
  ];
  const displayNames = [
    ...new Set(
      socialAccounts
        .map((a) => a.displayName)
        .filter(Boolean) as string[]
    ),
  ];

  await logAuditEvent({
    userId,
    action: AUDIT_ACTIONS.SECURITY_AUDIT_RUN,
    resource: "identityProfile",
    resourceId: identityProfileId,
    metadata: { phase: "START" },
  });

  const allFindings: ScoredFinding[][] = [];

  // ─── Phase 1: PII broker scan ───────────────────────────────────────────────
  if (userEmail) {
    try {
      const piiSummary = await runPiiScan(userEmail, userName || undefined);
      const piiFindings = scorePiiFindings(piiSummary);

      // Convert to ScoredFinding format for consistent handling
      for (const f of piiFindings) {
        allFindings.push([
          {
            type: "breach" as const,
            title: f.title,
            description: f.description,
            confidence: 85,
            tier: "HIGH",
            severity: f.severity,
            sources: ["pipl", "pdl", "whitepages", "fullcontact"],
            corroborationCount: piiSummary.sourcesWithHits,
            data: {
              category: f.category,
              isPii: true,
              currentAddressExposed: piiSummary.currentAddressExposed,
              pastAddressCount: piiSummary.pastAddressCount,
              phonesExposed: piiSummary.phonesExposed,
            },
            recommendedAction:
              "Submit opt-out requests to data broker sites. " +
              "Consider using a service like DeleteMe, Kanary, or Privacy Bee.",
          },
        ]);
      }
    } catch (err) {
      console.error("[Scan] PII broker scan error:", err);
    }
  }

  // ─── Phase 2: Breach data ───────────────────────────────────────────────────
  if (userEmail) {
    try {
      const [hibpBreaches, hibpPastes, dehashedEmail, leakLookupResults, intelXEmail] =
        await Promise.allSettled([
          queryHibp(userEmail),
          queryHibpPastes(userEmail),
          queryDeHashed(userEmail, "email"),
          queryLeakLookup(userEmail),
          queryIntelX(userEmail, "email"),
        ]);

      const breachRecords = [
        ...(hibpBreaches.status === "fulfilled" ? hibpBreaches.value : []),
        ...(hibpPastes.status === "fulfilled" ? hibpPastes.value : []),
        ...(dehashedEmail.status === "fulfilled" ? dehashedEmail.value : []),
        ...(leakLookupResults.status === "fulfilled" ? leakLookupResults.value : []),
        ...(intelXEmail.status === "fulfilled" ? intelXEmail.value : []),
      ];

      if (breachRecords.length > 0) {
        allFindings.push(scoreBreachRecords(breachRecords));
      }
    } catch (err) {
      console.error("[Scan] Breach data phase error:", err);
    }
  }

  // ─── Phase 3: Username breach scans ────────────────────────────────────────
  for (const username of allUsernames) {
    try {
      const [dehashedUser, intelXUser] = await Promise.allSettled([
        queryDeHashed(username, "username"),
        queryIntelX(username, "username"),
      ]);

      const records = [
        ...(dehashedUser.status === "fulfilled" ? dehashedUser.value : []),
        ...(intelXUser.status === "fulfilled" ? intelXUser.value : []),
      ];
      if (records.length > 0) allFindings.push(scoreBreachRecords(records));
    } catch (err) {
      console.error(`[Scan] Username breach scan error for ${username}:`, err);
    }
  }

  // ─── Phase 4: Impersonation scan ────────────────────────────────────────────
  // Cap at 2 usernames and use a per-username timeout to prevent indefinite hangs.
  const usernamesToScan = allUsernames.slice(0, 2);

  for (const username of usernamesToScan) {
    try {
      const knownPlatforms = socialAccounts.map((a) => a.platform);

      // Wrap with a 90-second timeout per username
      const scanPromise = runImpersonationScan(username, knownPlatforms);
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Username scan timeout")), 90_000)
      );

      const { potentialImpersonators } = await Promise.race([
        scanPromise,
        timeout,
      ]);

      for (const { variant, results } of potentialImpersonators) {
        const scored = scoreImpersonationResults(variant, results);
        if (scored.length > 0) allFindings.push(scored);
      }
    } catch (err) {
      // Timeout or individual failure — log and continue
      console.warn(`[Scan] Impersonation scan for "${username}":`, err instanceof Error ? err.message : err);
    }
  }

  // ─── Phase 5: Lookalike domain detection ───────────────────────────────────
  const namesToCheck = [
    ...allUsernames,
    ...displayNames.map((n) => n.toLowerCase().replace(/\s+/g, "")),
  ];

  for (const name of [...new Set(namesToCheck)].slice(0, 3)) {
    try {
      const domains = await queryLookalikeDomains(name);
      if (domains.length > 0) {
        allFindings.push(scoreLookalikeDomains(domains));
      }
    } catch (err) {
      console.error(`[Scan] Domain scan error for ${name}:`, err);
    }
  }

  // ─── Phase 6: Score and deduplicate ─────────────────────────────────────────
  const findings = mergeAndDeduplicateFindings(allFindings);

  // ─── Phase 7: Persist to database ───────────────────────────────────────────
  await persistFindings(identityProfileId, findings);

  const result: ScanResult = {
    profileId: identityProfileId,
    userId,
    findings,
    breachCount: findings.filter((f) => f.type === "breach").length,
    impersonatorCount: findings.filter((f) => f.type === "impersonation").length,
    lookalikeDomainCount: findings.filter((f) => f.type === "lookalike_domain").length,
    darkWebHits: findings.filter((f) => f.type === "dark_web").length,
    piiExposureCount: findings.filter(
      (f) => f.type === "breach" && f.data.isPii === true
    ).length,
    riskScore: computeOverallRiskScore(findings),
    completedAt: new Date(),
  };

  await db.identityProfile.update({
    where: { id: identityProfileId },
    data: { riskScore: result.riskScore, lastAuditedAt: result.completedAt },
  });

  await logAuditEvent({
    userId,
    action: AUDIT_ACTIONS.SECURITY_AUDIT_RUN,
    resource: "identityProfile",
    resourceId: identityProfileId,
    metadata: {
      phase: "COMPLETE",
      findingsCount: findings.length,
      riskScore: result.riskScore,
    },
  });

  return result;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function persistFindings(
  identityProfileId: string,
  findings: ScoredFinding[]
): Promise<void> {
  // Clear existing unresolved findings
  await db.securityFinding.deleteMany({
    where: { identityProfileId, isResolved: false },
  });

  const impersonationFindings = findings.filter((f) => f.type === "impersonation");
  const otherFindings = findings.filter((f) => f.type !== "impersonation");

  // ── Impersonation alerts ──────────────────────────────────────────────────
  for (const finding of impersonationFindings) {
    const siteName = (finding.data.platform as string) || "";
    const variant = (finding.data.variant as string) || "";
    const url = (finding.data.url as string) || "";

    const platformEnum = mapSiteToPlatform(siteName);

    if (platformEnum) {
      // Store as ImpersonationAlert for known platforms
      const id = alertId(identityProfileId, platformEnum, variant);
      try {
        await db.impersonationAlert.upsert({
          where: { id },
          create: {
            id,
            identityProfileId,
            platform: platformEnum as never,
            suspectedUsername: variant,
            suspectedProfileUrl: url || null,
            confidenceScore: finding.confidence,
            status: "PENDING_REVIEW",
          },
          update: {
            confidenceScore: finding.confidence,
            status: "PENDING_REVIEW",
          },
        });
      } catch (err) {
        console.error(`[persistFindings] ImpersonationAlert upsert failed for ${platformEnum}/${variant}:`, err);
      }
    } else {
      // Fall back to SecurityFinding for sites with no platform enum
      try {
        await db.securityFinding.create({
          data: {
            identityProfileId,
            title: finding.title,
            description: finding.description,
            severity: finding.severity as never,
            category: "IMPERSONATION" as never,
          },
        });
      } catch (err) {
        console.error(`[persistFindings] SecurityFinding create failed for ${siteName}:`, err);
      }
    }
  }

  // ── All other findings ────────────────────────────────────────────────────
  for (const finding of otherFindings) {
    try {
      await db.securityFinding.create({
        data: {
          identityProfileId,
          title: finding.title,
          description: finding.description,
          severity: finding.severity as never,
          category: mapTypeToCategory(finding) as never,
        },
      });
    } catch (err) {
      console.error(`[persistFindings] SecurityFinding create failed for "${finding.title}":`, err);
    }
  }
}

function mapTypeToCategory(finding: ScoredFinding): string {
  // PII findings carry an explicit category in their data
  if (finding.data.category) return finding.data.category as string;

  switch (finding.type) {
    case "breach":
      return "DATA_EXPOSURE";
    case "dark_web":
      return "DATA_EXPOSURE";
    case "lookalike_domain":
      return "IMPERSONATION";
    default:
      return "SUSPICIOUS_ACTIVITY";
  }
}

function computeOverallRiskScore(findings: ScoredFinding[]): number {
  if (findings.length === 0) return 0;

  const SEVERITY_POINTS: Record<string, number> = {
    CRITICAL: 40,
    HIGH: 25,
    MEDIUM: 15,
    LOW: 5,
  };

  let score = 0;
  for (const f of findings) {
    const base = SEVERITY_POINTS[f.severity] ?? 5;
    score += base * (f.confidence / 100);
  }

  return Math.min(100, Math.round(score));
}
