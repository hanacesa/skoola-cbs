import { useEffect, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Building2,
  LayoutDashboard,
  Layers,
  Users,
  Store,
  Wallet,
  BookOpenCheck,
  ArrowLeftRight,
  Receipt,
  PlugZap,
  FlaskConical,
  ScrollText,
  LogOut,
  Coins,
  ClipboardPlus,
  Baby,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { signOut } from "@/lib/auth.functions";
import { useAuth, useRoles } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, group: "Overview" },
  { to: "/registration", label: "Register records", icon: ClipboardPlus, group: "Registration" },
  { to: "/organizations", label: "Organizations", icon: Building2, group: "Details" },
  { to: "/clusters", label: "Clusters", icon: Layers, group: "Details" },
  { to: "/users", label: "Users", icon: Users, group: "Details" },
  { to: "/dependents", label: "Dependents", icon: Baby, group: "Details" },
  { to: "/merchants", label: "Merchants", icon: Store, group: "Details" },
  { to: "/wallets", label: "Accounts & Wallets", icon: Wallet, group: "Financial" },
  { to: "/adjustments", label: "Debit / Credit", icon: Coins, group: "Financial" },
  { to: "/ledger", label: "Ledger", icon: BookOpenCheck, group: "Financial" },
  { to: "/transactions", label: "Transactions", icon: Receipt, group: "Financial" },
  { to: "/transfers", label: "Transfers", icon: ArrowLeftRight, group: "Financial" },
  { to: "/providers", label: "Payment Providers", icon: PlugZap, group: "Operations" },
  { to: "/payment-test", label: "Payment Test", icon: FlaskConical, group: "Operations" },
  { to: "/wallet-test", label: "Wallet Reload Test", icon: Wallet, group: "Operations" },
  { to: "/audit", label: "Audit Trail", icon: ScrollText, group: "Operations" },
] as const;

const groups = ["Overview", "Registration", "Details", "Financial", "Operations"] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: roles } = useRoles(user?.id);
  const logout = useServerFn(signOut);
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: "/auth" });
    }
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Verifying session…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="border-b border-sidebar-border px-5 py-5">
          <p className="figure text-sm font-semibold tracking-tight text-primary">CBS · CORE LEDGER</p>
          <p className="mt-1 text-xs text-muted-foreground">Banking &amp; e-wallet control plane</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group} className="mb-5">
              <p className="label-caps px-2 pb-2">{group}</p>
              <ul className="space-y-0.5">
                {nav
                  .filter((item) => item.group === group)
                  .map((item) => {
                    const active = pathname === item.to;
                    const Icon = item.icon;
                    return (
                      <li key={item.to}>
                        <Link
                          to={item.to}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                            active
                              ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                              : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                          )}
                        >
                          <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border bg-surface/60 px-5 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2 lg:hidden">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-md px-2 py-1 text-xs",
                  pathname === item.to
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-medium text-foreground">{user.email}</p>
              <p className="label-caps">{roles?.join(" · ") || "no role"}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await logout();
                qc.clear();
                void navigate({ to: "/auth" });
              }}
            >
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </header>
        <main className="flex-1 space-y-6 px-5 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
