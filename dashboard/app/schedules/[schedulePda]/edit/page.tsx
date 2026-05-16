import { ScheduleEditorScreen } from "@/features/schedules/schedule-editor-screen";

export default async function EditSchedulePage({
  params,
}: {
  params: Promise<{ schedulePda: string }>;
}) {
  const { schedulePda } = await params;

  return <ScheduleEditorScreen schedulePda={schedulePda} />;
}
