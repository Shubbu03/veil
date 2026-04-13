import { PublicKey } from "@solana/web3.js";
import { dashboardEnv } from "@/lib/env";

export interface Brand<T, B extends string> {
  readonly value: T;
  readonly __brand: B;
}

export type AddressString = string & { readonly __brand: "AddressString" };

export function asAddressString(value: string): AddressString {
  return value as AddressString;
}

export function parsePublicKey(value: string) {
  return new PublicKey(value);
}

export function explorerUrl(path: `address/${string}` | `tx/${string}`) {
  const url = new URL(`https://explorer.solana.com/${path}`);
  url.searchParams.set("cluster", dashboardEnv.cluster);
  return url.toString();
}
