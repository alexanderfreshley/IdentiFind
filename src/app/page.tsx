import Link from "next/link";
import Image from "next/image";
import { Shield, Search, Lock, AlertTriangle, ArrowRight, CheckCircle } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
      {/* Nav */}
      <nav className="border-b border-white/10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <Image
              src="/logo-v2.png"
              alt="IdentiFind"
              width={160}
              height={92}
              className="object-contain"
              priority
            />
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-white/70 hover:text-white transition-colors px-4 py-2"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="text-sm bg-blue-600 hover:bg-blue-500 transition-colors px-4 py-2 rounded-lg font-medium"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-sm text-blue-300 mb-8">
          <Shield className="h-3.5 w-3.5" />
          Identity Security Platform
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
          Protect Your
          <span className="text-blue-400"> Digital Identity</span>
          <br />
          Across Every Platform
        </h1>
        <p className="text-lg text-white/60 max-w-2xl mx-auto mb-10">
          IdentiFind aggregates all your social media accounts into a unified security
          dashboard. Detect impersonators, verify security settings, and stay ahead of
          threats — before they become incidents.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Start Security Audit
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 border border-white/20 hover:border-white/40 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: Shield,
              title: "Security Audit",
              description:
                "Instantly check MFA status, email/phone verification, and connected app permissions across all platforms.",
              color: "text-blue-400",
              bg: "bg-blue-400/10",
            },
            {
              icon: Search,
              title: "Impersonation Detection",
              description:
                "Scan for accounts using your name, username, or likeness across Instagram, X, Facebook, LinkedIn, and more.",
              color: "text-purple-400",
              bg: "bg-purple-400/10",
            },
            {
              icon: Lock,
              title: "Encrypted Profile",
              description:
                "All PII is encrypted at rest using AES-256-GCM. OAuth tokens are never stored in plaintext.",
              color: "text-green-400",
              bg: "bg-green-400/10",
            },
            {
              icon: AlertTriangle,
              title: "Risk Scoring",
              description:
                "Get a real-time risk score for your digital identity based on the security posture of all your accounts.",
              color: "text-amber-400",
              bg: "bg-amber-400/10",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/8 transition-colors"
            >
              <div className={`${feature.bg} w-10 h-10 rounded-xl flex items-center justify-center mb-4`}>
                <feature.icon className={`h-5 w-5 ${feature.color}`} />
              </div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-white/60 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Supported Platforms */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <p className="text-center text-sm text-white/40 mb-6 uppercase tracking-widest">
          Supports
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 text-white/50">
          {["Instagram", "X (Twitter)", "Facebook", "LinkedIn", "TikTok", "YouTube", "Reddit", "GitHub", "Discord"].map(
            (p) => (
              <span key={p} className="text-sm font-medium">
                {p}
              </span>
            )
          )}
        </div>
      </section>

      {/* Trust Badges */}
      <section className="max-w-7xl mx-auto px-6 py-12 border-t border-white/10">
        <div className="grid md:grid-cols-3 gap-6 text-center">
          {[
            { icon: Lock, label: "AES-256-GCM Encryption" },
            { icon: CheckCircle, label: "GDPR & CCPA Compliant" },
            { icon: Shield, label: "Zero PII in Logs" },
          ].map((badge) => (
            <div key={badge.label} className="flex items-center justify-center gap-2 text-white/50 text-sm">
              <badge.icon className="h-4 w-4" />
              {badge.label}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-8">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between text-sm text-white/30">
          <span>© {new Date().getFullYear()} IdentiFind. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-white/60 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-white/60 transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
