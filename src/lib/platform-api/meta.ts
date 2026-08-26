/**
 * Meta (Facebook / Instagram) API client for IdentiFind.
 *
 * Uses the Meta Graph API to fetch user profile data.
 * Note: Meta does not expose 2FA status or phone verification via the
 * Graph API for end-user applications (only Business/Enterprise tools).
 *
 * Scopes required: public_profile, email
 * Instagram Basic Display API requires separate app configuration.
 *
 * Docs: https://developers.facebook.com/docs/graph-api/reference/user/
 */

import type { PlatformApiClient, PlatformSecurityData } from "./types";
import { PlatformApiError } from "./types";

interface MetaUserResponse {
  id: string;
  name: string;
  email?: string;
  picture?: {
    data: {
      url: string;
      is_silhouette: boolean;
    };
  };
  verified?: boolean;   // Facebook email verification status
}

export const metaClient: PlatformApiClient = {
  async getSecurityData(accessToken: string): Promise<PlatformSecurityData> {
    const params = new URLSearchParams({
      fields: "id,name,email,picture,verified",
      access_token: accessToken,
    });

    const res = await fetch(
      `https://graph.facebook.com/v20.0/me?${params}`
    );

    if (!res.ok) {
      throw new PlatformApiError(
        "FACEBOOK",
        res.status,
        `Meta Graph API error: ${res.status} ${res.statusText}`
      );
    }

    const user: MetaUserResponse = await res.json();

    return {
      platformUserId: user.id,
      username: user.name.toLowerCase().replace(/\s+/g, "."),
      displayName: user.name,
      profileUrl: `https://www.facebook.com/${user.id}`,
      avatarUrl:
        !user.picture?.data.is_silhouette
          ? user.picture?.data.url
          : undefined,
      // `verified` on the Graph API means the user's email is confirmed
      emailVerified: user.verified,
      mfaEnabled: undefined, // Not exposed via Graph API
      phoneVerified: undefined,
      isVerifiedBadge: false,
      rawMeta: {
        email: user.email,
        emailVerified: user.verified,
        mfaNote:
          "Meta does not expose 2FA status via the Graph API for consumer apps. " +
          "Verify at https://www.facebook.com/settings?tab=security",
        instagramNote:
          "Instagram security data requires a separate Instagram Basic Display API integration.",
      },
    };
  },
};
