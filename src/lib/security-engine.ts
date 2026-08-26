/**
 * Security Audit Engine for IdentiFind.
 *
 * Runs security checks against connected social accounts and produces:
 * - Per-account SecurityCheck records
 * - Aggregated SecurityFindings on the IdentityProfile
 * - An updated risk score (0-100)
 */

import { db } from "./db";
import type { SecurityCheckResult } from "@/types";

type CheckStatus = "PASS" | "FAIL" | "WARNING" | "UNKNOWN";
type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

// ─── Risk Scoring ────────────────────────────────────────────────────────────

const SEVERITY_WEIGHTS: Record<Severity, number> = {
  LOW: 5,
  MEDIUM: 15,
  HIGH: 30,
  CRITICAL: 50,
};

/**
 * Calculates a risk score (0–100) from a list of failed/warning checks.
 */
export function calculateRiskScore(checks: SecurityCheckResult[]): number {
  const failedChecks = checks.filter(
    (c) => c.status === "FAIL" || c.status === "WARNING"
  );

  if (failedChecks.length === 0) return 0;

  const totalWeight = failedChecks.reduce(
    (sum, c) => sum + SEVERITY_WEIGHTS[c.severity],
    0
  );

  // Normalize to 0-100 (cap at 100)
  return Math.min(100, totalWeight);
}

// ─── Check Templates ─────────────────────────────────────────────────────────

/**
 * Evaluates a social account's stored security snapshot and returns a list
 * of check results. This is the "offline" path — the account data was already
 * fetched from the platform and stored in the DB.
 */
export function evaluateSocialAccountChecks(account: {
  platform: string;
  mfaEnabled: boolean | null;
  emailVerified: boolean | null;
  phoneVerified: boolean | null;
  username: string;
  accountCreatedAt: Date | null;
}): SecurityCheckResult[] {
  const results: SecurityCheckResult[] = [];

  // MFA check
  results.push({
    checkType: "MFA_ENABLED",
    status: account.mfaEnabled === true ? "PASS" : account.mfaEnabled === false ? "FAIL" : "UNKNOWN",
    severity: "CRITICAL",
    details:
      account.mfaEnabled === false
        ? `Two-factor authentication is not enabled on your ${account.platform} account.`
        : undefined,
    remediationUrl: getPlatformSecurityUrl(account.platform as never),
  });

  // Email verification check
  results.push({
    checkType: "EMAIL_VERIFIED",
    status: account.emailVerified === true ? "PASS" : account.emailVerified === false ? "FAIL" : "UNKNOWN",
    severity: "HIGH",
    details:
      account.emailVerified === false
        ? `Email address is not verified on your ${account.platform} account.`
        : undefined,
  });

  // Phone verification check
  results.push({
    checkType: "PHONE_VERIFIED",
    status: account.phoneVerified === true ? "PASS" : account.phoneVerified === false ? "WARNING" : "UNKNOWN",
    severity: "MEDIUM",
    details:
      account.phoneVerified === false
        ? `Phone number is not verified on your ${account.platform} account. This reduces account recovery options.`
        : undefined,
  });

  // Account age check (accounts < 30 days old are flagged for verification)
  if (account.accountCreatedAt) {
    const ageInDays =
      (Date.now() - account.accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
    results.push({
      checkType: "ACCOUNT_AGE",
      status: ageInDays >= 30 ? "PASS" : "WARNING",
      severity: "LOW",
      details:
        ageInDays < 30
          ? `Account is ${Math.floor(ageInDays)} days old. New accounts should verify their identity promptly.`
          : undefined,
    });
  }

  return results;
}

// ─── Platform Security URLs ───────────────────────────────────────────────────

function getPlatformSecurityUrl(platform: string): string {
  const urls: Record<string, string> = {
    INSTAGRAM: "https://www.instagram.com/accounts/two_factor_authentication/",
    TWITTER_X: "https://twitter.com/settings/security",
    FACEBOOK: "https://www.facebook.com/settings?tab=security",
    LINKEDIN: "https://www.linkedin.com/psettings/two-step-verification",
    GITHUB: "https://github.com/settings/security",
    DISCORD: "https://discord.com/settings/security",
    REDDIT: "https://www.reddit.com/settings/privacy",
    YOUTUBE: "https://myaccount.google.com/security",
    TIKTOK: "https://www.tiktok.com/setting/",
  };
  return urls[platform] || "#";
}

// ─── Impersonation Detection ──────────────────────────────────────────────────

/**
 * Generates search queries to help detect potential impersonators.
 * Actual platform searches must be done via their APIs or manual review.
 */
export function buildImpersonationSearchQueries(
  username: string,
  displayName: string | null
): string[] {
  const queries: string[] = [];

  // Variations on username
  queries.push(username);
  queries.push(`${username}_official`);
  queries.push(`${username}_real`);
  queries.push(`real_${username}`);
  queries.push(username.replace(/[_.-]/g, ""));

  // Display name variations
  if (displayName) {
    const normalized = displayName.toLowerCase().replace(/\s+/g, "");
    queries.push(normalized);
    queries.push(`${normalized}_official`);
  }

  return [...new Set(queries)]; // deduplicate
}

// ─── Full Audit Runner ────────────────────────────────────────────────────────

/**
 * Runs a full security audit for a given identity profile.
 * Updates all SecurityCheck records and the profile's risk score.
 */
export async function runSecurityAudit(identityProfileId: string): Promise<{
  riskScore: number;
  checksRun: number;
  findingsCount: number;
}> {
  const profile = await db.identityProfile.findUnique({
    where: { id: identityProfileId },
    include: { socialAccounts: true },
  });

  if (!profile) {
    throw new Error(`Identity profile not found: ${identityProfileId}`);
  }

  let allChecks: SecurityCheckResult[] = [];
  let checksRun = 0;

  for (const account of profile.socialAccounts) {
    if (!account.isActive) continue;

    const checks = evaluateSocialAccountChecks({
      platform: account.platform,
      mfaEnabled: account.mfaEnabled,
      emailVerified: account.emailVerified,
      phoneVerified: account.phoneVerified,
      username: account.username,
      accountCreatedAt: account.accountCreatedAt,
    });

    // Persist checks to DB
    for (const check of checks) {
      await db.securityCheck.create({
        data: {
          socialAccountId: account.id,
          checkType: check.checkType as never,
          status: check.status as never,
          severity: check.severity as never,
          details: check.details,
          remediationUrl: check.remediationUrl,
        },
      });
    }

    allChecks = allChecks.concat(checks);
    checksRun += checks.length;
  }

  const riskScore = calculateRiskScore(allChecks);
  const findingsCount = allChecks.filter(
    (c) => c.status === "FAIL" || c.status === "WARNING"
  ).length;

  // Update profile risk score and audit timestamp
  await db.identityProfile.update({
    where: { id: identityProfileId },
    data: {
      riskScore,
      lastAuditedAt: new Date(),
    },
  });

  return { riskScore, checksRun, findingsCount };
}
