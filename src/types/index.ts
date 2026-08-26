// ─── Shared TypeScript Types ──────────────────────────────────────────────────

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

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type CheckStatus = "PASS" | "FAIL" | "WARNING" | "UNKNOWN";

export interface SecurityCheckResult {
  checkType: string;
  status: CheckStatus;
  severity: Severity;
  details?: string;
  remediationUrl?: string;
}

export interface SocialAccountSummary {
  id: string;
  platform: SocialPlatform;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  profileUrl?: string | null;
  isActive: boolean;
  lastSyncedAt?: Date | null;
  mfaEnabled?: boolean | null;
  emailVerified?: boolean | null;
  phoneVerified?: boolean | null;
  securityScore: number; // 0-100
}

export interface IdentityProfileSummary {
  id: string;
  displayName?: string | null;
  riskScore: number;
  lastAuditedAt?: Date | null;
  totalAccounts: number;
  criticalFindings: number;
  highFindings: number;
  pendingImpersonations: number;
}

export interface DashboardStats {
  totalAccounts: number;
  securedAccounts: number;
  criticalIssues: number;
  pendingAlerts: number;
  overallRiskScore: number;
  lastAuditedAt?: Date | null;
}

export type PlatformConfig = {
  name: string;
  color: string;
  icon: string;
  oauthEnabled: boolean;
  manualEntryEnabled: boolean;
};

export const PLATFORM_CONFIG: Record<SocialPlatform, PlatformConfig> = {
  INSTAGRAM: {
    name: "Instagram",
    color: "#E1306C",
    icon: "instagram",
    oauthEnabled: true,
    manualEntryEnabled: true,
  },
  TWITTER_X: {
    name: "X (Twitter)",
    color: "#000000",
    icon: "twitter",
    oauthEnabled: true,
    manualEntryEnabled: true,
  },
  FACEBOOK: {
    name: "Facebook",
    color: "#1877F2",
    icon: "facebook",
    oauthEnabled: true,
    manualEntryEnabled: true,
  },
  LINKEDIN: {
    name: "LinkedIn",
    color: "#0A66C2",
    icon: "linkedin",
    oauthEnabled: true,
    manualEntryEnabled: true,
  },
  TIKTOK: {
    name: "TikTok",
    color: "#010101",
    icon: "tiktok",
    oauthEnabled: false,
    manualEntryEnabled: true,
  },
  YOUTUBE: {
    name: "YouTube",
    color: "#FF0000",
    icon: "youtube",
    oauthEnabled: true,
    manualEntryEnabled: true,
  },
  REDDIT: {
    name: "Reddit",
    color: "#FF4500",
    icon: "reddit",
    oauthEnabled: true,
    manualEntryEnabled: true,
  },
  GITHUB: {
    name: "GitHub",
    color: "#24292F",
    icon: "github",
    oauthEnabled: true,
    manualEntryEnabled: true,
  },
  DISCORD: {
    name: "Discord",
    color: "#5865F2",
    icon: "discord",
    oauthEnabled: true,
    manualEntryEnabled: true,
  },
};
