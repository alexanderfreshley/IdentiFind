import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shield, AlertTriangle, Link2, TrendingDown } from "lucide-react";
import { RiskScoreMeter } from "@/components/dashboard/RiskScoreMeter";
import { SecurityFindingsList } from "@/components/dashboard/SecurityFindingsList";
import { ConnectedAccountsList } from "@/components/dashboard/ConnectedAccountsList";
import { ScanTriggerButton } from "@/components/dashboard/alerts/ScanTriggerButton";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const profile = await db.identityProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      socialAccounts: {
        include: {
          securityChecks: {
            orderBy: { checkedAt: "desc" },
            take: 1,
          },
        },
      },
      securityFindings: {
        where: { isResolved: false },
        orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
        take: 5,
      },
      impersonations: {
        where: { status: "PENDING_REVIEW" },
      },
    },
  });

  await logAuditEvent({
    userId: session.user.id,
    action: AUDIT_ACTIONS.PROFILE_VIEW,
    resource: "identityProfile",
    resourceId: profile?.id,
  });

  const stats = {
    totalAccounts: profile?.socialAccounts.length ?? 0,
    criticalFindings: profile?.securityFindings.filter((f) => f.severity === "CRITICAL").length ?? 0,
    highFindings: profile?.securityFindings.filter((f) => f.severity === "HIGH").length ?? 0,
    pendingImpersonations: profile?.impersonations.length ?? 0,
    riskScore: profile?.riskScore ?? 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Security Dashboard</h1>
          <p className="text-white/40 text-sm mt-0.5">
            {profile?.lastAuditedAt
              ? `Last audit: ${new Date(profile.lastAuditedAt).toLocaleDateString()}`
              : "No audit run yet"}
          </p>
        </div>
        <ScanTriggerButton />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Connected Accounts",
            value: stats.totalAccounts,
            icon: Link2,
            color: "text-blue-400",
            bg: "bg-blue-400/10",
            href: "/accounts",
          },
          {
            label: "Critical Issues",
            value: stats.criticalFindings,
            icon: AlertTriangle,
            color: "text-red-400",
            bg: "bg-red-400/10",
            href: "/alerts?tab=breaches",
          },
          {
            label: "High Issues",
            value: stats.highFindings,
            icon: Shield,
            color: "text-amber-400",
            bg: "bg-amber-400/10",
            href: "/alerts?tab=breaches",
          },
          {
            label: "Impersonation Alerts",
            value: stats.pendingImpersonations,
            icon: TrendingDown,
            color: "text-purple-400",
            bg: "bg-purple-400/10",
            href: "/alerts?tab=impersonation",
          },
        ].map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/8 hover:border-white/20 transition-colors group"
          >
            <div className={`${stat.bg} w-9 h-9 rounded-lg flex items-center justify-center mb-3`}>
              <stat.icon className={`h-4.5 w-4.5 ${stat.color}`} />
            </div>
            <div className="text-3xl font-bold text-white group-hover:text-white/90">{stat.value}</div>
            <div className="text-xs text-white/40 mt-0.5">{stat.label}</div>
          </Link>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Risk Score */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-white/70 mb-4">Identity Risk Score</h2>
          <RiskScoreMeter score={stats.riskScore} />
        </div>

        {/* Recent Findings */}
        <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-white/70 mb-4">Open Security Findings</h2>
          <SecurityFindingsList
            findings={profile?.securityFindings ?? []}
          />
        </div>
      </div>

      {/* Connected Accounts */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/70">Connected Accounts</h2>
          <a href="/accounts" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
            Manage →
          </a>
        </div>
        <ConnectedAccountsList accounts={profile?.socialAccounts ?? []} />
      </div>
    </div>
  );
}
