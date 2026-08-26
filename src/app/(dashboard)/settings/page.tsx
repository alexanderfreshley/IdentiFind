import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Mail, Calendar } from "lucide-react";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { DeleteAccountSection } from "@/components/settings/DeleteAccountSection";

export default async function SettingsGeneralPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      image: true,
      createdAt: true,
      passwordHash: true,
      role: true,
    },
  });
  if (!user) redirect("/login");

  const initials = (user.name ?? user.email ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const memberDays = Math.floor(
    (Date.now() - new Date(user.createdAt).getTime()) / 86_400_000
  );

  return (
    <div className="space-y-6">

      {/* ── Profile card preview ──────────────────────────────────────────── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <div className="flex items-center gap-4 mb-5">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={user.name ?? ""}
              className="w-16 h-16 rounded-2xl object-cover shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-xl font-bold text-blue-300 shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <div className="font-semibold text-white">{user.name ?? "Unnamed User"}</div>
            <div className="flex items-center gap-1.5 text-xs text-white/40 mt-1">
              <Mail className="h-3 w-3" />
              {user.email}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-white/40 mt-0.5">
              <Calendar className="h-3 w-3" />
              Member for {memberDays} day{memberDays !== 1 ? "s" : ""}
            </div>
          </div>
          {user.role === "ADMIN" && (
            <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/20 shrink-0">
              Admin
            </span>
          )}
        </div>

        <div className="border-t border-white/5 pt-5">
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-4">
            Edit Profile
          </h3>
          <ProfileForm
            initialName={user.name ?? ""}
            initialImage={user.image ?? null}
          />
        </div>
      </div>

      {/* ── Account info (read-only) ──────────────────────────────────────── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wide">
          Account Details
        </h3>
        <div className="space-y-2">
          {[
            { label: "Email", value: user.email ?? "Not set" },
            { label: "Auth method", value: user.passwordHash ? "Password + OAuth" : "OAuth only" },
            { label: "Account type", value: user.role },
            { label: "Member since", value: new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <span className="text-sm text-white/50">{row.label}</span>
              <span className="text-sm text-white/80">{row.value}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-white/25 pt-1">
          To change your email address, contact support.
        </p>
      </div>

      {/* ── Danger Zone ──────────────────────────────────────────────────── */}
      <div className="bg-white/5 border border-red-500/15 rounded-2xl p-5 space-y-3">
        <h3 className="text-xs font-semibold text-red-400/70 uppercase tracking-wide">
          Danger Zone
        </h3>
        <p className="text-sm text-white/40">
          Permanently delete your account and all associated data. This cannot be undone.
        </p>
        <DeleteAccountSection
          hasPassword={!!user.passwordHash}
          userEmail={user.email ?? "your account"}
        />
      </div>

    </div>
  );
}
