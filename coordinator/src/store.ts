import { ScheduleRecipientData } from "./types";

class RecipientStore {
    private data: Map<string, ScheduleRecipientData> = new Map();

    set(schedulePda: string, data: ScheduleRecipientData): void {
        this.data.set(schedulePda, data);
    }

    get(schedulePda: string): ScheduleRecipientData | undefined {
        return this.data.get(schedulePda);
    }

    has(schedulePda: string): boolean {
        return this.data.has(schedulePda);
    }

    delete(schedulePda: string): boolean {
        return this.data.delete(schedulePda);
    }

    getAll(): ScheduleRecipientData[] {
        return Array.from(this.data.values());
    }
}

export const recipientStore = new RecipientStore();

