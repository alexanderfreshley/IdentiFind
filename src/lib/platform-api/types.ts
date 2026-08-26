/**
 * Shared types for platform API clients.
 * Each platform client returns a PlatformSecurityData object
 * which is then persisted to the SocialAccount record.
 */

export interface PlatformSecurityData {
  platformUserId: string;
  username: string;
  displayName?: string;
  profileUrl?: string;
  avatarUrl?: string;
  mfaEnabled?: boolean;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  accountCreatedAt?: Date;
  followersCount?: number;
  isVerifiedBadge?: boolean;
  /** Platform-specific raw metadata — stored as JSON for extensibility */
  rawMeta?: Record<string, unknown>;
}

export interface PlatformApiClient {
  /**
   * Fetches security metadata for the authenticated account.
   * @param accessToken Decrypted OAuth access token
   */
  getSecurityData(accessToken: string): Promise<PlatformSecurityData>;
}

export class PlatformApiError extends Error {
  constructor(
    public readonly platform: string,
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "PlatformApiError";
  }
}
