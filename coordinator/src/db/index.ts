import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
}

const queryClient = postgres(connectionString, {
    max: parseInt(process.env.DB_POOL_MAX || '10'),
    idle_timeout: 20,
    connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });
export { queryClient };
export { schema };
export { schedules } from './schema';
export type { Schedule, NewSchedule } from './schema';

