import { AlertTriangle, CheckCircle, Info } from "lucide-react";

type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface Finding {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  category: string;
  isResolved: boolean;
}

interface SecurityFindingsListProps {
  findings: Finding[];
}

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string; icon: typeof AlertTriangle }> = {
  CRITICAL: { label: "Critical", color: "text-red-400", bg: "bg-red-400/10 border-red-400/20", icon: AlertTriangle },
  HIGH: { label: "High", color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20", icon: AlertTriangle },
  MEDIUM: { label: "Medium", color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20", icon: Info },
  LOW: { label: "Low", color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20", icon: Info },
};

export function SecurityFindingsList({ findings }: SecurityFindingsListProps) {
  if (findings.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <CheckCircle className="h-10 w-10 text-green-400 mb-3" />
        <p className="text-sm font-medium text-white">No open findings</p>
        <p className="text-xs text-white/30 mt-1">Run a security audit to check your accounts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {findings.map((finding) => {
        const config = SEVERITY_CONFIG[finding.severity];
        return (
          <div
            key={finding.id}
            className={`border rounded-lg px-4 py-3 ${config.bg}`}
          >
            <div className="flex items-start gap-3">
              <config.icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white truncate">{finding.title}</span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${config.color} bg-white/5 shrink-0`}>
                    {config.label}
                  </span>
                </div>
                <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{finding.description}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
