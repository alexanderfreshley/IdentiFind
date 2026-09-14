/**
 * Shared application-wide types for IdentiFind.
 * These types mirror the Prisma SocialPlatform enum and related structures.
 */

// ─── Social Platform ──────────────────────────────────────────────────────────

export type SocialPlatform =
  | "INSTAGRAM"
  | "TWITTER_X"
  | "FACEBOOK"
  | "LINKEDIN"
  | "TIKTOK"
  | "YOUTUBE"
  | "REDDIT"
  | "GITHUB"
  | "DISCORD";

export interface PlatformConfig {
  name: string;
  color: string;
  securityUrl: string;
  icon?: string;
}

export const PLATFORM_CONFIG: Record<SocialPlatform, PlatformConfig> = {
  INSTAGRAM: {
    name: "Instagram",
    color: "#E1306C",
    securityUrl: "https://www.instagram.com/accounts/privacy_and_security/",
  },
  TWITTER_X: {
    name: "X (Twitter)",
    color: "#1DA1F2",
    securityUrl: "https://twitter.com/settings/security",
  },
  FACEBOOK: {
    name: "Facebook",
    color: "#1877F2",
    securityUrl: "https://www.facebook.com/settings?tab=security",
  },
  LINKEDIN: {
    name: "LinkedIn",
    color: "#0A66C2",
    securityUrl: "https://www.linkedin.com/psettings/two-step-verification",
  },
  TIKTOK: {
    name: "TikTok",
    color: "#010101",
    securityUrl: "https://www.tiktok.com/settings/security",
  },
  YOUTUBE: {
    name: "YouTube",
    color: "#FF0000",
    securityUrl: "https://myaccount.google.com/security",
  },
  REDDIT: {
    name: "Reddit",
    color: "#FF4500",
    securityUrl: "https://www.reddit.com/settings/privacy",
  },
  GITHUB: {
    name: "GitHub",
    color: "#24292F",
    securityUrl: "https://github.com/settings/security",
  },
  DISCORD: {
    name: "Discord",
    color: "#5865F2",
    securityUrl: "https://discord.com/settings/privacy-safety",
  },
};

// ─── Security Check Results ───────────────────────────────────────────────────

export type CheckStatus = "PASS" | "FAIL" | "WARNING" | "UNKNOWN";
export type CheckSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface SecurityCheckResult {
  checkType: string;
  status: CheckStatus;
  severity: CheckSeverity;
  details?: string;
  remediationUrl?: string;
  platform?: string;
}
