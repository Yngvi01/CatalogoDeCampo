CREATE TABLE `sampling_sites` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sampling_sites_project_idx` ON `sampling_sites` (`project_id`);--> statement-breakpoint
ALTER TABLE `observations` ADD `sampling_site_id` text REFERENCES sampling_sites(id);--> statement-breakpoint
CREATE INDEX `observations_sampling_site_idx` ON `observations` (`sampling_site_id`);