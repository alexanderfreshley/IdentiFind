import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Lock, Smartphone, Activity } from "lucide-react";
import { ChangePasswordForm } from "@/components/settings/ChangePasswordForm";
import { MfaSection } from "@/components/settings/MfaSection";
import { PhoneSection } from "@/components/settings/PhoneSection";

export default async function SettingsSecurityPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      passwordHash: true,
      mfaEnabled: true,
      phoneVerified: true,
      lastLoginAt: true,
      failedLoginAttempts: true,
    },
  });
  if (!user) redirect("/login");

  // Last 5 audit events for this user
  const recentActivity = await db.auditLog.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { action: true, resource: true, createdAt: true, ipAddress: true },
  });

  const ACTION_LABELS: Record<string, string> = {
    AUTH_LOGIN:             "Signed in",
    AUTH_LOGOUT:            "Signed out",
    AUTH_REGISTER:          "Account created",
    ACCOUNT_CONNECT:        "Connected a social account",
    ACCOUNT_DISCONNECT:     "Disconnected a social account",
    FINDING_RESOLVED:       "Resolved a security finding",
    IMPERSONATION_REPORTED: "Reported an impersonation alert",
    PROFILE_VIEW:           "Viewed/updated profile",
    SCAN_RUN:               "Ran identity scan",
  };

  return (
    <div className="space-y-6">

      {/* ── Password ─────────────────────────────────────────────────────── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wide flex items-center gap-2 mb-4">
          <Lock className="h-3.5 w-3.5" />
          {user.passwordHash ? "Change Password" : "Set a Password"}
        </h3>
        {!user.passwordHash && (
          <p className="text-sm text-white/40 mb-4">
            Your account uses OAuth (social login) only. You can optionally add a
            password to enable direct email + password sign-in.
          </p>
        )}
        <ChangePasswordForm hasPassword={!!user.passwordHash} />
      </div>

      {/* ── Two-Factor Authentication ─────────────────────────────────────── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wide flex items-center gap-2 mb-4">
          <Smartphone className="h-3.5 w-3.5" />
          Two-Factor Authentication
        </h3>
        <MfaSection mfaEnabled={user.mfaEnabled} />
      </div>

      {/* ── Phone Number ─────────────────────────────────────────────────── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wide flex items-center gap-2 mb-4">
          <Smartphone className="h-3.5 w-3.5" />
          Phone Number
        </h3>
        <PhoneSection phoneVerified={user.phoneVerified} />
      </div>

      {/* ── Recent Activity ───────────────────────────────────────────────── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wide flex items-center gap-2 mb-4">
          <Activity className="h-3.5 w-3.5" />
          Recent Account Activity
        </h3>

        {recentActivity.length === 0 ? (
          <p className="text-sm text-white/30">No activity recorded yet.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {recentActivity.map((event, i) => (
              <div key={i} className="flex items-center justify-between py-2.5">
                <div>
                  <span className="text-sm text-white/80">
                    {ACTION_LABELS[event.action] ?? event.action}
                  </span>
                  {event.resource && (
                    <span className="text-xs text-white/30 ml-2">({event.resource})</span>
                  )}
                </div>
                <span className="text-xs text-white/30 shrink-0 ml-4">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Login status summary */}
        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-white/30">
          <span>
            Last login:{" "}
            {user.lastLoginAt
              ? new Date(user.lastLoginAt).toLocaleString()
              : "Unknown"}
          </span>
          {user.failedLoginAttempts > 0 && (
            <span className="text-amber-400">
              {user.failedLoginAttempts} failed login attempt{user.failedLoginAttempts !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

    </div>
  );
}
