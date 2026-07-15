import { CheckCircle, XCircle, AlertCircle, Plus } from "lucide-react";
import Link from "next/link";
import { PLATFORM_CONFIG, type SocialPlatform } from "@/types";

interface SocialAccount {
  id: string;
  platform: SocialPlatform;
  username: string;
  displayName?: string | null;
  isActive: boolean;
  lastSyncedAt?: Date | null;
  mfaEnabled?: boolean | null;
  emailVerified?: boolean | null;
}

interface ConnectedAccountsListProps {
  accounts: SocialAccount[];
}

function SecurityIndicator({ enabled }: { enabled: boolean | null | undefined }) {
  if (enabled === true) return <CheckCircle className="h-3.5 w-3.5 text-green-400" />;
  if (enabled === false) return <XCircle className="h-3.5 w-3.5 text-red-400" />;
  return <AlertCircle className="h-3.5 w-3.5 text-white/20" />;
}

export function ConnectedAccountsList({ accounts }: ConnectedAccountsListProps) {
  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <p className="text-sm font-medium text-white/60">No accounts connected</p>
        <p className="text-xs text-white/30 mt-1 mb-4">
          Connect your social media accounts to start monitoring.
        </p>
        <Link
          href="/accounts"
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          Connect Account
        </Link>
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {accounts.map((account) => {
        const config = PLATFORM_CONFIG[account.platform];
        return (
          <div
            key={account.id}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 flex items-center gap-3"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ backgroundColor: config.color + "20", color: config.color }}
            >
              {config.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">@{account.username}</div>
              <div className="text-xs text-white/40">{config.name}</div>
            </div>
            <div className="flex flex-col gap-1 items-end shrink-0">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-white/30">MFA</span>
                <SecurityIndicator enabled={account.mfaEnabled} />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-white/30">Email</span>
                <SecurityIndicator enabled={account.emailVerified} />
              </div>
            </div>
          </div>
        );
      })}

      {/* Add account card */}
      <Link
        href="/accounts"
        className="border-2 border-dashed border-white/10 hover:border-blue-500/40 rounded-lg px-4 py-3 flex items-center gap-3 text-white/30 hover:text-blue-400 transition-colors"
      >
        <Plus className="h-5 w-5" />
        <span className="text-sm font-medium">Add Account</span>
      </Link>
    </div>
  );
}
