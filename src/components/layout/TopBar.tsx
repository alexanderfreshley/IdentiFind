import { Bell, User } from "lucide-react";
import Link from "next/link";

interface TopBarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function TopBar({ user }: TopBarProps) {
  return (
    <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-sm">
      <div />
      <div className="flex items-center gap-3">
        <button className="text-white/40 hover:text-white/70 transition-colors relative">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-red-500 rounded-full" />
        </button>
        <div className="flex items-center gap-2 text-sm">
          <div className="h-8 w-8 rounded-full bg-blue-600/30 border border-blue-500/30 flex items-center justify-center">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt={user.name || ""} className="h-8 w-8 rounded-full" />
            ) : (
              <User className="h-4 w-4 text-blue-400" />
            )}
          </div>
          <Link href="/profile" className="text-white/70 hidden sm:block hover:text-white transition-colors">
            {user.name || user.email}
          </Link>
        </div>
      </div>
    </header>
  );
}
