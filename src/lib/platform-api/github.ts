/**
 * GitHub API client for IdentiFind.
 *
 * Fetches: username, display name, email verification status, MFA status,
 * account creation date, follower count, and verification badge.
 *
 * GitHub's MFA status is available at GET /user — the `two_factor_authentication`
 * field requires the `read:user` scope.
 *
 * Docs: https://docs.github.com/en/rest/users/users#get-the-authenticated-user
 */

import type { PlatformApiClient, PlatformSecurityData } from "./types";
import { PlatformApiError } from "./types";

const BASE = "https://api.github.com";

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  email: string | null;
  two_factor_authentication: boolean;
  created_at: string;
  followers: number;
  verified?: boolean;    // GitHub doesn't expose this directly; always false
}

interface GitHubEmail {
  email: string;
  verified: boolean;
  primary: boolean;
}

async function ghFetch<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    throw new PlatformApiError(
      "GITHUB",
      res.status,
      `GitHub API error: ${res.status} ${res.statusText}`
    );
  }

  return res.json() as Promise<T>;
}

export const githubClient: PlatformApiClient = {
  async getSecurityData(accessToken: string): Promise<PlatformSecurityData> {
    const [user, emails] = await Promise.all([
      ghFetch<GitHubUser>("/user", accessToken),
      ghFetch<GitHubEmail[]>("/user/emails", accessToken),
    ]);

    const primaryEmail = emails.find((e) => e.primary);

    return {
      platformUserId: String(user.id),
      username: user.login,
      displayName: user.name ?? user.login,
      profileUrl: user.html_url,
      avatarUrl: user.avatar_url,
      // GitHub exposes MFA status directly on the authenticated user endpoint
      mfaEnabled: user.two_factor_authentication,
      emailVerified: primaryEmail?.verified ?? false,
      phoneVerified: undefined, // GitHub does not expose phone verification
      accountCreatedAt: new Date(user.created_at),
      followersCount: user.followers,
      isVerifiedBadge: false,
      rawMeta: {
        email: primaryEmail?.email,
        emailVerified: primaryEmail?.verified,
        mfaEnabled: user.two_factor_authentication,
      },
    };
  },
};
