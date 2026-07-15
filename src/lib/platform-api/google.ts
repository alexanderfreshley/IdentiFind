/**
 * Google API client for IdentiFind.
 *
 * Fetches: email verification, account info, and 2-Step Verification status.
 *
 * Note: Google does not expose 2SV status via a public API for end-users.
 * We use the People API and Account Management API to get what is available,
 * and surface a "Cannot verify" indicator for MFA (directing user to check
 * their Google Account security page manually).
 *
 * Scopes required: openid, email, profile
 * Optional: https://www.googleapis.com/auth/userinfo.profile (for full profile)
 *
 * Docs: https://developers.google.com/people/api/rest/v1/people/get
 */

import type { PlatformApiClient, PlatformSecurityData } from "./types";
import { PlatformApiError } from "./types";

interface GoogleTokenInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
  given_name: string;
  family_name: string;
}

export const googleClient: PlatformApiClient = {
  async getSecurityData(accessToken: string): Promise<PlatformSecurityData> {
    const res = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) {
      throw new PlatformApiError(
        "YOUTUBE",
        res.status,
        `Google UserInfo error: ${res.status} ${res.statusText}`
      );
    }

    const info: GoogleTokenInfo = await res.json();

    return {
      platformUserId: info.sub,
      username: info.email.split("@")[0],
      displayName: info.name,
      avatarUrl: info.picture,
      profileUrl: `https://myaccount.google.com/`,
      // Google email_verified is always true for Google accounts that can OAuth
      emailVerified: info.email_verified,
      // Google does not expose 2SV status via API — null signals "unknown"
      mfaEnabled: undefined,
      phoneVerified: undefined,
      isVerifiedBadge: false,
      rawMeta: {
        email: info.email,
        emailVerified: info.email_verified,
        // Remind the UI to show a "check manually" prompt for MFA
        mfaNote:
          "Google does not expose 2-Step Verification status via API. " +
          "Users should verify at https://myaccount.google.com/security",
      },
    };
  },
};
