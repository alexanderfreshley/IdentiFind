"use client";

interface ConfidenceBadgeProps {
  score: number; // 0–100
}

export function ConfidenceBadge({ score }: ConfidenceBadgeProps) {
  const getTier = () => {
    if (score >= 90) return { label: "Confirmed", className: "bg-red-500/15 text-red-400 border-red-500/20" };
    if (score >= 70) return { label: "High Confidence", className: "bg-orange-500/15 text-orange-400 border-orange-500/20" };
    if (score >= 50) return { label: "Medium Confidence", className: "bg-amber-500/15 text-amber-400 border-amber-500/20" };
    if (score >= 30) return { label: "Low Confidence", className: "bg-blue-500/15 text-blue-400 border-blue-500/20" };
    return { label: "Speculative", className: "bg-white/10 text-white/40 border-white/10" };
  };

  const { label, className } = getTier();

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${className}`}
      title={`Confidence score: ${score}/100`}
    >
      <span className="tabular-nums">{score}%</span>
      <span className="opacity-70">· {label}</span>
    </span>
  );
}
