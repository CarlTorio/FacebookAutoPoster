"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Building2,
  Inbox,
  History,
  Calendar,
  Settings,
  ScrollText,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/login/actions";

const navItems = [
  { label: "Dashboard", href: "/", icon: Home },
  { label: "Brands", href: "/brands", icon: Building2 },
  { label: "Content queue", href: "/queue", icon: Inbox },
  { label: "Post history", href: "/history", icon: History },
  { label: "Schedule", href: "/schedule", icon: Calendar },
  { label: "API settings", href: "/settings", icon: Settings },
  { label: "Logs", href: "/logs", icon: ScrollText },
];

export function Sidebar({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-white h-screen sticky top-0 flex flex-col">
      <div className="px-6 py-5 border-b border-border">
        <h1 className="text-base font-semibold tracking-tight">AgentFB</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Auto-posting admin
        </p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {userEmail ? (
        <div className="border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground truncate" title={userEmail}>
            {userEmail}
          </p>
          <form action={signOut}>
            <button
              type="submit"
              className="mt-2 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </aside>
  );
}
