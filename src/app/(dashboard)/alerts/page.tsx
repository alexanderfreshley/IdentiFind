import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AlertTriangle, Search, Globe, Shield, CheckCircle2, ExternalLink } from "lucide-react";
import { ConfidenceBadge } from "@/components/dashboard/alerts/ConfidenceBadge";
import { AlertActionMenu } from "@/components/dashboard/alerts/AlertActionMenu";
import { ImpersonationActions } from "@/components/dashboard/alerts/ImpersonationActions";
import { ScanTriggerButton } from "@/components/dashboard/alerts/ScanTriggerButton";
import { PLATFORM_CONFIG, type SocialPlatform } from "@/types";

type AlertTab = "all" | "breaches" | "impersonation" | "domains";

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: AlertTab; scan?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const { tab, scan } = await searchParams;
  const activeTab: AlertTab = tab ?? "all";

  const profile = await db.identityProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      securityFindings: {
        where: { isResolved: false },
        orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
      },
      impersonations: {
        orderBy: [{ confidenceScore: "desc" }, { reportedAt: "desc" }],
      },
    },
  });

  const findings = profile?.securityFindings ?? [];
  const impersonations = profile?.impersonations ?? [];

  const breachFindings = findings.filter((f) =>
    ["DATA_EXPOSURE"].includes(f.category)
  );
  const domainFindings = findings.filter((f) =>
    ["IMPERSONATION"].includes(f.category)
  );
  const otherFindings = findings.filter(
    (f) => !["DATA_EXPOSURE", "IMPERSONATION"].includes(f.category)
  );

  const totalAlerts =
    findings.length + impersonations.filter((i) => i.status === "PENDING_REVIEW").length;

  const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

  const tabs: Array<{ id: AlertTab; label: string; count: number }> = [
    { id: "all", label: "All Alerts", count: totalAlerts },
    {
      id: "breaches",
      label: "Breach Data",
      count: breachFindings.length,
    },
    {
      id: "impersonation",
      label: "Impersonation",
      count: impersonations.filter((i) => i.status === "PENDING_REVIEW").length,
    },
    { id: "domains", label: "Lookalike Domains", count: domainFindings.length },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Alerts</h1>
          <p className="text-white/40 text-sm mt-0.5">
            {totalAlerts === 0
              ? "No active alerts — your identity looks clean."
              : `${totalAlerts} active alert${totalAlerts !== 1 ? "s" : ""} require your attention.`}
            {profile?.lastAuditedAt &&
              ` Last scan: ${new Date(profile.lastAuditedAt).toLocaleString()}`}
          </p>
        </div>
        <ScanTriggerButton />
      </div>

      {/* Scan success/error notice */}
      {scan === "complete" && (
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm text-green-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Scan complete. Results have been updated.
        </div>
      )}
      {scan === "error" && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Scan encountered an error. Check your API key configuration.
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-white/10">
        {tabs.map((tab) => (
          <a
            key={tab.id}
            href={`/alerts?tab=${tab.id}`}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? "border-blue-500 text-white"
                : "border-transparent text-white/40 hover:text-white/70"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white"
                    : "bg-white/10 text-white/60"
                }`}
              >
                {tab.count}
              </span>
            )}
          </a>
        ))}
      </div>

      {/* Content */}
      {totalAlerts === 0 ? (
        <EmptyAlerts />
      ) : (
        <div className="space-y-4">
          {/* Breach findings */}
          {(activeTab === "all" || activeTab === "breaches") &&
            breachFindings.length > 0 && (
              <div>
                {activeTab === "all" && (
                  <SectionHeader
                    icon={Shield}
                    title="Breach Data Exposures"
                    count={breachFindings.length}
                  />
                )}
                <div className="space-y-2">
                  {breachFindings
                    .sort(
                      (a, b) =>
                        SEVERITY_ORDER[a.severity as keyof typeof SEVERITY_ORDER] -
                        SEVERITY_ORDER[b.severity as keyof typeof SEVERITY_ORDER]
                    )
                    .map((finding) => (
                      <FindingCard
                        key={finding.id}
                        id={finding.id}
                        title={finding.title}
                        description={finding.description}
                        severity={finding.severity}
                        category={finding.category}
                        createdAt={finding.createdAt}
                        type="breach"
                      />
                    ))}
                </div>
              </div>
            )}

          {/* Impersonation alerts */}
          {(activeTab === "all" || activeTab === "impersonation") &&
            impersonations.length > 0 && (
              <div>
                {activeTab === "all" && (
                  <SectionHeader
                    icon={Search}
                    title="Impersonation Alerts"
                    count={impersonations.filter((i) => i.status === "PENDING_REVIEW").length}
                  />
                )}
                <div className="space-y-2">
                  {impersonations.map((alert) => {
                    const config =
                      PLATFORM_CONFIG[alert.platform as SocialPlatform];
                    return (
                      <ImpersonationCard
                        key={alert.id}
                        id={alert.id}
                        platformKey={alert.platform as SocialPlatform}
                        platformName={config?.name ?? alert.platform}
                        platformColor={config?.color ?? "#888"}
                        suspectedUsername={alert.suspectedUsername}
                        suspectedProfileUrl={alert.suspectedProfileUrl}
                        confidenceScore={alert.confidenceScore}
                        status={alert.status}
                        reportedAt={alert.reportedAt}
                      />
                    );
                  })}
                </div>
              </div>
            )}

          {/* Lookalike domain alerts */}
          {(activeTab === "all" || activeTab === "domains") &&
            domainFindings.length > 0 && (
              <div>
                {activeTab === "all" && (
                  <SectionHeader
                    icon={Globe}
                    title="Lookalike Domains"
                    count={domainFindings.length}
                  />
                )}
                <div className="space-y-2">
                  {domainFindings.map((finding) => (
                    <FindingCard
                      key={finding.id}
                      id={finding.id}
                      title={finding.title}
                      description={finding.description}
                      severity={finding.severity}
                      category={finding.category}
                      createdAt={finding.createdAt}
                      type="domain"
                    />
                  ))}
                </div>
              </div>
            )}

          {/* Other findings on "all" tab */}
          {activeTab === "all" && otherFindings.length > 0 && (
            <div className="space-y-2">
              {otherFindings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  id={finding.id}
                  title={finding.title}
                  description={finding.description}
                  severity={finding.severity}
                  category={finding.category}
                  createdAt={finding.createdAt}
                  type="other"
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  count,
}: {
  icon: typeof Shield;
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-white/40" />
      <h2 className="text-sm font-semibold text-white/60">{title}</h2>
      <span className="text-xs text-white/30">({count})</span>
    </div>
  );
}

const SEVERITY_STYLES = {
  CRITICAL: {
    badge: "bg-red-500/15 text-red-400 border border-red-500/20",
    dot: "bg-red-500",
    ring: "border-red-500/20",
  },
  HIGH: {
    badge: "bg-orange-500/15 text-orange-400 border border-orange-500/20",
    dot: "bg-orange-500",
    ring: "border-orange-500/20",
  },
  MEDIUM: {
    badge: "bg-amber-500/15 text-amber-400 border border-amber-500/20",
    dot: "bg-amber-500",
    ring: "border-amber-500/20",
  },
  LOW: {
    badge: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
    dot: "bg-blue-400",
    ring: "border-blue-500/20",
  },
};

function FindingCard({
  id,
  title,
  description,
  severity,
  category,
  createdAt,
  type,
}: {
  id: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  createdAt: Date;
  type: string;
}) {
  const sev = severity as keyof typeof SEVERITY_STYLES;
  const styles = SEVERITY_STYLES[sev] ?? SEVERITY_STYLES.LOW;

  const typeIcon =
    type === "breach"
      ? Shield
      : type === "domain"
      ? Globe
      : AlertTriangle;

  const TypeIcon = typeIcon;

  return (
    <div
      className={`bg-white/5 border rounded-xl px-5 py-4 ${styles.ring}`}
    >
      <div className="flex items-start gap-4">
        <div className="mt-0.5">
          <TypeIcon className="h-4 w-4 text-white/40" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white">{title}</span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles.badge}`}
            >
              {severity}
            </span>
          </div>
          <p className="text-xs text-white/50 mt-1 leading-relaxed">
            {description}
          </p>
          <p className="text-xs text-white/25 mt-2">
            Detected {new Date(createdAt).toLocaleDateString()}
          </p>
        </div>
        <AlertActionMenu findingId={id} />
      </div>
    </div>
  );
}

function ImpersonationCard({
  id,
  platformKey,
  platformName,
  platformColor,
  suspectedUsername,
  suspectedProfileUrl,
  confidenceScore,
  status,
  reportedAt,
}: {
  id: string;
  platformKey: SocialPlatform;
  platformName: string;
  platformColor: string;
  suspectedUsername: string;
  suspectedProfileUrl: string | null;
  confidenceScore: number;
  status: string;
  reportedAt: Date;
}) {
  const statusBadge =
    status === "PENDING_REVIEW"
      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
      : status === "CONFIRMED"
      ? "bg-red-500/10 text-red-400 border-red-500/20"
      : status === "REPORTED_TO_PLATFORM"
      ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
      : "bg-white/5 text-white/40 border-white/10";

  const statusLabel =
    status === "PENDING_REVIEW"
      ? "Pending Review"
      : status === "CONFIRMED"
      ? "Confirmed"
      : status === "REPORTED_TO_PLATFORM"
      ? "Reported"
      : "Dismissed";

  return (
    <div className="bg-white/5 border border-amber-500/20 rounded-xl px-5 py-4">
      <div className="flex items-start gap-4">
        <div
          className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
          style={{ backgroundColor: platformColor + "20", color: platformColor }}
        >
          {platformName.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white">
              Possible impersonator on {platformName}
            </span>
            <ConfidenceBadge score={confidenceScore} />
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusBadge}`}
            >
              {statusLabel}
            </span>
          </div>
          <p className="text-xs text-white/50 mt-1">
            Username: <span className="text-white/70">@{suspectedUsername}</span>
          </p>
          {suspectedProfileUrl && (
            <a
              href={suspectedProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-1 transition-colors"
            >
              View profile <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <p className="text-xs text-white/25 mt-2">
            Detected {new Date(reportedAt).toLocaleDateString()}
          </p>
        </div>
        <ImpersonationActions
          alertId={id}
          platform={platformKey}
          platformName={platformName}
          platformColor={platformColor}
          suspectedUsername={suspectedUsername}
          suspectedProfileUrl={suspectedProfileUrl}
        />
      </div>
    </div>
  );
}

function EmptyAlerts() {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <CheckCircle2 className="h-12 w-12 text-green-400 mb-4 opacity-70" />
      <p className="text-white/70 font-medium text-lg">No active alerts</p>
      <p className="text-white/30 text-sm mt-2 max-w-sm">
        Run a full scan to check for breaches, impersonators, and lookalike domains
        across all your connected accounts.
      </p>
      <ScanTriggerButton className="mt-6" />
    </div>
  );
}
