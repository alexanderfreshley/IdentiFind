/**
 * Audit logging for IdentiFind.
 *
 * Every access to sensitive PII and security-related action must be logged.
 * Logs are immutable — no update or delete operations on AuditLog records.
 */

import { db } from "./db";
import { encryptOptional } from "./encryption";

interface AuditEventParams {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Records an audit event. IP addresses are encrypted at rest.
 * This function is fire-and-forget — errors are logged but not thrown.
 */
export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        ipAddress: encryptOptional(params.ipAddress),
        userAgent: params.userAgent,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  } catch (error) {
    // Audit logging failures must never break the main flow, but should be
    // surfaced to your monitoring system (e.g., Sentry, Datadog).
    console.error("[AUDIT] Failed to write audit log:", error);
  }
}

// Predefined action constants for consistency
export const AUDIT_ACTIONS = {
  // Auth
  AUTH_LOGIN: "AUTH_LOGIN",
  AUTH_LOGOUT: "AUTH_LOGOUT",
  AUTH_REGISTER: "AUTH_REGISTER",
  AUTH_PASSWORD_CHANGE: "AUTH_PASSWORD_CHANGE",
  AUTH_MFA_ENABLED: "AUTH_MFA_ENABLED",
  AUTH_MFA_DISABLED: "AUTH_MFA_DISABLED",

  // Accounts
  ACCOUNT_CONNECT: "ACCOUNT_CONNECT",
  ACCOUNT_DISCONNECT: "ACCOUNT_DISCONNECT",
  ACCOUNT_SYNC: "ACCOUNT_SYNC",
  ACCOUNT_TOKEN_REFRESH: "ACCOUNT_TOKEN_REFRESH",

  // PII Access
  PII_ACCESS: "PII_ACCESS",
  PROFILE_VIEW: "PROFILE_VIEW",
  PROFILE_UPDATE: "PROFILE_UPDATE",

  // Security
  SECURITY_AUDIT_RUN: "SECURITY_AUDIT_RUN",
  IMPERSONATION_REPORTED: "IMPERSONATION_REPORTED",
  FINDING_RESOLVED: "FINDING_RESOLVED",

  // Admin
  ADMIN_USER_VIEW: "ADMIN_USER_VIEW",
  ADMIN_DATA_EXPORT: "ADMIN_DATA_EXPORT",
} as const;
