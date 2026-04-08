CREATE TABLE "execution_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"schedule_pda" varchar(44) NOT NULL,
	"scheduled_for" bigint NOT NULL,
	"status" varchar(32) NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"next_attempt_at" bigint NOT NULL,
	"started_at" bigint,
	"finished_at" bigint,
	"claimed_count" integer DEFAULT 0 NOT NULL,
	"already_paid_count" integer DEFAULT 0 NOT NULL,
	"failed_claim_count" integer DEFAULT 0 NOT NULL,
	"delegate_signature" varchar(128),
	"commit_signature" varchar(128),
	"last_error" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT NOT NULL,
	CONSTRAINT "execution_runs_schedule_pda_schedules_schedule_pda_fk" FOREIGN KEY ("schedule_pda") REFERENCES "public"."schedules"("schedule_pda") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "execution_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"attempt_number" integer NOT NULL,
	"stage" varchar(32) NOT NULL,
	"status" varchar(32) NOT NULL,
	"tx_signature" varchar(128),
	"details" jsonb,
	"error" text,
	"started_at" bigint NOT NULL,
	"finished_at" bigint NOT NULL,
	CONSTRAINT "execution_attempts_run_id_execution_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."execution_runs"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "execution_runs_schedule_execution_uidx" ON "execution_runs" USING btree ("schedule_pda","scheduled_for");--> statement-breakpoint
CREATE INDEX "idx_execution_runs_runnable" ON "execution_runs" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "idx_execution_runs_schedule" ON "execution_runs" USING btree ("schedule_pda");--> statement-breakpoint
CREATE INDEX "idx_execution_attempts_run" ON "execution_attempts" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "execution_attempts_run_attempt_stage_uidx" ON "execution_attempts" USING btree ("run_id","attempt_number","stage");
