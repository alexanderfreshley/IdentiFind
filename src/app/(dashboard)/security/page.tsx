import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { PLATFORM_CONFIG, type SocialPlatform } from "@/types";
import { ScanTriggerButton } from "@/components/dashboard/alerts/ScanTriggerButton";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckStatus  = "PASS" | "FAIL" | "WARNING" | "UNKNOWN";
type Severity     = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

// ─── Static config maps ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<CheckStatus, {
  icon: typeof CheckCircle;
  color: string;
  border: string;
  label: string;
}> = {
  PASS:    { icon: CheckCircle,  color: "text-green-400",  border: "border-l-green-500/30",  label: "Pass"    },
  FAIL:    { icon: XCircle,      color: "text-red-400",    border: "border-l-red-500",        label: "Fail"    },
  WARNING: { icon: AlertCircle,  color: "text-amber-400",  border: "border-l-amber-500",      label: "Warning" },
  UNKNOWN: { icon: AlertCircle,  color: "text-white/25",   border: "border-l-white/10",       label: "Unknown" },
};

const SEVERITY_STYLES: Record<Severity, { badge: string; order: number }> = {
  CRITICAL: { badge: "bg-red-500/15 text-red-400 border border-red-500/20",      order: 0 },
  HIGH:     { badge: "bg-orange-500/15 text-orange-400 border border-orange-500/20", order: 1 },
  MEDIUM:   { badge: "bg-amber-500/15 text-amber-400 border border-amber-500/20", order: 2 },
  LOW:      { badge: "bg-blue-500/15 text-blue-400 border border-blue-500/20",    order: 3 },
};

const CHECK_TYPE_LABELS: Record<string, string> = {
  MFA_ENABLED:             "Two-Factor Authentication",
  EMAIL_VERIFIED:          "Email Verified",
  PHONE_VERIFIED:          "Phone Verified",
  ACCOUNT_AGE:             "Account Age",
  RECOVERY_EMAIL_SET:      "Recovery Email Set",
  ACTIVE_SESSIONS_REVIEW:  "Active Sessions Reviewed",
  CONNECTED_APPS_REVIEW:   "Connected Apps Reviewed",
  LOGIN_ACTIVITY_REVIEW:   "Login Activity Reviewed",
  PRIVACY_SETTINGS:        "Privacy Settings",
  PASSWORD_STRENGTH:       "Password Strength",
};

// ─── Score helpers ────────────────────────────────────────────────────────────

function riskStyle(score: number) {
  if (score >= 70) return { text: "text-red-400",    ring: "stroke-red-500",    bg: "bg-red-500",    label: "High Risk" };
  if (score >= 40) return { text: "text-amber-400",  ring: "stroke-amber-500",  bg: "bg-amber-500",  label: "Medium Risk" };
  if (score >= 10) return { text: "text-yellow-400", ring: "stroke-yellow-500", bg: "bg-yellow-500", label: "Low Risk" };
  return              { text: "text-green-400",  ring: "stroke-green-500",  bg: "bg-green-500",  label: "Secure" };
}

/** SVG ring gauge — radius 36, circumference ≈ 226 */
function RiskRing({ score }: { score: number }) {
  const r   = 36;
  const circ = 2 * Math.PI * r;      // ≈ 226.2
  const dash = ((100 - score) / 100) * circ;
  const style = riskStyle(score);

  return (
    <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
      {/* Track */}
      <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className="stroke-white/10" />
      {/* Progress */}
      <circle
        cx="50" cy="50" r={r}
        fill="none" strokeWidth="8"
        strokeLinecap="round"
        className={style.ring}
        strokeDasharray={circ}
        strokeDashoffset={dash}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      {/* Score text — counter-rotate so it reads normally */}
      <text
        x="50" y="50"
        textAnchor="middle" dominantBaseline="middle"
        className={`rotate-90 text-3xl font-black fill-current ${style.text}`}
        style={{ transform: "rotate(90deg)", transformOrigin: "50px 50px", fontSize: "22px", fontWeight: 900 }}
      >
        {score}
      </text>
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ audit?: string; score?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { audit } = await searchParams;

  const profile = await db.identityProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      socialAccounts: {
        where: { isActive: true },
        include: {
          securityChecks: { orderBy: { checkedAt: "desc" } },
        },
      },
    },
  });

  // ── Per-account: deduplicate to latest check per type ──────��──────────────
  const accountsWithChecks = (profile?.socialAccounts ?? []).map((account) => {
    const latestByType = new Map<string, typeof account.securityChecks[0]>();
    for (const check of account.securityChecks) {
      if (!latestByType.has(check.checkType)) latestByType.set(check.checkType, check);
    }
    const checks = Array.from(latestByType.values()).sort((a, b) => {
      const order: Record<string, number> = { FAIL: 0, WARNING: 1, UNKNOWN: 2, PASS: 3 };
      return (order[a.status] ?? 4) - (order[b.status] ?? 4);
    });
    const passCount  = checks.filter((c) => c.status === "PASS").length;
    const failCount  = checks.filter((c) => c.status === "FAIL").length;
    const warnCount  = checks.filter((c) => c.status === "WARNING").length;
    const scoreRate  = checks.length > 0 ? Math.round((passCount / checks.length) * 100) : null;
    return { ...account, checks, passCount, failCount, warnCount, scoreRate };
  });

  // ── Aggregate stats ───────────────────────────────────────────────────────
  const allChecks   = accountsWithChecks.flatMap((a) => a.checks);
  const totalPass   = allChecks.filter((c) => c.status === "PASS").length;
  const totalFail   = allChecks.filter((c) => c.status === "FAIL").length;
  const totalWarn   = allChecks.filter((c) => c.status === "WARNING").length;
  const riskScore   = profile?.riskScore ?? 0;
  const risk        = riskStyle(riskScore);

  // ── Action items: all failing/warning checks across accounts, sorted ──────
  const actionItems = accountsWithChecks
    .flatMap((a) =>
      a.checks
        .filter((c) => c.status === "FAIL" || c.status === "WARNING")
        .map((c) => ({ ...c, accountUsername: a.username, platform: a.platform as SocialPlatform }))
    )
    .sort((a, b) => {
      const sevOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      const statusOrder: Record<string, number> = { FAIL: 0, WARNING: 1 };
      if (a.status !== b.status) return (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2);
      return (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4);
    });

  const hasData = accountsWithChecks.some((a) => a.checks.length > 0);

  return (
    <div className="space-y-6 max-w-5xl">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Security Audit</h1>
          <p className="text-white/40 text-sm mt-0.5">
            {profile?.lastAuditedAt
              ? `Last scan: ${new Date(profile.lastAuditedAt).toLocaleString()}`
              : "No scan run yet — run a full scan to audit your accounts."}
          </p>
        </div>
        <ScanTriggerButton />
      </div>

      {/* ── Scan result banner ───────────────────────────────────────────── */}
      {audit === "complete" && (
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm text-green-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Audit complete. All checks have been updated below.
        </div>
      )}
      {audit === "error" && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Audit encountered an error. Check your API key configuration and try again.
        </div>
      )}

      {/* ── No accounts state ────────────────────────────────────────────── */}
      {accountsWithChecks.length === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-14 text-center">
          <Shield className="h-14 w-14 text-white/10 mx-auto mb-4" />
          <p className="text-white/60 font-semibold text-lg">No accounts connected</p>
          <p className="text-white/30 text-sm mt-2 mb-6 max-w-sm mx-auto">
            Connect your social media accounts to start monitoring their security posture.
          </p>
          <Link
            href="/accounts"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm px-5 py-2.5 rounded-xl font-medium transition-colors"
          >
            Connect Accounts <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {accountsWithChecks.length > 0 && (
        <>
          {/* ── Summary card ───────────────────────────────────────────────── */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-8">
              {/* Risk ring */}
              <div className="shrink-0 flex flex-col items-center gap-1">
                <RiskRing score={riskScore} />
                <span className={`text-xs font-semibold ${risk.text}`}>{risk.label}</span>
              </div>

              {/* Divider */}
              <div className="w-px h-24 bg-white/10 shrink-0" />

              {/* Stats */}
              <div className="flex-1 grid grid-cols-3 gap-4">
                {[
                  {
                    label: "Checks Passed",
                    value: totalPass,
                    color: "text-green-400",
                    bg: "bg-green-500/10",
                    icon: CheckCircle,
                  },
                  {
                    label: "Warnings",
                    value: totalWarn,
                    color: "text-amber-400",
                    bg: "bg-amber-500/10",
                    icon: AlertCircle,
                  },
                  {
                    label: "Failed Checks",
                    value: totalFail,
                    color: "text-red-400",
                    bg: "bg-red-500/10",
                    icon: XCircle,
                  },
                ].map((s) => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
                    <s.icon className={`h-4 w-4 ${s.color} mb-2`} />
                    <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-white/40 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className="w-px h-24 bg-white/10 shrink-0" />

              {/* Account coverage */}
              <div className="shrink-0 text-center space-y-1">
                <div className="text-3xl font-black text-white">{accountsWithChecks.length}</div>
                <div className="text-xs text-white/40">
                  Account{accountsWithChecks.length !== 1 ? "s" : ""}
                </div>
                <div className="text-xs text-white/25">audited</div>
              </div>
            </div>

            {/* No-scan prompt */}
            {!hasData && (
              <div className="mt-5 pt-5 border-t border-white/5 text-center">
                <p className="text-sm text-white/40">
                  Run a scan to populate security check results for your connected accounts.
                </p>
              </div>
            )}
          </div>

          {/* ── Action items ───────────────────────────────────────────────── */}
          {actionItems.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-white">
                  Action Items
                </h2>
                <span className="ml-auto text-xs text-white/30">
                  {actionItems.length} issue{actionItems.length !== 1 ? "s" : ""} to fix
                </span>
              </div>

              <div className="divide-y divide-white/5">
                {actionItems.map((item, idx) => {
                  const platConfig = PLATFORM_CONFIG[item.platform];
                  const sevStyle   = SEVERITY_STYLES[item.severity as Severity] ?? SEVERITY_STYLES.LOW;
                  const isFailure  = item.status === "FAIL";

                  return (
                    <div
                      key={idx}
                      className={`flex items-start gap-4 px-5 py-3.5 border-l-4 ${
                        isFailure ? "border-l-red-500 bg-red-500/3" : "border-l-amber-500 bg-amber-500/3"
                      }`}
                    >
                      {/* Platform badge */}
                      <div
                        className="mt-0.5 w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: platConfig.color + "25", color: platConfig.color }}
                      >
                        {platConfig.name.slice(0, 2).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white">
                            {CHECK_TYPE_LABELS[item.checkType] ?? item.checkType}
                          </span>
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${sevStyle.badge}`}>
                            {item.severity}
                          </span>
                          <span className="text-xs text-white/25">
                            @{item.accountUsername} · {platConfig.name}
                          </span>
                        </div>
                        {item.details && (
                          <p className="text-xs text-white/45 mt-0.5 leading-relaxed">
                            {item.details}
                          </p>
                        )}
                      </div>

                      {item.remediationUrl && item.remediationUrl !== "#" && (
                        <a
                          href={item.remediationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
                            isFailure
                              ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                              : "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
                          }`}
                        >
                          Fix <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── All-clear banner ─────────────────────────────────────────── */}
          {hasData && actionItems.length === 0 && (
            <div className="flex items-center gap-4 bg-green-500/8 border border-green-500/20 rounded-2xl px-6 py-5">
              <CheckCircle2 className="h-8 w-8 text-green-400 shrink-0" />
              <div>
                <p className="font-semibold text-green-300">All checks passed!</p>
                <p className="text-sm text-white/40 mt-0.5">
                  Your connected accounts have no active security issues. Keep it up.
                </p>
              </div>
            </div>
          )}

          {/* ── Per-account cards ─────────────────────────────────────────── */}
          <div className="space-y-4">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wide">
              Per-Account Breakdown
            </h2>

            {accountsWithChecks.map((account) => {
              const config    = PLATFORM_CONFIG[account.platform as SocialPlatform];
              const scoreRate = account.scoreRate;

              return (
                <div
                  key={account.id}
                  className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
                >
                  {/* Account header */}
                  <div className="flex items-center gap-4 px-5 py-4 border-b border-white/5">
                    {/* Platform badge */}
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: config.color + "20", color: config.color }}
                    >
                      {config.name.slice(0, 2).toUpperCase()}
                    </div>

                    {/* Name + score bar */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">@{account.username}</span>
                        <span className="text-xs text-white/30">{config.name}</span>
                      </div>
                      {scoreRate !== null && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                scoreRate >= 80
                                  ? "bg-green-500"
                                  : scoreRate >= 50
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                              }`}
                              style={{ width: `${scoreRate}%` }}
                            />
                          </div>
                          <span className="text-xs text-white/40 shrink-0">{scoreRate}%</span>
                        </div>
                      )}
                    </div>

                    {/* Summary pills */}
                    <div className="flex items-center gap-2 shrink-0 text-xs">
                      {account.passCount > 0 && (
                        <span className="flex items-center gap-1 text-green-400">
                          <CheckCircle className="h-3 w-3" />
                          {account.passCount}
                        </span>
                      )}
                      {account.warnCount > 0 && (
                        <span className="flex items-center gap-1 text-amber-400">
                          <AlertCircle className="h-3 w-3" />
                          {account.warnCount}
                        </span>
                      )}
                      {account.failCount > 0 && (
                        <span className="flex items-center gap-1 text-red-400">
                          <XCircle className="h-3 w-3" />
                          {account.failCount}
                        </span>
                      )}
                      {account.checks.length === 0 && (
                        <span className="text-white/25">Not audited</span>
                      )}
                    </div>
                  </div>

                  {/* Check rows */}
                  {account.checks.length > 0 ? (
                    <div className="divide-y divide-white/5">
                      {account.checks.map((check) => {
                        const sc      = STATUS_CONFIG[check.status as CheckStatus];
                        const sevStyle = SEVERITY_STYLES[check.severity as Severity] ?? SEVERITY_STYLES.LOW;
                        const needsFix = (check.status === "FAIL" || check.status === "WARNING")
                          && check.remediationUrl
                          && check.remediationUrl !== "#";

                        return (
                          <div
                            key={check.id}
                            className={`flex items-start gap-4 px-5 py-3 border-l-4 ${
                              check.status === "FAIL"
                                ? "border-l-red-500/70"
                                : check.status === "WARNING"
                                ? "border-l-amber-500/70"
                                : "border-l-transparent"
                            }`}
                          >
                            <sc.icon className={`h-4 w-4 mt-0.5 shrink-0 ${sc.color}`} />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-white">
                                  {CHECK_TYPE_LABELS[check.checkType] ?? check.checkType}
                                </span>
                                <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${sevStyle.badge}`}>
                                  {check.severity}
                                </span>
                                <span className={`text-xs font-medium ${sc.color}`}>
                                  {sc.label}
                                </span>
                              </div>
                              {check.details && (
                                <p className="text-xs text-white/40 mt-0.5 leading-relaxed">
                                  {check.details}
                                </p>
                              )}
                              <p className="text-xs text-white/20 mt-1">
                                Checked {new Date(check.checkedAt).toLocaleDateString()}
                              </p>
                            </div>

                            {needsFix && (
                              <a
                                href={check.remediationUrl!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0 mt-0.5 ${
                                  check.status === "FAIL"
                                    ? "bg-red-500/12 text-red-400 hover:bg-red-500/25"
                                    : "bg-amber-500/12 text-amber-400 hover:bg-amber-500/25"
                                }`}
                              >
                                Fix <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-5 py-5 text-sm text-white/30 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-white/20" />
                      No checks recorded yet — run a full scan to audit this account.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
