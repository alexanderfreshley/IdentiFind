/**
 * Platform API registry.
 * Maps SocialPlatform enum values to their API client implementations.
 */

import { githubClient } from "./github";
import { googleClient } from "./google";
import { twitterClient } from "./twitter";
import { linkedinClient } from "./linkedin";
import { metaClient } from "./meta";
import type { PlatformApiClient } from "./types";

export const PLATFORM_CLIENTS: Partial<Record<string, PlatformApiClient>> = {
  GITHUB: githubClient,
  YOUTUBE: googleClient,
  TWITTER_X: twitterClient,
  LINKEDIN: linkedinClient,
  FACEBOOK: metaClient,
  // INSTAGRAM: instagramClient, — requires separate app + review
  // TIKTOK: tiktokClient,       — TikTok uses a non-standard OAuth flow
  // REDDIT: redditClient,       — add via reddit.com/api/v1/me
};

export type { PlatformApiClient, PlatformSecurityData } from "./types";
export { PlatformApiError } from "./types";

/**
 * Syncs a social account's security metadata by calling the platform API.
 * Updates the SocialAccount record in the database.
 */
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";

export async function syncPlatformAccount(socialAccountId: string): Promise<void> {
  const account = await db.socialAccount.findUnique({
    where: { id: socialAccountId },
  });

  if (!account || !account.encryptedAccessToken) {
    throw new Error(`No access token for account ${socialAccountId}`);
  }

  const client = PLATFORM_CLIENTS[account.platform];
  if (!client) {
    throw new Error(`No API client for platform ${account.platform}`);
  }

  const accessToken = decrypt(account.encryptedAccessToken);
  const data = await client.getSecurityData(accessToken);

  await db.socialAccount.update({
    where: { id: socialAccountId },
    data: {
      username: data.username || account.username,
      displayName: data.displayName,
      profileUrl: data.profileUrl,
      avatarUrl: data.avatarUrl,
      mfaEnabled: data.mfaEnabled ?? null,
      emailVerified: data.emailVerified ?? null,
      phoneVerified: data.phoneVerified ?? null,
      accountCreatedAt: data.accountCreatedAt,
      followersCount: data.followersCount,
      isVerifiedBadge: data.isVerifiedBadge ?? false,
      lastSyncedAt: new Date(),
    },
  });
}
