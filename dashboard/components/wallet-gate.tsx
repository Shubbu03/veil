"use client";

import { ShieldCheck, Wallet } from "phosphor-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WalletConnectButton } from "@/components/wallet-connect-button";

export function WalletGate() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border/70">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary/15 p-3 text-primary">
            <Wallet size={22} weight="duotone" />
          </div>
          <div>
            <CardTitle>Connect a wallet</CardTitle>
            <p className="text-sm text-muted-foreground">
              Vaults and schedules are tied to the connected employer wallet on devnet.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-center gap-3 rounded-3xl border border-border/70 bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          <ShieldCheck size={18} weight="duotone" className="text-success" />
          Protocol configuration stays visible before you connect.
        </div>
        <WalletConnectButton />
      </CardContent>
    </Card>
  );
}
