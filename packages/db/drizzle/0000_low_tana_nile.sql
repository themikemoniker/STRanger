CREATE TABLE `artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`kind` text NOT NULL,
	`filename` text NOT NULL,
	`step_index` integer,
	`caption` text,
	`mime_type` text NOT NULL,
	`size_bytes` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `verification_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_artifacts_run` ON `artifacts` (`run_id`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`run_id` text,
	`artifact_id` text,
	`pin_x` real,
	`pin_y` real,
	`author` text NOT NULL,
	`body` text NOT NULL,
	`resolved_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `feature_reviews`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `verification_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`artifact_id`) REFERENCES `artifacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_comments_review` ON `comments` (`review_id`);--> statement-breakpoint
CREATE TABLE `feature_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text NOT NULL,
	`branch` text,
	`profile_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_reviews_status` ON `feature_reviews` (`status`,`deleted_at`);--> statement-breakpoint
CREATE TABLE `hook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`hook_type` text NOT NULL,
	`payload` text,
	`processed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`base_url` text NOT NULL,
	`browser` text DEFAULT 'chromium',
	`viewport` text,
	`auth_state` text,
	`env_vars` text,
	`llm_provider` text,
	`llm_model` text,
	`is_default` integer DEFAULT 0,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_name_unique` ON `profiles` (`name`);--> statement-breakpoint
CREATE TABLE `scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`start_path` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `feature_reviews`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_scenarios_review` ON `scenarios` (`review_id`,`ordinal`);--> statement-breakpoint
CREATE TABLE `verification_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`verdict` text NOT NULL,
	`summary` text,
	`reasoning` text,
	`duration_ms` integer,
	`notes` text,
	`error_msg` text,
	`started_at` text NOT NULL,
	`finished_at` text,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_runs_scenario` ON `verification_runs` (`scenario_id`);