"use client";

import { useState } from "react";
import { CheckCircle, Plus, X, Loader2 } from "lucide-react";
import type { SocialPlatform, PlatformConfig } from "@/types";

interface AddAccountModalProps {
  platform: SocialPlatform;
  config: PlatformConfig;
  isConnected: boolean;
  profileId: string;
}

export function AddAccountModal({
  platform,
  config,
  isConnected,
  profileId,
}: AddAccountModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    profileUrl: "",
    mfaEnabled: "",
    emailVerified: "",
    phoneVerified: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          profileId,
          username: formData.username.replace("@", "").trim(),
          profileUrl: formData.profileUrl || null,
          mfaEnabled: formData.mfaEnabled === "yes" ? true : formData.mfaEnabled === "no" ? false : null,
          emailVerified: formData.emailVerified === "yes" ? true : formData.emailVerified === "no" ? false : null,
          phoneVerified: formData.phoneVerified === "yes" ? true : formData.phoneVerified === "no" ? false : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to add account.");
        return;
      }

      setIsOpen(false);
      window.location.reload();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isConnected) {
    return (
      <div className="bg-white/5 border border-green-500/20 rounded-xl p-4 flex items-center gap-3 opacity-70">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
          style={{ backgroundColor: config.color + "20", color: config.color }}
        >
          {config.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white">{config.name}</div>
          <div className="text-xs text-green-400 flex items-center gap-1 mt-0.5">
            <CheckCircle className="h-3 w-3" /> Connected
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-white/5 border border-white/10 hover:border-white/20 rounded-xl p-4 flex items-center gap-3 text-left transition-colors group w-full"
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 opacity-70 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: config.color + "20", color: config.color }}
        >
          {config.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white">{config.name}</div>
          <div className="text-xs text-white/30 mt-0.5">Click to connect</div>
        </div>
        <Plus className="h-4 w-4 text-white/30 group-hover:text-blue-400 transition-colors" />
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: config.color + "20", color: config.color }}
                >
                  {config.name.slice(0, 2).toUpperCase()}
                </div>
                <h3 className="font-semibold text-white">Connect {config.name}</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">
                  Username *
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                  placeholder="@yourusername"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">
                  Profile URL (optional)
                </label>
                <input
                  type="url"
                  value={formData.profileUrl}
                  onChange={(e) => setFormData({ ...formData, profileUrl: e.target.value })}
                  placeholder={`https://${config.name.toLowerCase()}.com/yourusername`}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-sm"
                />
              </div>

              {/* Security snapshot — self-reported */}
              <div className="pt-1 space-y-3">
                <p className="text-xs text-white/40">
                  Optionally provide current security status (you can update this after running an audit):
                </p>
                {[
                  { key: "mfaEnabled" as const, label: "Two-factor authentication (MFA) enabled?" },
                  { key: "emailVerified" as const, label: "Email address verified?" },
                  { key: "phoneVerified" as const, label: "Phone number verified?" },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="block text-xs font-medium text-white/50 mb-1">
                      {field.label}
                    </label>
                    <div className="flex gap-2">
                      {["yes", "no", "unknown"].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setFormData({ ...formData, [field.key]: val })}
                          className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                            formData[field.key] === val
                              ? "bg-blue-600 border-blue-500 text-white"
                              : "border-white/10 text-white/40 hover:text-white/70"
                          }`}
                        >
                          {val.charAt(0).toUpperCase() + val.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 border border-white/10 hover:border-white/20 text-white/60 hover:text-white text-sm px-4 py-2.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2.5 rounded-lg font-medium transition-colors"
                >
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
