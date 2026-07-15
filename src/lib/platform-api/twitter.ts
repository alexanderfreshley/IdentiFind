/**
 * Twitter/X API v2 client for IdentiFind.
 *
 * Fetches: username, display name, verification badge, account creation date,
 * follower count, and profile URL.
 *
 * Limitation: Twitter does not expose MFA/2FA status via any API endpoint,
 * even for the authenticated user. We surface a "Cannot verify via API" notice.
 *
 * Scopes required: tweet.read users.read
 * Docs: https://developer.twitter.com/en/docs/twitter-api/users/lookup/api-reference/get-users-me
 */

import type { PlatformApiClient, PlatformSecurityData } from "./types";
import { PlatformApiError } from "./types";

interface TwitterUserResponse {
  data: {
    id: string;
    name: string;
    username: string;
    created_at?: string;
    description?: string;
    verified?: boolean;      // legacy verified
    verified_type?: string;  // "blue", "business", "government"
    public_metrics?: {
      followers_count: number;
      following_count: number;
      tweet_count: number;
      listed_count: number;
    };
    profile_image_url?: string;
  };
}

export const twitterClient: PlatformApiClient = {
  async getSecurityData(accessToken: string): Promise<PlatformSecurityData> {
    const res = await fetch(
      "https://api.twitter.com/2/users/me?" +
        new URLSearchParams({
          "user.fields":
            "id,name,username,created_at,verified,verified_type,public_metrics,profile_image_url",
        }),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) {
      throw new PlatformApiError(
        "TWITTER_X",
        res.status,
        `Twitter API error: ${res.status} ${res.statusText}`
      );
    }

    const { data }: TwitterUserResponse = await res.json();

    const isVerified =
      !!data.verified ||
      ["blue", "business", "government"].includes(data.verified_type ?? "");

    return {
      platformUserId: data.id,
      username: data.username,
      displayName: data.name,
      profileUrl: `https://x.com/${data.username}`,
      avatarUrl: data.profile_image_url?.replace("_normal", "_400x400"),
      // Twitter/X does not expose MFA status via API
      mfaEnabled: undefined,
      emailVerified: undefined,
      phoneVerified: undefined,
      accountCreatedAt: data.created_at ? new Date(data.created_at) : undefined,
      followersCount: data.public_metrics?.followers_count,
      isVerifiedBadge: isVerified,
      rawMeta: {
        verifiedType: data.verified_type,
        publicMetrics: data.public_metrics,
        mfaNote:
          "Twitter/X does not expose 2FA status via its API. " +
          "Verify at https://twitter.com/settings/security",
      },
    };
  },
};
