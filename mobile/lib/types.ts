/**
 * Shared types for the IdentiFind mobile client.
 * Mirrors the types used in the web app's API responses.
 */

export type Severity   = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type FindingType = 'breach' | 'impersonation' | 'lookalike_domain' | 'dark_web';

// ─── Scan / Findings ──────────────────────────────────────────────────────────

export interface SecurityFinding {
  id:          string;
  title:       string;
  description: string;
  severity:    Severity;
  category:    string;
  isResolved:  boolean;
  createdAt:   string;
}

export interface ImpersonationAlert {
  id:                  string;
  platform:            string;
  suspectedUsername:   string;
  suspectedProfileUrl: string | null;
  confidenceScore:     number;
  status:              'PENDING_REVIEW' | 'CONFIRMED' | 'DISMISSED';
  reportedAt:          string;
}

export interface ScanSummary {
  riskScore:           number;
  lastAuditedAt:       string | null;
  findings:            SecurityFinding[];
  impersonations:      ImpersonationAlert[];
}

export interface ScanTriggerResult {
  success:     boolean;
  riskScore:   number;
  completedAt: string;
  summary: {
    breachCount:         number;
    impersonatorCount:   number;
    lookalikeDomainCount:number;
    darkWebHits:         number;
    piiExposureCount:    number;
    totalFindings:       number;
  };
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

export interface SocialAccount {
  id:             string;
  platform:       string;
  username:       string;
  displayName:    string | null;
  profileUrl:     string | null;
  avatarUrl:      string | null;
  mfaEnabled:     boolean | null;
  emailVerified:  boolean | null;
  phoneVerified:  boolean | null;
  isActive:       boolean;
  lastSyncedAt:   string | null;
}

// ─── User / Profile ───────────────────────────────────────────────────────────

export interface UserProfile {
  id:          string;
  name:        string | null;
  email:       string | null;
  image:       string | null;
}

export interface IdentityProfile {
  id:           string;
  displayName:  string | null;
  riskScore:    number;
  lastAuditedAt:string | null;
}
