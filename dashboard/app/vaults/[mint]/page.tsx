import { VaultDetailScreen } from "@/features/vaults/vault-detail-screen";

export default async function VaultDetailPage({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  const { mint } = await params;

  return <VaultDetailScreen mint={mint} />;
}
