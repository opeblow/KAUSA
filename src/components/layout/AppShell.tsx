import { NavLink, Outlet, Link } from "react-router-dom";
import {
  Database,
  Activity,
  Search,
  GitBranch,
  BarChart3,
  Archive,
  Brain,
  BookOpen,
  ArrowUpRight,
  LogOut,
  User,
} from "lucide-react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Brand } from "@/components/Brand";
import { AmbientBackdrop } from "@/components/layout/AmbientBackdrop";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

const nav = [
  { to: "/app/workspace", label: "Workspace", icon: Database },
  { to: "/app/overview", label: "Overview", icon: Activity },
  { to: "/app/ask", label: "Ask", icon: Search },
  { to: "/app/investigation", label: "Investigation", icon: GitBranch },
  { to: "/app/verdict", label: "Verdict", icon: BarChart3 },
  { to: "/app/missions", label: "Missions", icon: Archive },
  { to: "/app/memory", label: "Memory", icon: Brain },
  { to: "/app/methodology", label: "Methodology", icon: BookOpen },
];

export function AppShell() {
  const user = useQuery(api.users.current);
  const { signOut } = useAuthActions();

  return (
    <div className="relative min-h-screen bg-base-950">
      <AmbientBackdrop />
      <div className="relative z-10 mx-auto flex max-w-[1500px]">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line/70 bg-base-950/40 px-3 py-5 backdrop-blur-sm lg:flex">
          <Link to="/" className="px-2" aria-label="Kausa home">
            <Brand />
          </Link>

          <nav className="mt-8 flex flex-1 flex-col gap-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                    isActive
                      ? "bg-white/[0.05] text-ink"
                      : "text-ink-muted hover:bg-white/[0.03] hover:text-ink",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
                    )}
                    <item.icon className="size-4 shrink-0" />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mt-4 rounded-xl border border-line/70 bg-base-900/60 p-3">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg border border-line bg-white/[0.03]">
                <User className="size-3.5 text-ink-muted" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs text-ink">{user?.name ?? "Signed in"}</p>
                <p className="truncate text-[11px] text-ink-faint">{user?.email ?? ""}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Link
                to="/"
                className="inline-flex items-center gap-1 text-xs text-accent-soft hover:underline"
              >
                Landing <ArrowUpRight className="size-3" />
              </Link>
              <button
                onClick={() => void signOut()}
                className="inline-flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-negative"
              >
                <LogOut className="size-3" /> Sign out
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-line/70 bg-base-950/80 px-4 backdrop-blur-xl lg:px-8">
            <div className="flex items-center gap-3 overflow-x-auto lg:hidden">
              <Link to="/" aria-label="Kausa home">
                <Brand />
              </Link>
            </div>
            <nav className="hidden items-center gap-1 lg:flex">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "rounded-lg px-3 py-1.5 text-xs transition-colors",
                      isActive ? "bg-white/[0.06] text-ink" : "text-ink-muted hover:text-ink",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <button
              onClick={() => void signOut()}
              className="ml-auto inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-xs text-ink-muted transition-colors hover:text-ink"
            >
              <LogOut className="size-3.5" /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </header>

          <main className="min-w-0 flex-1 px-4 py-8 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
