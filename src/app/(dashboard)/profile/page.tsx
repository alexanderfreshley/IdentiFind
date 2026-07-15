import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import {
  User,
  Mail,
  Shield,
  Calendar,
  Link2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Lock,
  Smartphone,
  Clock,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { PLATFORM_CONFIG, type SocialPlatform } from "@/types";

// ─── Data broker opt-out directory ───────────────────────────────────────────
const DATA_BROKERS = [
  { name: "Whitepages",        url: "https://www.whitepages.com/suppression-requests",                  difficulty: "Easy" },
  { name: "Spokeo",            url: "https://www.spokeo.com/optout",                                    difficulty: "Easy" },
  { name: "BeenVerified",      url: "https://www.beenverified.com/app/optout/search",                   difficulty: "Easy" },
  { name: "Intelius",          url: "https://www.intelius.com/opt-out/",                                difficulty: "Easy" },
  { name: "FastPeopleSearch",  url: "https://www.fastpeoplesearch.com/removal",                         difficulty: "Easy" },
  { name: "PeopleSearchNow",   url: "https://www.peoplesearchnow.com/opt-out",                          difficulty: "Easy" },
  { name: "TruthFinder",       url: "https://www.truthfinder.com/opt-out/",                             difficulty: "Medium" },
  { name: "Instant Checkmate", url: "https://www.instantcheckmate.com/opt-out/",                        difficulty: "Medium" },
  { name: "Radaris",           url: "https://radaris.com/page/how-to-remove",                           difficulty: "Medium" },
  { name: "PeopleFinder",      url: "https://www.peoplefinder.com/optout.php",                         difficulty: "Medium" },
  { name: "US Search",         url: "https://www.ussearch.com/opt-out/landing/",                        difficulty: "Medium" },
  { name: "PeekYou",           url: "https://www.peekyou.com/about/contact/optout/",                    difficulty: "Medium" },
  { name: "ZabaSearch",        url: "https://www.zabasearch.com/block_records/",                        difficulty: "Medium" },
  { name: "MyLife",            url: "https://www.mylife.com/privacy-policy/information-removal-request.json", difficulty: "Hard" },
  { name: "Acxiom",            url: "https://www.acxiom.com/optout/",                                   difficulty: "Hard" },
  { name: "LexisNexis",        url: "https://optout.lexisnexis.com/",                                   difficulty: "Hard" },
];

const DIFFICULTY_STYLE: Record<string, string> = {
  Easy:   "bg-green-500/10 text-green-400 border-green-500/20",
  Medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Hard:   "bg-red-500/10  text-red-400   border-red-500/20",
};

// ─── Risk score colour ────────────────────────────────────────────────────────
function riskColor(score: number) {
  if (score >= 70) return { text: "text-red-400",    ring: "bg-red-400",    label: "High Risk" };
  if (score >= 40) return { text: "text-amber-400",  ring: "bg-amber-400",  label: "Medium Risk" };
  if (score >= 10) return { text: "text-yellow-400", ring: "bg-yellow-400", label: "Low Risk" };
  return            { text: "text-green-400",  ring: "bg-green-400",  label: "Secure" };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const [user, profile] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        mfaEnabled: true,
        phoneVerified: true,
        role: true,
        lastLoginAt: true,
        passwordHash: true,
      },
    }),
    db.identityProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        socialAccounts: { where: { isActive: true } },
        securityFindings: { where: { isResolved: false } },
        impersonations: { where: { status: "PENDING_REVIEW" } },
      },
    }),
  ]);

  if (!user) redirect("/login");

  const initials = (user.name ?? user.email ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const riskScore  = profile?.riskScore ?? 0;
  const risk       = riskColor(riskScore);
  const memberDays = Math.floor(
    (Date.now() - new Date(user.createdAt).getTime()) / 86_400_000
  );

  const criticalCount = profile?.securityFindings.filter(
    (f) => f.severity === "CRITICAL"
  ).length ?? 0;
  const highCount = profile?.securityFindings.filter(
    (f) => f.severity === "HIGH"
  ).length ?? 0;

  return (
    <div className="space-y-6 max-w-4xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-white">My Profile</h1>
        <p className="text-white/40 text-sm mt-0.5">
          Your identity overview and security posture
        </p>
      </div>

      {/* ── Profile card ───────────────────────────────────────────────────── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={user.name ?? ""}
                className="w-20 h-20 rounded-2xl object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-2xl font-bold text-blue-300">
                {initials}
              </div>
            )}
            {/* Online dot */}
            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-950" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-white">
                {user.name ?? "Unnamed User"}
              </h2>
              {user.role === "ADMIN" && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/20">
                  Admin
                </span>
              )}
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                  riskScore >= 70
                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : riskScore >= 40
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : "bg-green-500/10 text-green-400 border-green-500/20"
                }`}
              >
                {risk.label}
              </span>
            </div>

            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2 text-sm text-white/50">
                <Mail className="h-3.5 w-3.5" />
                {user.email}
              </div>
              <div className="flex items-center gap-2 text-sm text-white/50">
                <Calendar className="h-3.5 w-3.5" />
                Member for {memberDays} day{memberDays !== 1 ? "s" : ""}
              </div>
              {user.lastLoginAt && (
                <div className="flex items-center gap-2 text-sm text-white/50">
                  <Clock className="h-3.5 w-3.5" />
                  Last login {new Date(user.lastLoginAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {/* Risk score pill */}
          <div className="text-center shrink-0">
            <div className={`text-4xl font-black ${risk.text}`}>{riskScore}</div>
            <div className="text-xs text-white/30 mt-1">Risk Score</div>
            <div className="mt-2 h-1.5 w-24 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${risk.ring}`}
                style={{ width: `${riskScore}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Connected Accounts",
            value: profile?.socialAccounts.length ?? 0,
            icon: Link2,
            color: "text-blue-400",
            bg: "bg-blue-400/10",
            href: "/accounts",
          },
          {
            label: "Open Findings",
            value: profile?.securityFindings.length ?? 0,
            icon: AlertTriangle,
            color: criticalCount > 0 ? "text-red-400" : "text-amber-400",
            bg: criticalCount > 0 ? "bg-red-400/10" : "bg-amber-400/10",
            href: "/alerts",
          },
          {
            label: "Impersonation Alerts",
            value: profile?.impersonations.length ?? 0,
            icon: Shield,
            color: "text-purple-400",
            bg: "bg-purple-400/10",
            href: "/alerts?tab=impersonation",
          },
          {
            label: "Last Scan",
            value: profile?.lastAuditedAt
              ? new Date(profile.lastAuditedAt).toLocaleDateString()
              : "Never",
            icon: TrendingUp,
            color: "text-green-400",
            bg: "bg-green-400/10",
            href: "/alerts",
          },
        ].map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/8 hover:border-white/20 transition-colors group"
          >
            <div
              className={`${stat.bg} w-8 h-8 rounded-lg flex items-center justify-center mb-3`}
            >
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <div className="text-xl font-bold text-white group-hover:text-white/90">{stat.value}</div>
            <div className="text-xs text-white/40 mt-0.5">{stat.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">

        {/* ── Account security ─────────────────────────────────────────────── */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Account Security
          </h3>

          {[
            {
              label: "Password",
              value: user.passwordHash ? "Set" : "Not set (OAuth only)",
              pass: !!user.passwordHash,
              action: !user.passwordHash ? { label: "Add password →", href: "/settings/security" } : null,
            },
            {
              label: "Two-Factor Authentication",
              value: user.mfaEnabled ? "Enabled" : "Not enabled",
              pass: user.mfaEnabled,
              action: !user.mfaEnabled ? { label: "Enable 2FA →", href: "/settings/security" } : null,
            },
            {
              label: "Phone Verification",
              value: user.phoneVerified ? "Verified" : "Not verified",
              pass: user.phoneVerified,
              action: !user.phoneVerified ? { label: "Add phone →", href: "/settings/security" } : null,
            },
            {
              label: "Email Address",
              value: user.email ?? "Not set",
              pass: !!user.email,
              action: null,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0"
            >
              {item.pass ? (
                <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{item.label}</div>
                <div className="text-xs text-white/40">{item.value}</div>
              </div>
              {item.action && (
                <Link
                  href={item.action.href}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors shrink-0 whitespace-nowrap"
                >
                  {item.action.label}
                </Link>
              )}
            </div>
          ))}

          {!user.mfaEnabled && (
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-lg px-4 py-3 text-xs text-amber-300">
              Enable two-factor authentication in{" "}
              <Link href="/settings/security" className="underline underline-offset-2 hover:text-amber-200 transition-colors">
                Settings
              </Link>{" "}
              to improve your account security.
            </div>
          )}
        </div>

        {/* ── Connected platforms ──────────────────────────────────────────── */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Connected Platforms
            </h3>
            <a
              href="/accounts"
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Manage →
            </a>
          </div>

          {profile?.socialAccounts.length === 0 ? (
            <div className="text-center py-6">
              <Link2 className="h-8 w-8 text-white/20 mx-auto mb-2" />
              <p className="text-sm text-white/40">No accounts connected yet</p>
              <a
                href="/accounts"
                className="mt-3 inline-block text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Connect your first account →
              </a>
            </div>
          ) : (
            <div className="space-y-2">
              {profile?.socialAccounts.map((account) => {
                const config =
                  PLATFORM_CONFIG[account.platform as SocialPlatform];
                return (
                  <div
                    key={account.id}
                    className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0"
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        backgroundColor: config.color + "20",
                        color: config.color,
                      }}
                    >
                      {config.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white">
                        {config.name}
                      </div>
                      <div className="text-xs text-white/40 truncate">
                        @{account.username}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {account.mfaEnabled === true && (
                        <span className="text-xs text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full">
                          MFA
                        </span>
                      )}
                      {account.mfaEnabled === false && (
                        <span className="text-xs text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full">
                          No MFA
                        </span>
                      )}
                      <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Findings summary ───────────────────────────────────────────────── */}
      {(profile?.securityFindings.length ?? 0) > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Open Security Findings
            </h3>
            <a
              href="/alerts"
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              View all →
            </a>
          </div>
          <div className="flex items-center gap-6">
            {criticalCount > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{criticalCount}</div>
                <div className="text-xs text-white/40 mt-0.5">Critical</div>
              </div>
            )}
            {highCount > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-400">{highCount}</div>
                <div className="text-xs text-white/40 mt-0.5">High</div>
              </div>
            )}
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {profile?.securityFindings.length}
              </div>
              <div className="text-xs text-white/40 mt-0.5">Total</div>
            </div>
            <div className="flex-1">
              <a
                href="/alerts"
                className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                Review findings and take action →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Data broker opt-out directory ──────────────────────────────────── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
            <User className="h-4 w-4" />
            Data Broker Opt-Out Directory
          </h3>
          <p className="text-xs text-white/40 mt-1.5">
            These sites likely have your personal information publicly listed. Submit
            opt-out requests to remove your data from each one. Difficulty reflects
            how involved their removal process is.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-2">
          {DATA_BROKERS.map((broker) => (
            <a
              key={broker.name}
              href={broker.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 px-4 py-3 bg-white/3 hover:bg-white/8 border border-white/8 rounded-xl transition-colors group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <ExternalLink className="h-3.5 w-3.5 text-white/30 group-hover:text-blue-400 transition-colors shrink-0" />
                <span className="text-sm text-white/70 group-hover:text-white transition-colors truncate">
                  {broker.name}
                </span>
              </div>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${
                  DIFFICULTY_STYLE[broker.difficulty]
                }`}
              >
                {broker.difficulty}
              </span>
            </a>
          ))}
        </div>

        <p className="text-xs text-white/25 mt-4">
          Opt-outs typically take 24–72 hours to process. Re-check periodically as data
          brokers re-aggregate records over time. Consider a paid removal service like
          DeleteMe or Kanary to automate this process.
        </p>
      </div>

    </div>
  );
}
