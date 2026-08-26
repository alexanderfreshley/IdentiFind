"use client";

import { useState } from "react";
import {
  X, ExternalLink, Flag, CheckCircle, ChevronRight,
  AlertTriangle, ClipboardCopy, ClipboardCheck,
} from "lucide-react";
import type { SocialPlatform } from "@/types";

// ─── Platform reporting config ────────────────────────────────────────────────

interface PlatformReportConfig {
  formUrl: string;
  steps: string[];
  /** Tips on what evidence strengthens the report */
  evidence: string[];
}

const PLATFORM_REPORT_CONFIG: Partial<Record<SocialPlatform, PlatformReportConfig>> = {
  INSTAGRAM: {
    formUrl: "https://www.instagram.com/accounts/contact/impersonation",
    steps: [
      "Visit the suspected impersonator's Instagram profile.",
      'Tap the "⋯" menu (top right) → "Report" → "It\'s pretending to be someone else".',
      'Select "Me" and follow the on-screen prompts, or use the official form link below for a formal impersonation report.',
      "Instagram typically responds within 24–48 hours.",
    ],
    evidence: [
      "Your real Instagram profile URL",
      "A screenshot of the impersonating profile showing the username and bio",
      "A photo of your government-issued ID (required for the formal form)",
      "Any direct messages sent by the impersonator",
    ],
  },
  TWITTER_X: {
    formUrl: "https://help.twitter.com/forms/impersonation",
    steps: [
      "Visit the suspected impersonator's X profile.",
      'Click "⋯" → "Report @username" → "They\'re pretending to be me or someone else".',
      "For a faster result with escalated review, submit via the official impersonation form link below.",
    ],
    evidence: [
      "Your real X profile URL",
      "Screenshot of the impersonating account showing username and bio",
      "Any tweets posted by the impersonator impersonating you",
    ],
  },
  FACEBOOK: {
    formUrl: "https://www.facebook.com/help/169486816475808",
    steps: [
      "Navigate to the fake profile.",
      'Click the "⋯" button on the cover photo → "Find support or report profile".',
      'Select "Pretending to be someone" → "Me".',
      "Or use the direct reporting form below.",
    ],
    evidence: [
      "Your real Facebook profile URL",
      "Link to the impersonating profile",
      "Screenshots showing the impersonation",
      "Government ID may be requested for formal review",
    ],
  },
  LINKEDIN: {
    formUrl: "https://www.linkedin.com/help/linkedin/answer/a1337377",
    steps: [
      "Visit the impersonating profile.",
      'Click "More" → "Report / Block" → "Report this profile" → "Fake profile".',
      "LinkedIn reviews take 3–7 business days. For faster resolution, use the Help Center form below.",
    ],
    evidence: [
      "Your real LinkedIn profile URL",
      "Link to the impersonating profile",
      "Any messages sent by the impersonator",
    ],
  },
  TIKTOK: {
    formUrl: "https://www.tiktok.com/legal/report/impersonation",
    steps: [
      "Go to the impersonating account.",
      'Tap "⋯" → "Report" → "Impersonation".',
      "For formal review, submit directly via the TikTok legal report form below.",
    ],
    evidence: [
      "Your real TikTok profile URL",
      "Screenshots of the impersonating account",
      "Any videos they have posted impersonating you",
    ],
  },
  YOUTUBE: {
    formUrl: "https://support.google.com/youtube/answer/2801959",
    steps: [
      "Go to the impersonating channel.",
      'Click "About" → "Flag" → "Report user" → "Impersonation".',
      "Use the Google support form for formal account impersonation reports.",
    ],
    evidence: [
      "Your real YouTube channel URL",
      "Link to the impersonating channel",
      "Screenshots of channel art, description, or videos used in impersonation",
    ],
  },
  REDDIT: {
    formUrl: "https://www.reddit.com/report",
    steps: [
      "Visit the impersonating account.",
      'Click their username → "⋯" → "Report User" → "It\'s impersonating me".',
      "Or use the Reddit report form for username impersonation.",
    ],
    evidence: [
      "Your real Reddit username",
      "The impersonating username",
      "Links to posts or comments the impersonator made",
    ],
  },
  GITHUB: {
    formUrl: "https://github.com/contact/report-abuse",
    steps: [
      "Visit the impersonating GitHub profile.",
      'Click "Block or report user" → "Report abuse".',
      "Or submit directly via the GitHub abuse report form below.",
    ],
    evidence: [
      "Your real GitHub profile URL",
      "The impersonating profile URL",
      "Screenshots of the bio or repositories misrepresenting your identity",
    ],
  },
  DISCORD: {
    formUrl: "https://discord.com/safety/360044103651-reporting-abusive-behavior-to-discord",
    steps: [
      "Right-click the impersonating user's username → 'Report'.",
      "Select the impersonation category and provide details.",
      "For server-level impersonation, contact the server admins first.",
    ],
    evidence: [
      "Your real Discord username and tag",
      "Screenshots of the impersonating account",
      "Any messages sent by the impersonator",
    ],
  },
};

const FALLBACK_CONFIG: PlatformReportConfig = {
  formUrl: "https://www.google.com/search?q=site:help.{platform}.com+impersonation+report",
  steps: [
    "Visit the platform's Help Center and search for 'impersonation report'.",
    "Look for a 'Report' option on the suspected account's profile.",
    "Provide your real account details and screenshots as evidence.",
  ],
  evidence: [
    "Your real profile URL on the platform",
    "The impersonating profile URL",
    "Screenshots showing the impersonation",
  ],
};

// ─── Panel ────────────────────────────────────────────────────────────────────

interface ImpersonationReportPanelProps {
  alertId: string;
  platform: SocialPlatform;
  platformName: string;
  platformColor: string;
  suspectedUsername: string;
  suspectedProfileUrl: string | null;
  onClose: () => void;
  onAction: (action: "report" | "confirm" | "dismiss") => Promise<void>;
  isLoading: boolean;
}

export function ImpersonationReportPanel({
  alertId,
  platform,
  platformName,
  platformColor,
  suspectedUsername,
  suspectedProfileUrl,
  onClose,
  onAction,
  isLoading,
}: ImpersonationReportPanelProps) {
  const [copied, setCopied] = useState(false);
  const config = PLATFORM_REPORT_CONFIG[platform] ?? FALLBACK_CONFIG;

  const handleCopyChecklist = () => {
    const text = [
      `Impersonation Report — ${platformName}`,
      `Suspected impersonator: @${suspectedUsername}`,
      suspectedProfileUrl ? `Profile URL: ${suspectedProfileUrl}` : "",
      "",
      "Evidence to include:",
      ...config.evidence.map((e) => `• ${e}`),
    ]
      .filter(Boolean)
      .join("\n");

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 shrink-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
            style={{ backgroundColor: platformColor + "25", color: platformColor }}
          >
            {platformName.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-white">
              Report Impersonator on {platformName}
            </h2>
            <p className="text-xs text-white/40 mt-0.5 truncate">
              @{suspectedUsername}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/70 transition-colors p-1 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5">

          {/* Suspected profile quick-link */}
          {suspectedProfileUrl && (
            <a
              href={suspectedProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 bg-white/5 hover:bg-white/8 border border-white/10 rounded-xl text-sm text-white/70 hover:text-white transition-colors"
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              <span className="truncate">View impersonating profile: @{suspectedUsername}</span>
              <ChevronRight className="h-3.5 w-3.5 ml-auto shrink-0 text-white/30" />
            </a>
          )}

          {/* Steps */}
          <div>
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-3">
              How to Report on {platformName}
            </h3>
            <ol className="space-y-2.5">
              {config.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-xs font-bold text-blue-400">
                    {i + 1}
                  </span>
                  <span className="text-sm text-white/70 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Evidence checklist */}
          <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Include in Your Report
              </h3>
              <button
                onClick={handleCopyChecklist}
                className="flex items-center gap-1 text-xs text-amber-400/70 hover:text-amber-300 transition-colors"
              >
                {copied
                  ? <><ClipboardCheck className="h-3 w-3" /> Copied</>
                  : <><ClipboardCopy className="h-3 w-3" /> Copy</>}
              </button>
            </div>
            <ul className="space-y-1.5">
              {config.evidence.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-white/50">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-500/60 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer actions */}
        <div className="shrink-0 border-t border-white/5 px-5 py-4 space-y-2.5">
          {/* Primary: open form */}
          <a
            href={config.formUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2.5 rounded-xl font-medium transition-colors"
          >
            Open {platformName} Reporting Form
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          {/* Secondary: mark reported / confirm */}
          <div className="flex gap-2">
            <button
              onClick={() => onAction("report")}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-sm px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              <CheckCircle className="h-3.5 w-3.5 text-green-400" />
              Mark as Reported
            </button>
            <button
              onClick={() => onAction("confirm")}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 border border-red-500/20 text-red-400 text-sm px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              <Flag className="h-3.5 w-3.5" />
              Confirm Impersonator
            </button>
          </div>

          <button
            onClick={() => onAction("dismiss")}
            disabled={isLoading}
            className="w-full text-xs text-white/25 hover:text-white/50 transition-colors py-1.5"
          >
            Not an impersonator — Dismiss this alert
          </button>
        </div>
      </div>
    </div>
  );
}
