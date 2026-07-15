/**
 * LinkedIn API client for IdentiFind.
 *
 * Uses the LinkedIn OpenID Connect UserInfo endpoint.
 * LinkedIn's API does not expose MFA or phone verification status.
 *
 * Scopes required: openid profile email
 * Docs: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
 */

import type { PlatformApiClient, PlatformSecurityData } from "./types";
import { PlatformApiError } from "./types";

interface LinkedInUserInfo {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  picture?: string;
  email: string;
  email_verified: boolean;
  locale?: { country: string; language: string };
}

export const linkedinClient: PlatformApiClient = {
  async getSecurityData(accessToken: string): Promise<PlatformSecurityData> {
    const res = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "LinkedIn-Version": "202404",
      },
    });

    if (!res.ok) {
      throw new PlatformApiError(
        "LINKEDIN",
        res.status,
        `LinkedIn API error: ${res.status} ${res.statusText}`
      );
    }

    const info: LinkedInUserInfo = await res.json();

    return {
      platformUserId: info.sub,
      username: info.sub,   // LinkedIn doesn't expose vanity URLs via OpenID
      displayName: info.name,
      profileUrl: `https://www.linkedin.com/in/`,  // cannot get vanity URL without additional scope
      avatarUrl: info.picture,
      emailVerified: info.email_verified,
      mfaEnabled: undefined,   // Not exposed by LinkedIn API
      phoneVerified: undefined,
      isVerifiedBadge: false,
      rawMeta: {
        email: info.email,
        emailVerified: info.email_verified,
        mfaNote:
          "LinkedIn does not expose 2-Step Verification status via its API. " +
          "Verify at https://www.linkedin.com/psettings/two-step-verification",
      },
    };
  },
};
