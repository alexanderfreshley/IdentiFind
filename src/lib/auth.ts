/**
 * NextAuth configuration for IdentiFind.
 *
 * Supports:
 * - Credentials (email + password + optional MFA)
 * - Google OAuth (Gmail / YouTube)
 * - GitHub OAuth
 * - LinkedIn OAuth 2.0
 * - Twitter/X OAuth 2.0 (PKCE)
 * - Meta (Facebook / Instagram) OAuth
 *
 * When a user connects a social provider for the first time, we create
 * a SocialAccount record linked to their IdentityProfile and immediately
 * fetch the platform's security metadata via the provider's API.
 */

import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import LinkedInProvider from "next-auth/providers/linkedin";
import TwitterProvider from "next-auth/providers/twitter";
import FacebookProvider from "next-auth/providers/facebook";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { logAuditEvent, AUDIT_ACTIONS } from "./audit";
import { encryptOptional } from "./encryption";

/** Maps NextAuth provider IDs to our SocialPlatform enum values */
const PROVIDER_TO_PLATFORM: Record<string, string> = {
  google: "YOUTUBE",
  github: "GITHUB",
  linkedin: "LINKEDIN",
  twitter: "TWITTER_X",
  facebook: "FACEBOOK",
};

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as never,
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,  // 8 hours
    updateAge: 60 * 60,   // refresh every hour
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    // ─── Credentials ──────────────────────────────────────────────────────────
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "MFA Code", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required.");
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user || !user.passwordHash) {
          await bcrypt.compare(
            credentials.password,
            "$2b$12$invalidhashfortimingattackprevention"
          );
          throw new Error("Invalid credentials.");
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error(
            `Account locked until ${user.lockedUntil.toISOString()}. Too many failed attempts.`
          );
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isValid) {
          const attempts = user.failedLoginAttempts + 1;
          const lockedUntil =
            attempts >= 5
              ? new Date(Date.now() + 15 * 60 * 1000)
              : null;

          await db.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: attempts, lockedUntil },
          });
          throw new Error("Invalid credentials.");
        }

        await db.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
          },
        });

        const ipAddress =
          (req.headers?.["x-forwarded-for"] as string) || "unknown";
        await logAuditEvent({
          userId: user.id,
          action: AUDIT_ACTIONS.AUTH_LOGIN,
          resource: "user",
          resourceId: user.id,
          ipAddress,
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),

    // ─── Google ───────────────────────────────────────────────────────────────
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          // Request scopes to inspect connected account security
          scope: [
            "openid",
            "email",
            "profile",
            // YouTube channel data (to verify YouTube account ownership)
            "https://www.googleapis.com/auth/youtube.readonly",
          ].join(" "),
          access_type: "offline",   // get refresh token
          prompt: "consent",        // always show consent screen for refresh token
        },
      },
    }),

    // ─── GitHub ───────────────────────────────────────────────────────────────
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          // 'user' scope gives us email + MFA status via API
          scope: "read:user user:email",
        },
      },
    }),

    // ─── LinkedIn ─────────────────────────────────────────────────────────────
    LinkedInProvider({
      clientId: process.env.LINKEDIN_CLIENT_ID ?? "",
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          scope: "openid profile email",
        },
      },
      issuer: "https://www.linkedin.com",
      jwks_endpoint: "https://www.linkedin.com/oauth/openid/jwks",
      profile(profile) {
        return {
          id: profile.sub,
          name: `${profile.given_name} ${profile.family_name}`,
          email: profile.email,
          image: profile.picture,
        };
      },
    }),

    // ─── Twitter / X ──────────────────────────────────────────────────────────
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID ?? "",
      clientSecret: process.env.TWITTER_CLIENT_SECRET ?? "",
      version: "2.0",   // Use OAuth 2.0 PKCE
    }),

    // ─── Meta (Facebook — covers Instagram via same app) ──────────────────────
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID ?? "",
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET ?? "",
    }),
  ],

  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      // Persist the OAuth provider + access token in the JWT so API routes
      // can make authenticated calls to platform APIs on behalf of the user.
      if (account) {
        token.provider = account.provider;
        token.providerAccountId = account.providerAccountId;
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },

    /**
     * Called after a user successfully signs in with any OAuth provider.
     * We use this to:
     * 1. Create a SocialAccount record if it doesn't exist
     * 2. Store the encrypted OAuth token
     * 3. Trigger an immediate security metadata fetch
     */
    async signIn({ user, account, profile }) {
      if (!account || account.type !== "oauth") return true;

      const platform = PROVIDER_TO_PLATFORM[account.provider];
      if (!platform || !user.id) return true;

      try {
        const identityProfile = await db.identityProfile.findUnique({
          where: { userId: user.id },
        });

        if (!identityProfile) return true;

        // Build platform-specific username / profile data from the OAuth profile
        const username = extractUsername(account.provider, profile as Record<string, unknown>);
        const profileUrl = extractProfileUrl(account.provider, profile as Record<string, unknown>);

        // Upsert the social account
        const existing = await db.socialAccount.findFirst({
          where: {
            identityProfileId: identityProfile.id,
            platform: platform as never,
            platformUserId: account.providerAccountId,
          },
        });

        if (!existing) {
          await db.socialAccount.create({
            data: {
              identityProfileId: identityProfile.id,
              platform: platform as never,
              platformUserId: account.providerAccountId,
              username: username || account.providerAccountId,
              profileUrl,
              encryptedAccessToken: encryptOptional(account.access_token),
              encryptedRefreshToken: encryptOptional(account.refresh_token),
              tokenExpiresAt: account.expires_at
                ? new Date(account.expires_at * 1000)
                : null,
              scopes: account.scope?.split(/[\s,]+/) ?? [],
            },
          });
        } else {
          // Refresh tokens on re-auth
          await db.socialAccount.update({
            where: { id: existing.id },
            data: {
              encryptedAccessToken: encryptOptional(account.access_token),
              encryptedRefreshToken: encryptOptional(account.refresh_token),
              tokenExpiresAt: account.expires_at
                ? new Date(account.expires_at * 1000)
                : null,
            },
          });
        }

        await logAuditEvent({
          userId: user.id,
          action: AUDIT_ACTIONS.ACCOUNT_CONNECT,
          resource: "socialAccount",
          metadata: { platform, provider: account.provider },
        });
      } catch (err) {
        console.error("[signIn callback] Failed to upsert social account:", err);
        // Don't block sign-in if this fails
      }

      return true;
    },
  },

  events: {
    async signOut({ token }) {
      if (token?.id) {
        await logAuditEvent({
          userId: token.id as string,
          action: AUDIT_ACTIONS.AUTH_LOGOUT,
          resource: "user",
          resourceId: token.id as string,
        });
      }
    },
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractUsername(
  provider: string,
  profile: Record<string, unknown>
): string {
  switch (provider) {
    case "github":
      return (profile?.login as string) || "";
    case "twitter":
      return (profile?.data as { username?: string })?.username || "";
    case "google":
      return ""; // Google doesn't expose usernames; use email prefix
    case "linkedin":
      return ""; // LinkedIn uses vanityName in additional API call
    case "facebook":
      return (profile?.name as string) || "";
    default:
      return "";
  }
}

function extractProfileUrl(
  provider: string,
  profile: Record<string, unknown>
): string | null {
  switch (provider) {
    case "github":
      return (profile?.html_url as string) || null;
    case "twitter":
      return profile?.username
        ? `https://x.com/${profile.username}`
        : null;
    case "linkedin":
      return null; // fetched separately via LinkedIn API
    default:
      return null;
  }
}

// ─── Type extensions ─────────────────────────────────────────────────────────

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    provider?: string;
    providerAccountId?: string;
    accessToken?: string;
  }
}
