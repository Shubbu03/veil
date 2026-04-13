"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChartBar, ClockCounterClockwise, Coins, Queue, SidebarSimple } from "phosphor-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { formatAddress } from "@/lib/format";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Overview", icon: ChartBar },
  { href: "/vaults", label: "Vaults", icon: Coins },
  { href: "/schedules", label: "Schedules", icon: Queue },
  { href: "/schedules/new", label: "Create", icon: ClockCounterClockwise },
] as const;

const SIDEBAR_STORAGE_KEY = "veil-dashboard-sidebar-collapsed";

export function AppShell({
  children,
}: {
  children: React.ReactNode;
  coordinatorStatus?: "online" | "offline" | "unknown";
}) {
  const pathname = usePathname();
  const { publicKey } = useWallet();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getStoredSidebarCollapsed);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== "b") {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      setSidebarCollapsed((current) => !current);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const currentSection = navItems.find(({ href }) => pathname === href || (href !== "/" && pathname.startsWith(href)))?.label ?? "Overview";

  return (
    <div className="min-h-screen">
      <div
        className={cn(
          "mx-auto grid min-h-screen w-full max-w-[1600px] gap-6 px-4 py-4 md:px-6",
          sidebarCollapsed ? "md:grid-cols-[92px_minmax(0,1fr)]" : "md:grid-cols-[280px_minmax(0,1fr)]",
        )}
      >
        <aside className="panel sticky top-4 hidden h-[calc(100vh-2rem)] flex-col overflow-hidden transition-[width] duration-200 md:flex">
          <div className={cn("border-b border-border/70", sidebarCollapsed ? "px-3 py-5" : "px-5 py-5")}>
            <div className={cn("flex items-center", sidebarCollapsed ? "justify-center" : "gap-3")}>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/12 ring-1 ring-primary/15">
                <Image alt="Veil" className="size-8 rounded-xl" height={32} priority src="/veil-logo.png" width={32} />
              </div>
              {!sidebarCollapsed ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                    Veil
                  </p>
                  <h1 className="text-lg font-semibold">Dashboard</h1>
                </div>
              ) : null}
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== "/" && pathname.startsWith(href));

              return (
                <Link
                  key={href}
                  aria-label={label}
                  className={cn(
                    "flex min-h-11 items-center rounded-2xl text-sm font-medium transition-colors",
                    sidebarCollapsed ? "justify-center px-0" : "gap-3 px-4",
                    active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/65 hover:text-foreground",
                  )}
                  href={href}
                  title={label}
                >
                  <Icon size={18} weight={active ? "fill" : "duotone"} />
                  {!sidebarCollapsed ? <span>{label}</span> : null}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-border/70 p-3">
            <Button
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(sidebarCollapsed ? "size-10 w-full rounded-2xl px-0" : "w-full justify-start rounded-2xl px-4")}
              onClick={() => setSidebarCollapsed((current) => !current)}
              size="sm"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              variant="ghost"
            >
              <SidebarSimple size={18} weight="bold" />
              {!sidebarCollapsed ? <span>Toggle sidebar</span> : null}
            </Button>
          </div>
        </aside>

        <main className="flex min-h-screen flex-col gap-6">
          <header className="panel sticky top-4 z-20 flex flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/12 ring-1 ring-primary/15 md:hidden">
                <Image alt="Veil" className="size-7 rounded-xl" height={28} src="/veil-logo.png" width={28} />
              </div>
              <div>
                <p className="text-xs font-extrabold tracking-[0.24em] text-muted-foreground">
                  Veil
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {publicKey ? `${currentSection} · ${formatAddress(publicKey.toBase58(), 5)}` : `${currentSection} · connect a wallet`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start md:self-auto">
              <ThemeToggle />
              <WalletConnectButton />
            </div>
          </header>

          <div className="flex-1 pb-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function getStoredSidebarCollapsed() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
}
