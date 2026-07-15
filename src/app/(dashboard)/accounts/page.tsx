import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLATFORM_CONFIG, type SocialPlatform } from "@/types";
import { AddAccountModal } from "@/components/dashboard/AddAccountModal";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { AccountRowActions } from "@/components/dashboard/AccountRowActions";

export default async function AccountsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const profile = await db.identityProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      socialAccounts: {
        orderBy: { connectedAt: "asc" },
      },
    },
  });

  const connectedPlatforms = new Set(
    profile?.socialAccounts.map((a) => a.platform) ?? []
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Connected Accounts</h1>
        <p className="text-white/40 text-sm mt-0.5">
          Manage your social media accounts. Connect accounts to monitor their security posture.
        </p>
      </div>

      {/* Connected Accounts */}
      {(profile?.socialAccounts?.length ?? 0) > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs text-white/40 font-medium px-4 py-3">Platform</th>
                <th className="text-left text-xs text-white/40 font-medium px-4 py-3">Username</th>
                <th className="text-center text-xs text-white/40 font-medium px-4 py-3">MFA</th>
                <th className="text-center text-xs text-white/40 font-medium px-4 py-3">Email</th>
                <th className="text-center text-xs text-white/40 font-medium px-4 py-3">Phone</th>
                <th className="text-left text-xs text-white/40 font-medium px-4 py-3">Last Synced</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {profile?.socialAccounts.map((account) => {
                const config = PLATFORM_CONFIG[account.platform as SocialPlatform];
                return (
                  <tr key={account.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded"
                          style={{ backgroundColor: config.color + "20", color: config.color }}
                        >
                          {config.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-white">
                      @{account.username}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {account.mfaEnabled === true ? (
                        <CheckCircle className="h-4 w-4 text-green-400 mx-auto" />
                      ) : account.mfaEnabled === false ? (
                        <XCircle className="h-4 w-4 text-red-400 mx-auto" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-white/20 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {account.emailVerified === true ? (
                        <CheckCircle className="h-4 w-4 text-green-400 mx-auto" />
                      ) : account.emailVerified === false ? (
                        <XCircle className="h-4 w-4 text-red-400 mx-auto" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-white/20 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {account.phoneVerified === true ? (
                        <CheckCircle className="h-4 w-4 text-green-400 mx-auto" />
                      ) : account.phoneVerified === false ? (
                        <XCircle className="h-4 w-4 text-red-400 mx-auto" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-white/20 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/30">
                      {account.lastSyncedAt
                        ? new Date(account.lastSyncedAt).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <AccountRowActions
                        accountId={account.id}
                        username={account.username}
                        platform={config.name}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add New Account */}
      <div>
        <h2 className="text-sm font-semibold text-white/70 mb-3">Add a Platform</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(Object.entries(PLATFORM_CONFIG) as [SocialPlatform, typeof PLATFORM_CONFIG[SocialPlatform]][]).map(
            ([platform, config]) => {
              const isConnected = connectedPlatforms.has(platform);
              return (
                <AddAccountModal
                  key={platform}
                  platform={platform}
                  config={config}
                  isConnected={isConnected}
                  profileId={profile?.id ?? ""}
                />
              );
            }
          )}
        </div>
      </div>
    </div>
  );
}
