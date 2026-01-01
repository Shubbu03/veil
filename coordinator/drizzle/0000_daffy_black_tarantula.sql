CREATE TABLE "schedules" (
	"schedule_pda" varchar(44) PRIMARY KEY NOT NULL,
	"schedule_id" text NOT NULL,
	"vault_employer" varchar(44) NOT NULL,
	"token_mint" varchar(44) NOT NULL,
	"merkle_root" text NOT NULL,
	"recipients" jsonb NOT NULL,
	"proofs" jsonb NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_vault_employer" ON "schedules" USING btree ("vault_employer");--> statement-breakpoint
CREATE INDEX "idx_created_at" ON "schedules" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_token_mint" ON "schedules" USING btree ("token_mint");