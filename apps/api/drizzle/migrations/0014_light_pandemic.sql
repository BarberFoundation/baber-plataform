CREATE TYPE "public"."club_subscription_status" AS ENUM('ACTIVE', 'PAST_DUE', 'CANCELED');--> statement-breakpoint
CREATE TYPE "public"."subscription_tier_name" AS ENUM('ESSENCIAL', 'JOGADOR', 'LENDARIO');--> statement-breakpoint
CREATE TABLE "club_subscription_quotas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"quantity_total" integer NOT NULL,
	"quantity_consumed" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "club_subscription_quotas_subscription_service_unique" UNIQUE("subscription_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "club_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"tier_id" uuid NOT NULL,
	"status" "club_subscription_status" DEFAULT 'ACTIVE' NOT NULL,
	"asaas_customer_id" text NOT NULL,
	"asaas_subscription_id" text NOT NULL,
	"current_cycle_start" date NOT NULL,
	"current_cycle_end" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "club_subscriptions_tenant_client_unique" UNIQUE("tenant_id","client_id")
);
--> statement-breakpoint
CREATE TABLE "subscription_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tier" "subscription_tier_name" NOT NULL,
	"services" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"discount_percentage" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_tiers_tenant_tier_unique" UNIQUE("tenant_id","tier")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cpf" text;--> statement-breakpoint
ALTER TABLE "club_subscription_quotas" ADD CONSTRAINT "club_subscription_quotas_subscription_id_club_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."club_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_subscriptions" ADD CONSTRAINT "club_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_subscriptions" ADD CONSTRAINT "club_subscriptions_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_subscriptions" ADD CONSTRAINT "club_subscriptions_tier_id_subscription_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_tiers" ADD CONSTRAINT "subscription_tiers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;