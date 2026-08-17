CREATE TABLE "invite" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"kind" text DEFAULT 'app' NOT NULL,
	"email" text,
	"name" text,
	"role" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"mode" text NOT NULL,
	"organization_id" text,
	"organization_role" text,
	"team_id" text,
	"preset_seat_limit" integer,
	"pre_created_user_id" text,
	"created_by_user_id" text,
	"inviter_name" text NOT NULL,
	"inviter_email" text NOT NULL,
	"expires_at" timestamp with time zone,
	"max_uses" integer,
	"use_count" integer DEFAULT 0 NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite_use" (
	"id" text PRIMARY KEY NOT NULL,
	"invite_id" text NOT NULL,
	"used_by_user_id" text NOT NULL,
	"invitee_email" text NOT NULL,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "seat_limit" integer;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "disabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "invite_use" ADD CONSTRAINT "invite_use_invite_id_invite_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."invite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invite_token_hash_unique" ON "invite" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "invite_email_idx" ON "invite" USING btree ("email");--> statement-breakpoint
CREATE INDEX "invite_status_idx" ON "invite" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invite_organization_id_idx" ON "invite" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invite_created_by_user_id_idx" ON "invite" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "invite_expires_at_idx" ON "invite" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "invite_use_invite_id_idx" ON "invite_use" USING btree ("invite_id");