ALTER TABLE "appointments" ADD COLUMN "price_in_cents" integer;--> statement-breakpoint
UPDATE "appointments" SET "price_in_cents" = "services"."price_in_cents" FROM "services" WHERE "appointments"."service_id" = "services"."id";--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "price_in_cents" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "appointments_tenant_date_idx" ON "appointments" USING btree ("tenant_id","date");
