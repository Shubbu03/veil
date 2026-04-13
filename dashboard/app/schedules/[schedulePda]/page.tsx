import { ScheduleDetailScreen } from "@/features/schedules/schedule-detail-screen";

export default async function ScheduleDetailPage({
  params,
}: {
  params: Promise<{ schedulePda: string }>;
}) {
  const { schedulePda } = await params;

  return <ScheduleDetailScreen schedulePda={schedulePda} />;
}
