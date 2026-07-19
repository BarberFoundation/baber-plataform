CREATE TABLE "stamp_card_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"eligible_service_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stamps_required" integer NOT NULL,
	"credit_value_in_cents" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stamp_card_configs_tenant_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "stamp_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"current_stamps" integer DEFAULT 0 NOT NULL,
	"credit_balance_in_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stamp_cards_tenant_client_unique" UNIQUE("tenant_id","client_id")
);
--> statement-breakpoint
ALTER TABLE "stamp_card_configs" ADD CONSTRAINT "stamp_card_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stamp_cards" ADD CONSTRAINT "stamp_cards_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stamp_cards" ADD CONSTRAINT "stamp_cards_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;