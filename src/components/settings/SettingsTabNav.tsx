"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/settings",          label: "General" },
  { href: "/settings/security", label: "Security" },
];

export function SettingsTabNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 border-b border-white/10">
      {TABS.map((tab) => {
        const isActive =
          tab.href === "/settings"
            ? pathname === "/settings"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              isActive
                ? "border-blue-500 text-white"
                : "border-transparent text-white/40 hover:text-white/70"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
