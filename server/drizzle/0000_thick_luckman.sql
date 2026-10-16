CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"total_score" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "round_time_order" CHECK ("rounds"."ends_at" > "rounds"."starts_at" and "rounds"."starts_at" >= "rounds"."created_at"),
	CONSTRAINT "round_score_positive" CHECK ("rounds"."total_score" >= 0)
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"round_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"taps" bigint DEFAULT 0 NOT NULL,
	"score" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "scores_round_id_user_id_pk" PRIMARY KEY("round_id","user_id"),
	CONSTRAINT "score_positive" CHECK ("scores"."taps" >= 0 and "scores"."score" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "valid_role" CHECK ("users"."role" in ('survivor','admin','nikita'))
);
--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rounds_end_idx" ON "rounds" USING btree ("ends_at");--> statement-breakpoint
CREATE INDEX "sessions_expiry_idx" ON "sessions" USING btree ("expires_at");