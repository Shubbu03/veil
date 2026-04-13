export interface KnownMint {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

export const KNOWN_DEVNET_MINTS: readonly KnownMint[] = [
  {
    address: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    symbol: "USDC",
    name: "USD Coin (Devnet)",
    decimals: 6,
  },
] as const;

export const ACCOUNT_DISCRIMINATOR_SIZE = 8;
export const PUBKEY_SIZE = 32;
export const VAULT_EMPLOYER_OFFSET = ACCOUNT_DISCRIMINATOR_SIZE;
export const SCHEDULE_EMPLOYER_OFFSET = ACCOUNT_DISCRIMINATOR_SIZE;
