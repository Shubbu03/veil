import { ScheduleRecipientData } from "./types";
import { scheduleRepository } from "./db/repository";

class RecipientStore {
    async set(schedulePda: string, data: ScheduleRecipientData): Promise<void> {
        return scheduleRepository.set(schedulePda, data);
    }

    async get(schedulePda: string): Promise<ScheduleRecipientData | undefined> {
        return scheduleRepository.get(schedulePda);
    }

    async has(schedulePda: string): Promise<boolean> {
        return scheduleRepository.has(schedulePda);
    }

    async delete(schedulePda: string): Promise<boolean> {
        return scheduleRepository.delete(schedulePda);
    }

    async getAll(): Promise<ScheduleRecipientData[]> {
        return scheduleRepository.getAll();
    }
}

export const recipientStore = new RecipientStore();

