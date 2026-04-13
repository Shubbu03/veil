export interface DashboardEnv {
  coordinatorUrl: string | null;
  cluster: "devnet";
  rpcUrl: string;
}

export const dashboardEnv: DashboardEnv = {
  coordinatorUrl: process.env.NEXT_PUBLIC_COORDINATOR_URL ?? null,
  cluster: "devnet",
  rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
};
