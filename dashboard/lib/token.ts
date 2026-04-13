import { BN } from "@coral-xyz/anchor";

export function decimalToRawAmount(value: string, decimals: number) {
  const normalized = value.trim();
  if (!normalized) {
    return BigInt(0);
  }

  const [whole, fraction = ""] = normalized.split(".");
  const safeFraction = fraction.slice(0, decimals).padEnd(decimals, "0");
  const sign = whole.startsWith("-") ? BigInt(-1) : BigInt(1);
  const absoluteWhole = whole.replace("-", "") || "0";
  const raw = BigInt(absoluteWhole) * BigInt(10) ** BigInt(decimals) + BigInt(safeFraction || "0");

  return raw * sign;
}

export function rawAmountToDecimal(raw: bigint | BN | number | string, decimals: number) {
  const bigintValue =
    typeof raw === "bigint"
      ? raw
      : typeof raw === "number"
        ? BigInt(raw)
        : BigInt(raw.toString());

  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = bigintValue / divisor;
  const fraction = bigintValue % divisor;

  if (fraction === BigInt(0)) {
    return whole.toString();
  }

  return `${whole}.${fraction.toString().padStart(decimals, "0").replace(/0+$/, "")}`;
}

export function bnToBigInt(value: BN | bigint | number | string) {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    return BigInt(value);
  }

  return BigInt(value.toString());
}

export function bigintToBn(value: bigint) {
  return new BN(value.toString());
}
