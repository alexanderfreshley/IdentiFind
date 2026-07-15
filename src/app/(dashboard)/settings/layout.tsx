import { SettingsTabNav } from "@/components/settings/SettingsTabNav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6 max-w-3xl">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-white/40 text-sm mt-0.5">
          Manage your account preferences and security settings.
        </p>
      </div>

      {/* Tab nav — client component so usePathname works */}
      <SettingsTabNav />

      {/* Tab content */}
      {children}
    </div>
  );
}
