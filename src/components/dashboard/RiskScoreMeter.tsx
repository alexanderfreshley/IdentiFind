"use client";

interface RiskScoreMeterProps {
  score: number; // 0–100
}

export function RiskScoreMeter({ score }: RiskScoreMeterProps) {
  const clampedScore = Math.min(100, Math.max(0, score));

  const getColor = () => {
    if (clampedScore <= 20) return { stroke: "#22c55e", text: "text-green-400", label: "Low Risk" };
    if (clampedScore <= 50) return { stroke: "#f59e0b", text: "text-amber-400", label: "Medium Risk" };
    if (clampedScore <= 75) return { stroke: "#f97316", text: "text-orange-400", label: "High Risk" };
    return { stroke: "#ef4444", text: "text-red-400", label: "Critical Risk" };
  };

  const color = getColor();

  // SVG arc parameters
  const radius = 60;
  const circumference = Math.PI * radius; // half circle
  const offset = circumference * (1 - clampedScore / 100);

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="160" height="90" viewBox="0 0 160 90">
          {/* Background arc */}
          <path
            d="M 10 80 A 70 70 0 0 1 150 80"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Score arc */}
          <path
            d="M 10 80 A 70 70 0 0 1 150 80"
            fill="none"
            stroke={color.stroke}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className={`text-4xl font-bold ${color.text}`}>{clampedScore}</span>
          <span className="text-xs text-white/40">/ 100</span>
        </div>
      </div>
      <p className={`text-sm font-semibold mt-2 ${color.text}`}>{color.label}</p>
      <p className="text-xs text-white/30 mt-1 text-center">
        {clampedScore === 0
          ? "All security checks passed"
          : "Address open findings to reduce your score"}
      </p>
    </div>
  );
}
