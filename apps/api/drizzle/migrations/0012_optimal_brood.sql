ALTER TYPE "public"."role" ADD VALUE 'RECEPTIONIST';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;