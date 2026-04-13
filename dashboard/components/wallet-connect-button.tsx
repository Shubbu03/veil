"use client";

import { CheckCircle, Wallet, ArrowsClockwise, SignOut, CaretDown } from "phosphor-react";
import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Button } from "@/components/ui/button";
import { formatAddress } from "@/lib/format";
import { cn } from "@/lib/utils";

export function WalletConnectButton() {
  const { connected, connecting, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const walletAddress = publicKey?.toBase58() ?? null;

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }

      setMenuOpen(false);
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [menuOpen]);

  if (!connected) {
    return (
      <Button
        disabled={connecting}
        onClick={() => setVisible(true)}
        size="lg"
        type="button"
        variant="primary"
      >
        <Wallet className="size-5" />
        {connecting ? "Connecting..." : "Connect wallet"}
      </Button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <Button
        className="shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
        onClick={() => setMenuOpen((current) => !current)}
        size="lg"
        type="button"
        variant="secondary"
      >
        <CheckCircle className="size-5 text-success" weight="fill" />
        {walletAddress ? formatAddress(walletAddress, 5) : "Connected"}
        <CaretDown className={cn("size-4 transition", menuOpen && "rotate-180")} weight="bold" />
      </Button>

      {menuOpen ? (
        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 min-w-[220px] rounded-lg border border-border bg-card p-2 shadow-(--shadow-panel)">
          <div className="grid gap-1.5">
            <button
              className="flex items-center justify-between rounded-2xl border border-border/70 bg-card px-3 py-3 text-left transition hover:bg-muted/55"
              onClick={() => {
                setMenuOpen(false);
                setVisible(true);
              }}
              type="button"
            >
              <span className="block text-sm font-semibold">Change wallet</span>
              <ArrowsClockwise className="size-4 text-accent" />
            </button>

            <button
              className="flex items-center justify-between rounded-2xl border border-border/70 bg-card px-3 py-3 text-left transition hover:bg-muted/55"
              onClick={() => {
                setMenuOpen(false);
                void disconnect();
              }}
              type="button"
            >
              <span className="block text-sm font-semibold">Disconnect</span>
              <SignOut className="size-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
