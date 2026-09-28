CREATE TYPE "public"."example_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TABLE "examples" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"note_ciphertext" text,
	"status" "example_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"request_id" text,
	"metadata" jsonb NOT NULL,
	"prev_hash" text NOT NULL,
	"hash" text NOT NULL,
	CONSTRAINT "audit_events_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
CREATE INDEX "examples_owner_status_idx" ON "examples" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "audit_events_resource_idx" ON "audit_events" USING btree ("resource_type","resource_id");